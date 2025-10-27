# =============================================================================
# AI Agent App - Deployment Script for Production
# =============================================================================
# This script deploys the AI Agent application to the PRODUCTION environment
# with comprehensive safety checks and verification steps
# =============================================================================

param(
    [switch]$SkipTests = $false,
    [switch]$SkipBuild = $false,
    [switch]$Force = $false,
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$ENVIRONMENT = "production"
$SCRIPT_DIR = $PSScriptRoot
$PROJECT_ROOT = Split-Path $SCRIPT_DIR -Parent

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Red
Write-Host "  AI Agent App - PRODUCTION Deployment" -ForegroundColor Red
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Red
Write-Host ""
Write-Host "  ⚠  WARNING: You are about to deploy to PRODUCTION! ⚠" -ForegroundColor Yellow
Write-Host ""

if (-not $Force) {
    $confirmation = Read-Host "  → Type 'DEPLOY' to continue"
    if ($confirmation -ne 'DEPLOY') {
        Write-Host "  → Deployment cancelled" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""

# =============================================================================
# STEP 1: Pre-Deployment Checks
# =============================================================================

Write-Host "[1/9] Running Pre-Deployment Checks..." -ForegroundColor Yellow
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

# Check Git branch
Write-Host "  → Checking Git branch..." -ForegroundColor Gray
Set-Location $PROJECT_ROOT
$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne "main" -and -not $Force) {
    Write-Host "  ✗ Not on main branch (current: $currentBranch)!" -ForegroundColor Red
    Write-Host "  → Production deployments should be from 'main' branch" -ForegroundColor Yellow
    Write-Host "  → Use -Force to override" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ On branch: $currentBranch" -ForegroundColor Green

# Check Git status
Write-Host "  → Checking Git status..." -ForegroundColor Gray
$gitStatus = git status --porcelain
if ($gitStatus -and -not $Force) {
    Write-Host "  ✗ Uncommitted changes detected!" -ForegroundColor Red
    Write-Host "  → Commit and push your changes before deploying to production" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ Working directory clean" -ForegroundColor Green

# Check if latest commit is pushed
Write-Host "  → Checking if latest commit is pushed..." -ForegroundColor Gray
$localCommit = git rev-parse HEAD
$remoteCommit = git rev-parse origin/$currentBranch
if ($localCommit -ne $remoteCommit -and -not $Force) {
    Write-Host "  ✗ Local commits not pushed to remote!" -ForegroundColor Red
    Write-Host "  → Push your commits before deploying to production" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ Latest commit pushed to remote" -ForegroundColor Green

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
# STEP 2: Version Tagging
# =============================================================================

Write-Host "[2/9] Version Tagging..." -ForegroundColor Yellow
Write-Host ""

if ($Version -eq "") {
    $Version = Read-Host "  → Enter version number (e.g., v1.0.0)"
    if ($Version -eq "") {
        $Version = "v1.0.0-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Host "  → Using auto-generated version: $Version" -ForegroundColor Yellow
    }
}

Write-Host "  → Creating Git tag: $Version" -ForegroundColor Gray
git tag -a $Version -m "Production release $Version"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Tag created: $Version" -ForegroundColor Green
    git push origin $Version
    Write-Host "  ✓ Tag pushed to remote" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Tag may already exist" -ForegroundColor Yellow
}

Write-Host ""

# =============================================================================
# STEP 3: Install Dependencies
# =============================================================================

Write-Host "[3/9] Installing Dependencies..." -ForegroundColor Yellow
Write-Host ""

Set-Location "$PROJECT_ROOT\ai-agent-app"

Write-Host "  → Installing backend dependencies..." -ForegroundColor Gray
npm ci
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Backend dependency installation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Backend dependencies installed" -ForegroundColor Green

Set-Location "$PROJECT_ROOT\frontend"

Write-Host "  → Installing frontend dependencies..." -ForegroundColor Gray
npm ci
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Frontend dependency installation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Frontend dependencies installed" -ForegroundColor Green

Write-Host ""

# =============================================================================
# STEP 4: Security Audit
# =============================================================================

Write-Host "[4/9] Running Security Audit..." -ForegroundColor Yellow
Write-Host ""

Set-Location "$PROJECT_ROOT\ai-agent-app"

Write-Host "  → Running npm audit..." -ForegroundColor Gray
npm audit --production
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ⚠ Security vulnerabilities found!" -ForegroundColor Yellow
    if (-not $Force) {
        $response = Read-Host "  → Continue anyway? (y/N)"
        if ($response -ne 'y') {
            exit 1
        }
    }
} else {
    Write-Host "  ✓ No security vulnerabilities found" -ForegroundColor Green
}

Write-Host ""

# =============================================================================
# STEP 5: Run Tests
# =============================================================================

if (-not $SkipTests) {
    Write-Host "[5/9] Running Tests..." -ForegroundColor Yellow
    Write-Host ""
    
    Set-Location "$PROJECT_ROOT\ai-agent-app"
    
    Write-Host "  → Running full test suite..." -ForegroundColor Gray
    npm test -- --coverage
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ Tests failed!" -ForegroundColor Red
        Write-Host "  → All tests must pass before production deployment" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  ✓ All tests passed" -ForegroundColor Green
    
    Write-Host ""
} else {
    Write-Host "[5/9] Skipping Tests (NOT RECOMMENDED for production)" -ForegroundColor Red
    Write-Host ""
}

# =============================================================================
# STEP 6: Build Application
# =============================================================================

Write-Host "[6/9] Building Application..." -ForegroundColor Yellow
Write-Host ""

# Build backend
Set-Location "$PROJECT_ROOT\ai-agent-app"
Write-Host "  → Building backend for production..." -ForegroundColor Gray
$env:NODE_ENV = "production"
npm run build 2>&1 | Out-Null
Write-Host "  ✓ Backend build complete" -ForegroundColor Green

# Build frontend
Set-Location "$PROJECT_ROOT\frontend"
Write-Host "  → Building frontend for production..." -ForegroundColor Gray
$env:NODE_ENV = "production"
$env:NEXT_PUBLIC_API_URL = "https://api.ai-agent-app.workers.dev"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Frontend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Frontend build complete" -ForegroundColor Green

Write-Host ""

# =============================================================================
# STEP 7: Deploy Backend (Workers)
# =============================================================================

Write-Host "[7/9] Deploying Backend to Production..." -ForegroundColor Yellow
Write-Host ""

Set-Location "$PROJECT_ROOT\ai-agent-app"

Write-Host "  → Deploying Worker to Cloudflare Production..." -ForegroundColor Gray
wrangler deploy --env production
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Backend deployment failed!" -ForegroundColor Red
    Write-Host "  → Check Cloudflare Dashboard for details" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ Backend deployed successfully" -ForegroundColor Green

Write-Host ""

# =============================================================================
# STEP 8: Deploy Frontend (Pages)
# =============================================================================

Write-Host "[8/9] Deploying Frontend to Production..." -ForegroundColor Yellow
Write-Host ""

Set-Location "$PROJECT_ROOT\frontend"

Write-Host "  → Deploying to Cloudflare Pages Production..." -ForegroundColor Gray
wrangler pages deploy .next --project-name=ai-agent-app --branch=main
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Frontend deployment failed!" -ForegroundColor Red
    Write-Host "  → Check Cloudflare Dashboard for details" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ Frontend deployed successfully" -ForegroundColor Green

Write-Host ""

# =============================================================================
# STEP 9: Post-Deployment Verification
# =============================================================================

Write-Host "[9/9] Running Post-Deployment Verification..." -ForegroundColor Yellow
Write-Host ""

# Wait for deployment to propagate
Write-Host "  → Waiting for deployment to propagate (30 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 30

# Test backend health
Write-Host "  → Testing backend health..." -ForegroundColor Gray
$healthCheckPassed = $false
for ($i = 1; $i -le 3; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "https://api.ai-agent-app.workers.dev/health" -Method GET -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✓ Backend health check passed" -ForegroundColor Green
            $healthCheckPassed = $true
            break
        }
    } catch {
        Write-Host "  → Attempt $i/3 failed, retrying..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
}

if (-not $healthCheckPassed) {
    Write-Host "  ✗ Backend health check failed after 3 attempts!" -ForegroundColor Red
    Write-Host "  → Manual verification REQUIRED" -ForegroundColor Yellow
}

# Test frontend
Write-Host "  → Testing frontend..." -ForegroundColor Gray
$frontendCheckPassed = $false
for ($i = 1; $i -le 3; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "https://ai-agent-app.pages.dev" -Method GET -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✓ Frontend accessible" -ForegroundColor Green
            $frontendCheckPassed = $true
            break
        }
    } catch {
        Write-Host "  → Attempt $i/3 failed, retrying..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
}

if (-not $frontendCheckPassed) {
    Write-Host "  ✗ Frontend check failed after 3 attempts!" -ForegroundColor Red
    Write-Host "  → Manual verification REQUIRED" -ForegroundColor Yellow
}

Write-Host ""

# =============================================================================
# Deployment Summary
# =============================================================================

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Production Deployment Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Environment:     PRODUCTION" -ForegroundColor White
Write-Host "  Version:         $Version" -ForegroundColor White
Write-Host "  Backend URL:     https://api.ai-agent-app.workers.dev" -ForegroundColor White
Write-Host "  Frontend URL:    https://ai-agent-app.pages.dev" -ForegroundColor White
Write-Host "  Deployed at:     $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
Write-Host "  Git Commit:      $localCommit" -ForegroundColor White
Write-Host ""
Write-Host "  ⚠  IMPORTANT: Post-Deployment Actions Required" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. ✓ Monitor Cloudflare Analytics Dashboard" -ForegroundColor Gray
Write-Host "  2. ✓ Check error rates and performance metrics" -ForegroundColor Gray
Write-Host "  3. ✓ Run smoke tests on production endpoints" -ForegroundColor Gray
Write-Host "  4. ✓ Verify all critical user flows" -ForegroundColor Gray
Write-Host "  5. ✓ Monitor logs for 30 minutes" -ForegroundColor Gray
Write-Host "  6. ✓ Update status page if configured" -ForegroundColor Gray
Write-Host "  7. ✓ Notify team of deployment completion" -ForegroundColor Gray
Write-Host ""
Write-Host "  Rollback Command (if needed):" -ForegroundColor Yellow
Write-Host "  → cd ai-agent-app && wrangler rollback --env production" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

Set-Location $PROJECT_ROOT
