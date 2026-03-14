@echo off
title ReJoin Build
cd /d "%~dp0"

echo === ReJoin Build (exe) ===

:check_python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install: winget install Python.Python.3.12
    pause
    exit /b 1
)

:check_node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install: winget install OpenJS.NodeJS.LTS
    pause
    exit /b 1
)

:check_pyinstaller
pip show pyinstaller >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/5] Installing PyInstaller...
    pip install pyinstaller
) else (
    echo [1/5] PyInstaller OK
)

echo [2/5] Installing Python deps...
pip install -r requirements.txt -q

echo [3/5] Building api_server.exe (PyInstaller)...
if exist dist\api_server.exe del dist\api_server.exe
pyinstaller api_server.spec --noconfirm
if %errorlevel% neq 0 (
    echo [ERROR] PyInstaller failed
    pause
    exit /b 1
)

echo [4/5] Building UI (Vite)...
cd ui
call npm install
call npm run build
cd ..
if not exist ui\dist\index.html (
    echo [ERROR] UI build failed
    pause
    exit /b 1
)

echo [5/5] Building Electron app...
call npm install
call npx electron-builder --win

echo.
echo === Build done ===
echo Output: release\
dir release
pause
