# Сборка ReJoinTool (SkrilyaHUB)
# Требуется: Python + pyinstaller, Node.js + npm

$ErrorActionPreference = "Stop"

Write-Host "=== 1. Сборка API (PyInstaller) ===" -ForegroundColor Cyan
pip install pyinstaller --quiet 2>$null
pyinstaller api_server.spec --noconfirm
if (-not (Test-Path "dist\api_server.exe")) {
    Write-Error "PyInstaller не создал api_server.exe"
}

Write-Host "`n=== 2. Сборка UI (Vite) ===" -ForegroundColor Cyan
Set-Location ui
npm install --silent 2>$null
npm run build
Set-Location ..
if (-not (Test-Path "ui\dist\index.html")) {
    Write-Error "Vite не создал ui/dist"
}

Write-Host "`n=== 3. Сборка Electron ===" -ForegroundColor Cyan
npm install --silent 2>$null
npx electron-builder --win

Write-Host "`n=== Готово ===" -ForegroundColor Green
Write-Host "Установщик: release\ReJoinTool (SkrilyaHUB) Setup 1.0.0.exe"
Write-Host "Портативная версия: release\ReJoinTool (SkrilyaHUB) 1.0.0.exe"
