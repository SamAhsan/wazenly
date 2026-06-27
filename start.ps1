# Wazenly — single-command dev startup
# Usage: .\start.ps1

Write-Host "`n WAZENLY Dev Startup" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

# 1. Start Docker services (Postgres + Redis) if not already running
Write-Host "`n[1/2] Starting Docker services (Postgres + Redis)..." -ForegroundColor Cyan
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker failed. Is Docker Desktop running?" -ForegroundColor Red
    exit 1
}
Write-Host "  Docker services running." -ForegroundColor Green

# 2. Start all Node.js processes via Turbo in a new window
Write-Host "`n[2/2] Starting API + Web + Queue workers..." -ForegroundColor Cyan
Write-Host "  Opening dev terminal..." -ForegroundColor Gray

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev" -WorkingDirectory $PSScriptRoot

Write-Host "`n Done! Opening in ~15 seconds:" -ForegroundColor Green
Write-Host "  App  ->  http://localhost:3000" -ForegroundColor White
Write-Host "  API  ->  http://localhost:4000" -ForegroundColor White
Write-Host "`n Login: admin@wazenly.com / Admin1234!" -ForegroundColor DarkGray
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor DarkGray
