# One-command helper to apply the public.users schema fix.
# Run from HTML/Landing:  .\apply-users-migration.ps1
#
# What this does:
#   1. Copies the migration SQL to your clipboard
#   2. Opens the Supabase SQL Editor for project lnpatfboxmqcictodxgv in your browser
#   You then press Ctrl+V in the SQL Editor and click "Run". Done — ~10 seconds.

$ErrorActionPreference = "Stop"

$migrationPath = Join-Path $PSScriptRoot "supabase\migrations\20260513120000_users_rls_policies.sql"
if (-not (Test-Path $migrationPath)) {
    Write-Error "Migration file not found: $migrationPath"
    exit 1
}

$sql = Get-Content $migrationPath -Raw
$sql | Set-Clipboard

Write-Host ""
Write-Host "Migration SQL copied to clipboard." -ForegroundColor Green
Write-Host "Opening Supabase SQL Editor..." -ForegroundColor Green
Write-Host ""
Write-Host "  In the editor that opens:"
Write-Host "    1. Press Ctrl+V to paste the SQL"
Write-Host "    2. Click the Run button (top-right)"
Write-Host "    3. Restart your backend (node server.js) so it picks up the new column"
Write-Host ""

Start-Process "https://supabase.com/dashboard/project/lnpatfboxmqcictodxgv/sql/new"
        