# =============================================================================
# AI Agent App - Cloudflare Resources Setup Script
# =============================================================================
# This script provisions all required Cloudflare resources for the AI Agent App
# Run this script ONCE before first deployment to set up:
# - Vectorize indexes
# - R2 buckets
# - KV namespaces
# =============================================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('development', 'staging', 'production', 'all')]
    [string]$Environment = 'development'
)

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = $PSScriptRoot
$PROJECT_ROOT = Split-Path $SCRIPT_DIR -Parent

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AI Agent App - Cloudflare Resources Setup" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Environment: $Environment" -ForegroundColor White
Write-Host ""

# =============================================================================
# Check Prerequisites
# =============================================================================

Write-Host "[1/5] Checking Prerequisites..." -ForegroundColor Yellow
Write-Host ""

# Check if wrangler is installed
if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
    Write-Host "  ✗ Wrangler CLI not found!" -ForegroundColor Red
    Write-Host "  → Install with: npm install -g wrangler" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ Wrangler CLI installed" -ForegroundColor Green

# Check authentication
$authCheck = wrangler whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Not authenticated with Cloudflare!" -ForegroundColor Red
    Write-Host "  → Run: wrangler login" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ Authenticated with Cloudflare" -ForegroundColor Green

Set-Location "$PROJECT_ROOT\ai-agent-app"
Write-Host ""

# =============================================================================
# Function to Create Resources for an Environment
# =============================================================================

function New-EnvironmentResources {
    param(
        [string]$EnvName,
        [string]$EnvSuffix
    )
    
    Write-Host "───────────────────────────────────────────────────────────" -ForegroundColor Gray
    Write-Host "  Setting up resources for: $EnvName" -ForegroundColor Cyan
    Write-Host "───────────────────────────────────────────────────────────" -ForegroundColor Gray
    Write-Host ""
    
    # Vectorize Index
    Write-Host "  → Creating Vectorize index..." -ForegroundColor Gray
    $vectorizeName = "ai-agent-memory$EnvSuffix"
    $vectorizeOutput = wrangler vectorize create $vectorizeName --dimensions=768 --metric=cosine 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Vectorize index created: $vectorizeName" -ForegroundColor Green
    } else {
        if ($vectorizeOutput -match "already exists") {
            Write-Host "  ℹ Vectorize index already exists: $vectorizeName" -ForegroundColor Yellow
        } else {
            Write-Host "  ✗ Failed to create Vectorize index!" -ForegroundColor Red
            Write-Host "    $vectorizeOutput" -ForegroundColor Red
        }
    }
    
    # R2 Bucket
    Write-Host "  → Creating R2 bucket..." -ForegroundColor Gray
    $r2Name = "ai-agent-files$EnvSuffix"
    $r2Output = wrangler r2 bucket create $r2Name 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ R2 bucket created: $r2Name" -ForegroundColor Green
    } else {
        if ($r2Output -match "already exists") {
            Write-Host "  ℹ R2 bucket already exists: $r2Name" -ForegroundColor Yellow
        } else {
            Write-Host "  ✗ Failed to create R2 bucket!" -ForegroundColor Red
            Write-Host "    $r2Output" -ForegroundColor Red
        }
    }
    
    # KV Namespace - CONFIG
    Write-Host "  → Creating CONFIG KV namespace..." -ForegroundColor Gray
    $kvConfigOutput = wrangler kv:namespace create "CONFIG_$EnvName" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $kvConfigId = ($kvConfigOutput | Select-String -Pattern 'id = "([^"]+)"').Matches.Groups[1].Value
        Write-Host "  ✓ CONFIG KV namespace created" -ForegroundColor Green
        Write-Host "    ID: $kvConfigId" -ForegroundColor Gray
        
        # Store ID for later
        $global:KvConfigIds[$EnvName] = $kvConfigId
    } else {
        if ($kvConfigOutput -match "already exists") {
            Write-Host "  ℹ CONFIG KV namespace already exists" -ForegroundColor Yellow
        } else {
            Write-Host "  ✗ Failed to create CONFIG KV namespace!" -ForegroundColor Red
            Write-Host "    $kvConfigOutput" -ForegroundColor Red
        }
    }
    
    # KV Namespace - RATE_LIMIT
    Write-Host "  → Creating RATE_LIMIT KV namespace..." -ForegroundColor Gray
    $kvRateLimitOutput = wrangler kv:namespace create "RATE_LIMIT_$EnvName" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $kvRateLimitId = ($kvRateLimitOutput | Select-String -Pattern 'id = "([^"]+)"').Matches.Groups[1].Value
        Write-Host "  ✓ RATE_LIMIT KV namespace created" -ForegroundColor Green
        Write-Host "    ID: $kvRateLimitId" -ForegroundColor Gray
        
        $global:KvRateLimitIds[$EnvName] = $kvRateLimitId
    } else {
        if ($kvRateLimitOutput -match "already exists") {
            Write-Host "  ℹ RATE_LIMIT KV namespace already exists" -ForegroundColor Yellow
        } else {
            Write-Host "  ✗ Failed to create RATE_LIMIT KV namespace!" -ForegroundColor Red
        }
    }
    
    # KV Namespace - SESSIONS
    Write-Host "  → Creating SESSIONS KV namespace..." -ForegroundColor Gray
    $kvSessionsOutput = wrangler kv:namespace create "SESSIONS_$EnvName" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $kvSessionsId = ($kvSessionsOutput | Select-String -Pattern 'id = "([^"]+)"').Matches.Groups[1].Value
        Write-Host "  ✓ SESSIONS KV namespace created" -ForegroundColor Green
        Write-Host "    ID: $kvSessionsId" -ForegroundColor Gray
        
        $global:KvSessionsIds[$EnvName] = $kvSessionsId
    } else {
        if ($kvSessionsOutput -match "already exists") {
            Write-Host "  ℹ SESSIONS KV namespace already exists" -ForegroundColor Yellow
        } else {
            Write-Host "  ✗ Failed to create SESSIONS KV namespace!" -ForegroundColor Red
        }
    }
    
    Write-Host ""
}

