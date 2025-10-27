# Phase 1 Verification Script
# Checks that all Phase 1 requirements are met

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Phase 1 Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Node.js $nodeVersion installed" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js not found" -ForegroundColor Red
    $allPassed = $false
}

# Check npm
Write-Host "Checking npm..." -ForegroundColor Yellow
$npmVersion = npm --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ npm $npmVersion installed" -ForegroundColor Green
} else {
    Write-Host "❌ npm not found" -ForegroundColor Red
    $allPassed = $false
}

# Check Wrangler
Write-Host "Checking Wrangler..." -ForegroundColor Yellow
$wranglerVersion = wrangler --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Wrangler installed: $wranglerVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Wrangler not found" -ForegroundColor Red
    $allPassed = $false
}

# Check Wrangler authentication
Write-Host "Checking Wrangler authentication..." -ForegroundColor Yellow
$authCheck = wrangler whoami 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Authenticated with Cloudflare" -ForegroundColor Green
} else {
    Write-Host "⚠️  Not authenticated (run: wrangler login)" -ForegroundColor Yellow
}

# Check node_modules
Write-Host "Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "❌ Dependencies not installed (run: npm install)" -ForegroundColor Red
    $allPassed = $false
}

# Check project structure
Write-Host "Checking project structure..." -ForegroundColor Yellow
$requiredDirs = @("src", "src/agents", "src/workflows", "src/utils", "src/types", "tests", "public")
$missingDirs = @()

foreach ($dir in $requiredDirs) {
    if (!(Test-Path $dir)) {
        $missingDirs += $dir
    }
}

if ($missingDirs.Count -eq 0) {
    Write-Host "✅ All directories present" -ForegroundColor Green
} else {
    Write-Host "❌ Missing directories: $($missingDirs -join ', ')" -ForegroundColor Red
    $allPassed = $false
}

# Check configuration files
Write-Host "Checking configuration files..." -ForegroundColor Yellow
$requiredFiles = @(
    "package.json",
    "tsconfig.json",
    "wrangler.toml",
    ".eslintrc.json",
    ".prettierrc.json",
    ".gitignore",
    "README.md"
)
$missingFiles = @()

foreach ($file in $requiredFiles) {
    if (!(Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -eq 0) {
    Write-Host "✅ All configuration files present" -ForegroundColor Green
} else {
    Write-Host "❌ Missing files: $($missingFiles -join ', ')" -ForegroundColor Red
    $allPassed = $false
}

# Check source files
Write-Host "Checking source files..." -ForegroundColor Yellow
$requiredSrcFiles = @(
    "src/index.ts",
    "src/types/index.ts",
    "src/agents/AIAgent.ts",
    "src/utils/logger.ts",
    "src/utils/helpers.ts"
)
$missingSrcFiles = @()

foreach ($file in $requiredSrcFiles) {
    if (!(Test-Path $file)) {
        $missingSrcFiles += $file
    }
}

if ($missingSrcFiles.Count -eq 0) {
    Write-Host "✅ All source files present" -ForegroundColor Green
} else {
    Write-Host "❌ Missing source files: $($missingSrcFiles -join ', ')" -ForegroundColor Red
    $allPassed = $false
}

# Check Git
Write-Host "Checking Git repository..." -ForegroundColor Yellow
if (Test-Path ".git") {
    Write-Host "✅ Git repository initialized" -ForegroundColor Green
} else {
    Write-Host "⚠️  Git not initialized (run: git init)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($allPassed) {
    Write-Host "  ✅ Phase 1 Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Authenticate: wrangler login" -ForegroundColor White
    Write-Host "2. Setup resources: .\setup-cloudflare.ps1" -ForegroundColor White
    Write-Host "3. Start dev server: npm run dev" -ForegroundColor White
    Write-Host "4. Run tests: npm test" -ForegroundColor White
} else {
    Write-Host "  ❌ Phase 1 Incomplete" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Please fix the issues above and run this script again." -ForegroundColor Yellow
}

Write-Host ""
