@echo off
title ReJoin Dev
cd /d "%~dp0"

echo === ReJoin Dev (auto-setup) ===

:check_python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo Python not found. Trying winget install...
    winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements 2>nul
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Install Python: https://www.python.org/downloads/
        echo Or run: winget install Python.Python.3.12
        pause
        exit /b 1
    )
    echo Restart CMD and run start-dev.bat again.
    pause
    exit /b 0
)

:check_node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found. Trying winget install...
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements 2>nul
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Install Node.js: https://nodejs.org/
        echo Or run: winget install OpenJS.NodeJS.LTS
        pause
        exit /b 1
    )
    echo Restart CMD and run start-dev.bat again.
    pause
    exit /b 0
)

echo [1/4] Installing Python deps...
pip install -r requirements.txt -q 2>nul
if errorlevel 1 pip install -r requirements.txt

echo [2/4] Installing Node deps...
if not exist "node_modules" (
    call npm install
)
cd ui
call npm install
cd ..

echo [3/4] Starting Vite...
cd ui
start "Vite" cmd /c "npm run dev"
cd ..

echo [4/4] Waiting 4 sec, then Electron...
timeout /t 4 /nobreak >nul

echo Starting Electron...
npx electron .