# Initialize global hash tables for IDs
$global:KvConfigIds = @{}
$global:KvRateLimitIds = @{}
$global:KvSessionsIds = @{}

# =============================================================================
# Create Resources Based on Environment
# =============================================================================

Write-Host "[2/5] Creating Cloudflare Resources..." -ForegroundColor Yellow
Write-Host ""

if ($Environment -eq 'all') {
    New-EnvironmentResources -EnvName "development" -EnvSuffix ""
    New-EnvironmentResources -EnvName "staging" -EnvSuffix "-staging"
    New-EnvironmentResources -EnvName "production" -EnvSuffix "-production"
} elseif ($Environment -eq 'development') {
    New-EnvironmentResources -EnvName "development" -EnvSuffix ""
} elseif ($Environment -eq 'staging') {
    New-EnvironmentResources -EnvName "staging" -EnvSuffix "-staging"
} elseif ($Environment -eq 'production') {
    New-EnvironmentResources -EnvName "production" -EnvSuffix "-production"
}

# =============================================================================
# Update wrangler.toml with KV Namespace IDs
# =============================================================================

Write-Host "[3/5] Updating wrangler.toml Configuration..." -ForegroundColor Yellow
Write-Host ""

if ($global:KvConfigIds.Count -gt 0 -or $global:KvRateLimitIds.Count -gt 0 -or $global:KvSessionsIds.Count -gt 0) {
    Write-Host "  ℹ Please update wrangler.toml with the following KV namespace IDs:" -ForegroundColor Yellow
    Write-Host ""
    
    foreach ($env in $global:KvConfigIds.Keys) {
        Write-Host "  [$env]" -ForegroundColor Cyan
        if ($global:KvConfigIds[$env]) {
            Write-Host "    CONFIG: $($global:KvConfigIds[$env])" -ForegroundColor White
        }
        if ($global:KvRateLimitIds[$env]) {
            Write-Host "    RATE_LIMIT: $($global:KvRateLimitIds[$env])" -ForegroundColor White
        }
        if ($global:KvSessionsIds[$env]) {
            Write-Host "    SESSIONS: $($global:KvSessionsIds[$env])" -ForegroundColor White
        }
        Write-Host ""
    }
} else {
    Write-Host "  ℹ No new KV namespaces to update in wrangler.toml" -ForegroundColor Yellow
    Write-Host ""
}

# =============================================================================
# Configure Secrets
# =============================================================================

Write-Host "[4/5] Configuring Secrets..." -ForegroundColor Yellow
Write-Host ""

Write-Host "  ℹ You need to configure the following secrets for each environment:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Required Secrets:" -ForegroundColor White
Write-Host "    • JWT_SECRET         - Secret key for JWT token signing" -ForegroundColor Gray
Write-Host "    • ENCRYPTION_KEY     - Key for data encryption" -ForegroundColor Gray
Write-Host "    • OPENAI_API_KEY     - OpenAI API key (optional fallback)" -ForegroundColor Gray
Write-Host "    • ANTHROPIC_API_KEY  - Anthropic API key (optional fallback)" -ForegroundColor Gray
Write-Host ""
Write-Host "  To set secrets, run:" -ForegroundColor White
Write-Host "    wrangler secret put JWT_SECRET --env production" -ForegroundColor Gray
Write-Host "    wrangler secret put ENCRYPTION_KEY --env production" -ForegroundColor Gray
Write-Host ""

# =============================================================================
# List All Resources
# =============================================================================

Write-Host "[5/5] Resource Summary..." -ForegroundColor Yellow
Write-Host ""

Write-Host "  Listing Vectorize indexes:" -ForegroundColor White
wrangler vectorize list

Write-Host ""
Write-Host "  Listing R2 buckets:" -ForegroundColor White
wrangler r2 bucket list

Write-Host ""
Write-Host "  Listing KV namespaces:" -ForegroundColor White
wrangler kv:namespace list

Write-Host ""

# =============================================================================
# Complete
# =============================================================================

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Resource Setup Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Update wrangler.toml with KV namespace IDs (if new)" -ForegroundColor Gray
Write-Host "  2. Configure secrets using wrangler secret put" -ForegroundColor Gray
Write-Host "  3. Run deployment script for your target environment" -ForegroundColor Gray
Write-Host ""
Write-Host "  Deployment Commands:" -ForegroundColor White
Write-Host "    Staging:    .\deploy-staging.ps1" -ForegroundColor Gray
Write-Host "    Production: .\deploy-production.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

Set-Location $PROJECT_ROOT
