# =============================================================================
# AI Agent App - Secrets Management Script
# =============================================================================
# This script helps manage Cloudflare Worker secrets securely
# =============================================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('list', 'set', 'delete', 'rotate')]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('development', 'staging', 'production')]
    [string]$Environment = 'production',
    
    [Parameter(Mandatory=$false)]
    [string]$SecretName = '',
    
    [Parameter(Mandatory=$false)]
    [string]$SecretValue = ''
)

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = $PSScriptRoot
$PROJECT_ROOT = Split-Path $SCRIPT_DIR -Parent

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AI Agent App - Secrets Management" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Action:      $Action" -ForegroundColor White
Write-Host "  Environment: $Environment" -ForegroundColor White
Write-Host ""

Set-Location "$PROJECT_ROOT\ai-agent-app"

# =============================================================================
# List Secrets
# =============================================================================

if ($Action -eq 'list') {
    Write-Host "  Required Secrets for AI Agent App:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  ┌─────────────────────┬──────────────────────────────────────────┬──────────┐" -ForegroundColor Gray
    Write-Host "  │ Secret Name         │ Description                              │ Required │" -ForegroundColor Gray
    Write-Host "  ├─────────────────────┼──────────────────────────────────────────┼──────────┤" -ForegroundColor Gray
    Write-Host "  │ JWT_SECRET          │ Secret key for JWT token signing         │ Yes      │" -ForegroundColor White
    Write-Host "  │ ENCRYPTION_KEY      │ Key for encrypting sensitive data        │ Yes      │" -ForegroundColor White
    Write-Host "  │ OPENAI_API_KEY      │ OpenAI API key (fallback LLM)            │ Optional │" -ForegroundColor White
    Write-Host "  │ ANTHROPIC_API_KEY   │ Anthropic API key (fallback LLM)         │ Optional │" -ForegroundColor White
    Write-Host "  │ SLACK_WEBHOOK_URL   │ Slack webhook for notifications          │ Optional │" -ForegroundColor White
    Write-Host "  │ SENTRY_DSN          │ Sentry DSN for error tracking            │ Optional │" -ForegroundColor White
    Write-Host "  └─────────────────────┴──────────────────────────────────────────┴──────────┘" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Checking configured secrets in Cloudflare..." -ForegroundColor Yellow
    Write-Host ""
    wrangler secret list --env $Environment
    Write-Host ""
}

# =============================================================================
# Set Secret
# =============================================================================

elseif ($Action -eq 'set') {
    if ($SecretName -eq '') {
        Write-Host "  Available secrets to configure:" -ForegroundColor Yellow
        Write-Host "    1. JWT_SECRET" -ForegroundColor White
        Write-Host "    2. ENCRYPTION_KEY" -ForegroundColor White
        Write-Host "    3. OPENAI_API_KEY" -ForegroundColor White
        Write-Host "    4. ANTHROPIC_API_KEY" -ForegroundColor White
        Write-Host "    5. SLACK_WEBHOOK_URL" -ForegroundColor White
        Write-Host "    6. SENTRY_DSN" -ForegroundColor White
        Write-Host ""
        
        $choice = Read-Host "  → Select secret to configure (1-6)"
        
        switch ($choice) {
            '1' { $SecretName = 'JWT_SECRET' }
            '2' { $SecretName = 'ENCRYPTION_KEY' }
            '3' { $SecretName = 'OPENAI_API_KEY' }
            '4' { $SecretName = 'ANTHROPIC_API_KEY' }
            '5' { $SecretName = 'SLACK_WEBHOOK_URL' }
            '6' { $SecretName = 'SENTRY_DSN' }
            default {
                Write-Host "  ✗ Invalid choice!" -ForegroundColor Red
                exit 1
            }
        }
    }
    
    Write-Host ""
    Write-Host "  Setting secret: $SecretName" -ForegroundColor Yellow
    Write-Host ""
    
    # Generate secure random value for JWT_SECRET and ENCRYPTION_KEY if not provided
    if (($SecretName -eq 'JWT_SECRET' -or $SecretName -eq 'ENCRYPTION_KEY') -and $SecretValue -eq '') {
        Write-Host "  ℹ Generating secure random value..." -ForegroundColor Yellow
        
        # Generate 64-character random hex string
        $bytes = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
        $rng.GetBytes($bytes)
        $SecretValue = [System.BitConverter]::ToString($bytes) -replace '-', ''
        
        Write-Host "  ✓ Generated secure value" -ForegroundColor Green
        Write-Host ""
        Write-Host "  ⚠  IMPORTANT: Save this value securely!" -ForegroundColor Yellow
        Write-Host "     Value: $SecretValue" -ForegroundColor White
        Write-Host ""
        
        $confirm = Read-Host "  → Have you saved this value? (y/N)"
        if ($confirm -ne 'y') {
            Write-Host "  → Cancelled" -ForegroundColor Yellow
            exit 0
        }
    }
    
    # Set the secret using wrangler
    if ($SecretValue -ne '') {
        # Write value to temp file for wrangler
        $tempFile = [System.IO.Path]::GetTempFileName()
        $SecretValue | Out-File -FilePath $tempFile -NoNewline -Encoding utf8
        
        Write-Host "  → Setting secret in Cloudflare..." -ForegroundColor Gray
        Get-Content $tempFile | wrangler secret put $SecretName --env $Environment
        
        # Clean up temp file
        Remove-Item $tempFile -Force
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Secret set successfully" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Failed to set secret!" -ForegroundColor Red
            exit 1
        }
    } else {
        # Interactive input
        Write-Host "  → Setting secret interactively..." -ForegroundColor Gray
        wrangler secret put $SecretName --env $Environment
    }
}

