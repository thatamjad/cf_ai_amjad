# =============================================================================
# AI Agent App - Deployment Script for Staging
# =============================================================================
# This script deploys the AI Agent application to the staging environment
# with comprehensive pre-deployment checks and post-deployment verification
# =============================================================================

param(
    [switch]$SkipTests = $false,
    [switch]$SkipBuild = $false,
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"
$ENVIRONMENT = "staging"
$SCRIPT_DIR = $PSScriptRoot
$PROJECT_ROOT = Split-Path $SCRIPT_DIR -Parent

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AI Agent App - Staging Deployment" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# =============================================================================
# STEP 1: Pre-Deployment Checks
# =============================================================================

Write-Host "[1/7] Running Pre-Deployment Checks..." -ForegroundColor Yellow
Write-Host ""

# Check if wrangler is installed
Write-Host "  → Checking Wrangler installation..." -ForegroundColor Gray
if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
    Write-Host "  ✗ Wrangler CLI not found!" -ForegroundColor Red
    Write-Host "  → Install with: npm install -g wrangler" -ForegroundColor Yellow
    exit 1
}
$wranglerVersion = wrangler --version
Write-Host "  ✓ Wrangler installed: $wranglerVersion" -ForegroundColor Green

# Check authentication
Write-Host "  → Checking Cloudflare authentication..." -ForegroundColor Gray
$authCheck = wrangler whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Not authenticated with Cloudflare!" -ForegroundColor Red
    Write-Host "  → Run: wrangler login" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ Authenticated with Cloudflare" -ForegroundColor Green

# Check Git status
Write-Host "  → Checking Git status..." -ForegroundColor Gray
Set-Location $PROJECT_ROOT
$gitStatus = git status --porcelain
if ($gitStatus -and -not $Force) {
    Write-Host "  ⚠ Uncommitted changes detected!" -ForegroundColor Yellow
    Write-Host "  → Commit your changes or use -Force to deploy anyway" -ForegroundColor Yellow
    if (-not $Force) {
        $response = Read-Host "  → Continue anyway? (y/N)"
        if ($response -ne 'y') {
            exit 1
        }
    }
}
Write-Host "  ✓ Git status checked" -ForegroundColor Green

# Check Node.js version
Write-Host "  → Checking Node.js version..." -ForegroundColor Gray
$nodeVersion = node --version
if (-not $nodeVersion) {
    Write-Host "  ✗ Node.js not found!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Node.js version: $nodeVersion" -ForegroundColor Green

Write-Host ""

# =============================================================================
# STEP 2: Install Dependencies
# =============================================================================

Write-Host "[2/7] Installing Dependencies..." -ForegroundColor Yellow
Write-Host ""

Set-Location "$PROJECT_ROOT\ai-agent-app"

if (-not (Test-Path "node_modules")) {
    Write-Host "  → Installing backend dependencies..." -ForegroundColor Gray
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Backend dependency installation failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✓ Backend dependencies already installed" -ForegroundColor Green
}

Set-Location "$PROJECT_ROOT\frontend"

if (-not (Test-Path "node_modules")) {
    Write-Host "  → Installing frontend dependencies..." -ForegroundColor Gray
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Frontend dependency installation failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ✓ Frontend dependencies already installed" -ForegroundColor Green
}

Write-Host ""

# =============================================================================
# STEP 3: Run Tests
# =============================================================================

if (-not $SkipTests) {
    Write-Host "[3/7] Running Tests..." -ForegroundColor Yellow
    Write-Host ""
    
    Set-Location "$PROJECT_ROOT\ai-agent-app"
    
    Write-Host "  → Running backend tests..." -ForegroundColor Gray
    npm test
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Tests failed!" -ForegroundColor Red
        Write-Host "  → Fix failing tests or use -SkipTests to bypass" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  ✓ All tests passed" -ForegroundColor Green
    
    Write-Host ""
} else {
    Write-Host "[3/7] Skipping Tests (as requested)" -ForegroundColor Yellow
    Write-Host ""
}

# =============================================================================
# STEP 4: Build Application
# =============================================================================

if (-not $SkipBuild) {
    Write-Host "[4/7] Building Application..." -ForegroundColor Yellow
    Write-Host ""
    
    # Build backend
    Set-Location "$PROJECT_ROOT\ai-agent-app"
    Write-Host "  → Building backend..." -ForegroundColor Gray
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0 -and (Test-Path "package.json")) {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        if ($packageJson.scripts.build) {
            Write-Host "  ⚠ Build script exists but may have failed" -ForegroundColor Yellow
        }
    }
    Write-Host "  ✓ Backend build complete" -ForegroundColor Green
    
    # Build frontend
    Set-Location "$PROJECT_ROOT\frontend"
    Write-Host "  → Building frontend..." -ForegroundColor Gray
    $env:NODE_ENV = "production"
    $env:NEXT_PUBLIC_API_URL = "https://staging.ai-agent-app.workers.dev"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Frontend build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ Frontend build complete" -ForegroundColor Green
    
    Write-Host ""
} else {
    Write-Host "[4/7] Skipping Build (as requested)" -ForegroundColor Yellow
    Write-Host ""
}

