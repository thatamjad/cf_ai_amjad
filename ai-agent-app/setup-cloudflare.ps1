# Cloudflare Resources Setup Script
# Run this script after authenticating with Wrangler

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Agent App - Cloudflare Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if wrangler is authenticated
Write-Host "Checking Wrangler authentication..." -ForegroundColor Yellow
$authCheck = wrangler whoami 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not authenticated with Cloudflare" -ForegroundColor Red
    Write-Host "Please run: wrangler login" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Authenticated with Cloudflare" -ForegroundColor Green
Write-Host ""

# Create Vectorize index
Write-Host "Creating Vectorize index..." -ForegroundColor Yellow
wrangler vectorize create ai-agent-memory --dimensions=768 --metric=cosine

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Vectorize index created successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  Vectorize index may already exist or creation failed" -ForegroundColor Yellow
}
Write-Host ""

# Create R2 bucket
Write-Host "Creating R2 bucket..." -ForegroundColor Yellow
wrangler r2 bucket create ai-agent-files

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ R2 bucket created successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  R2 bucket may already exist or creation failed" -ForegroundColor Yellow
}
Write-Host ""

# Create KV namespaces
Write-Host "Creating KV namespaces..." -ForegroundColor Yellow

Write-Host "Creating production KV namespace..." -ForegroundColor Cyan
$kvProdOutput = wrangler kv:namespace create "CONFIG" 2>&1 | Out-String

Write-Host "Creating preview KV namespace..." -ForegroundColor Cyan
$kvPreviewOutput = wrangler kv:namespace create "CONFIG" --preview 2>&1 | Out-String

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KV Namespace IDs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host $kvProdOutput
Write-Host $kvPreviewOutput
Write-Host ""

Write-Host "⚠️  IMPORTANT: Copy the 'id' and 'preview_id' values above" -ForegroundColor Yellow
Write-Host "and update them in wrangler.toml file" -ForegroundColor Yellow
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Vectorize index: ai-agent-memory" -ForegroundColor Green
Write-Host "✅ R2 bucket: ai-agent-files" -ForegroundColor Green
Write-Host "✅ KV namespaces: CONFIG (prod + preview)" -ForegroundColor Green
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update wrangler.toml with KV namespace IDs" -ForegroundColor White
Write-Host "2. Run: npm run dev" -ForegroundColor White
Write-Host "3. Test the application" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete! 🎉" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