# =============================================================================
# Delete Secret
# =============================================================================

elseif ($Action -eq 'delete') {
    if ($SecretName -eq '') {
        $SecretName = Read-Host "  → Enter secret name to delete"
    }
    
    Write-Host ""
    Write-Host "  ⚠  WARNING: You are about to delete secret: $SecretName" -ForegroundColor Yellow
    Write-Host ""
    
    $confirm = Read-Host "  → Type 'DELETE' to confirm"
    if ($confirm -ne 'DELETE') {
        Write-Host "  → Cancelled" -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host ""
    Write-Host "  → Deleting secret from Cloudflare..." -ForegroundColor Gray
    wrangler secret delete $SecretName --env $Environment
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Secret deleted successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to delete secret!" -ForegroundColor Red
        exit 1
    }
}

# =============================================================================
# Rotate Secrets
# =============================================================================

elseif ($Action -eq 'rotate') {
    Write-Host "  Secret Rotation Process" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  This will help you rotate secrets securely:" -ForegroundColor White
    Write-Host "  1. Generate new secret value" -ForegroundColor Gray
    Write-Host "  2. Deploy with new secret" -ForegroundColor Gray
    Write-Host "  3. Verify application works" -ForegroundColor Gray
    Write-Host "  4. Update documentation" -ForegroundColor Gray
    Write-Host ""
    
    if ($SecretName -eq '') {
        Write-Host "  Which secret do you want to rotate?" -ForegroundColor Yellow
        Write-Host "    1. JWT_SECRET" -ForegroundColor White
        Write-Host "    2. ENCRYPTION_KEY" -ForegroundColor White
        Write-Host "    3. OPENAI_API_KEY" -ForegroundColor White
        Write-Host "    4. ANTHROPIC_API_KEY" -ForegroundColor White
        Write-Host ""
        
        $choice = Read-Host "  → Select secret (1-4)"
        
        switch ($choice) {
            '1' { $SecretName = 'JWT_SECRET' }
            '2' { $SecretName = 'ENCRYPTION_KEY' }
            '3' { $SecretName = 'OPENAI_API_KEY' }
            '4' { $SecretName = 'ANTHROPIC_API_KEY' }
            default {
                Write-Host "  ✗ Invalid choice!" -ForegroundColor Red
                exit 1
            }
        }
    }
    
    Write-Host ""
    Write-Host "  Rotating: $SecretName" -ForegroundColor Yellow
    Write-Host ""
    
    # Generate new value for JWT_SECRET and ENCRYPTION_KEY
    if ($SecretName -eq 'JWT_SECRET' -or $SecretName -eq 'ENCRYPTION_KEY') {
        Write-Host "  → Generating new secure value..." -ForegroundColor Gray
        
        $bytes = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
        $rng.GetBytes($bytes)
        $newValue = [System.BitConverter]::ToString($bytes) -replace '-', ''
        
        Write-Host "  ✓ New value generated" -ForegroundColor Green
        Write-Host ""
        Write-Host "  ⚠  IMPORTANT: Save this new value!" -ForegroundColor Yellow
        Write-Host "     New Value: $newValue" -ForegroundColor White
        Write-Host ""
        
        $confirm = Read-Host "  → Continue with rotation? (y/N)"
        if ($confirm -ne 'y') {
            Write-Host "  → Cancelled" -ForegroundColor Yellow
            exit 0
        }
        
        # Set new secret
        $tempFile = [System.IO.Path]::GetTempFileName()
        $newValue | Out-File -FilePath $tempFile -NoNewline -Encoding utf8
        
        Write-Host "  → Updating secret in Cloudflare..." -ForegroundColor Gray
        Get-Content $tempFile | wrangler secret put $SecretName --env $Environment
        
        Remove-Item $tempFile -Force
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Secret rotated successfully" -ForegroundColor Green
            Write-Host ""
            Write-Host "  ⚠  Next steps:" -ForegroundColor Yellow
            Write-Host "     1. Deploy the application" -ForegroundColor Gray
            Write-Host "     2. Test functionality" -ForegroundColor Gray
            Write-Host "     3. Update backup documentation" -ForegroundColor Gray
            Write-Host "     4. Schedule next rotation" -ForegroundColor Gray
        } else {
            Write-Host "  ✗ Failed to rotate secret!" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  → For API keys, enter the new value manually:" -ForegroundColor Gray
        wrangler secret put $SecretName --env $Environment
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Set-Location $PROJECT_ROOT