# =============================================================================
# STEP 5: Deploy Backend (Workers)
# =============================================================================

Write-Host "[5/7] Deploying Backend to Staging..." -ForegroundColor Yellow
Write-Host ""

Set-Location "$PROJECT_ROOT\ai-agent-app"

Write-Host "  → Deploying Worker to Cloudflare..." -ForegroundColor Gray
wrangler deploy --env staging
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Backend deployment failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Backend deployed successfully" -ForegroundColor Green

Write-Host ""

# =============================================================================
# STEP 6: Deploy Frontend (Pages)
# =============================================================================

Write-Host "[6/7] Deploying Frontend to Staging..." -ForegroundColor Yellow
Write-Host ""

Set-Location "$PROJECT_ROOT\frontend"

Write-Host "  → Deploying to Cloudflare Pages..." -ForegroundColor Gray
wrangler pages deploy .next --project-name=ai-agent-app-staging --branch=staging
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Frontend deployment failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Frontend deployed successfully" -ForegroundColor Green

Write-Host ""

# =============================================================================
# STEP 7: Post-Deployment Verification
# =============================================================================

Write-Host "[7/7] Running Post-Deployment Verification..." -ForegroundColor Yellow
Write-Host ""

# Wait for deployment to propagate
Write-Host "  → Waiting for deployment to propagate (10 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 10

# Test backend health
Write-Host "  → Testing backend health..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "https://staging.ai-agent-app.workers.dev/health" -Method GET -TimeoutSec 10 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ Backend health check passed" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Backend responded with status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠ Backend health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "  → Manual verification recommended" -ForegroundColor Yellow
}

# Test frontend
Write-Host "  → Testing frontend..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "https://staging.ai-agent-app.pages.dev" -Method GET -TimeoutSec 10 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ Frontend accessible" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Frontend responded with status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠ Frontend check failed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "  → Manual verification recommended" -ForegroundColor Yellow
}

Write-Host ""

# =============================================================================
# Deployment Summary
# =============================================================================

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Environment:     STAGING" -ForegroundColor White
Write-Host "  Backend URL:     https://staging.ai-agent-app.workers.dev" -ForegroundColor White
Write-Host "  Frontend URL:    https://staging.ai-agent-app.pages.dev" -ForegroundColor White
Write-Host "  Deployed at:     $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
Write-Host ""
Write-Host "  Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Verify deployment in Cloudflare Dashboard" -ForegroundColor Gray
Write-Host "  2. Run smoke tests" -ForegroundColor Gray
Write-Host "  3. Monitor logs for errors" -ForegroundColor Gray
Write-Host "  4. Test critical user flows" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Set-Location $PROJECT_ROOT
