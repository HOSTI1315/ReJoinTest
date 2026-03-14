@echo off
if exist release rmdir /s /q release

echo Step 1: Build UI
cd ui
call npm run build
if errorlevel 1 goto err
cd ..

echo Step 2: Build Electron
call npx electron-builder --win
if errorlevel 1 goto err

echo Done. Check release folder.
goto end
:err
echo Build failed.
pause
exit /b 1
:end
pause
