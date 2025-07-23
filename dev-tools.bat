@echo off
title Aether Editor - Development Tools
color 0E

:menu
cls
echo.
echo ========================================
echo    AETHER EDITOR - DEV TOOLS
echo ========================================
echo.
echo Choose an option:
echo.
echo 1. Start Full Application (Frontend + Backend + Worker)
echo 2. Start Frontend Only
echo 3. Start Backend API Only
echo 4. Start Worker Only
echo 5. Run Frontend Tests
echo 6. Build Frontend
echo 7. Build Backend
echo 8. Test API Setup
echo 9. Clean Install (reinstall all dependencies)
echo 0. Exit
echo.
set /p choice="Enter your choice (0-9): "

if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto start_frontend
if "%choice%"=="3" goto start_backend
if "%choice%"=="4" goto start_worker
if "%choice%"=="5" goto test_frontend
if "%choice%"=="6" goto build_frontend
if "%choice%"=="7" goto build_backend
if "%choice%"=="8" goto test_api
if "%choice%"=="9" goto clean_install
if "%choice%"=="0" goto exit
goto menu

:start_all
echo Starting full application...
start "Frontend" cmd /k "cd apps\web && npm run dev"
timeout /t 2 /nobreak >nul
start "Backend + Worker" cmd /k "cd apps\api && npm run dev:all"
echo Services started in separate windows
pause
goto menu

:start_frontend
echo Starting frontend only...
start "Frontend" cmd /k "cd apps\web && npm run dev"
pause
goto menu

:start_backend
echo Starting backend API only...
start "Backend API" cmd /k "cd apps\api && npm run dev"
pause
goto menu

:start_worker
echo Starting worker only...
start "Worker" cmd /k "cd apps\api && npm run dev:worker"
pause
goto menu

:test_frontend
echo Running frontend tests...
cd apps\web
call npm run test
pause
cd ..\..
goto menu

:build_frontend
echo Building frontend...
cd apps\web
call npm run build
if errorlevel 1 (
    echo Build failed!
) else (
    echo Build successful!
)
pause
cd ..\..
goto menu

:build_backend
echo Building backend...
cd apps\api
call npm run build
if errorlevel 1 (
    echo Build failed!
) else (
    echo Build successful!
)
pause
cd ..\..
goto menu

:test_api
echo Testing API setup...
cd apps\api
call npm run test:setup
pause
cd ..\..
goto menu

:clean_install
echo Cleaning and reinstalling all dependencies...
echo.
echo Removing node_modules...
if exist "apps\web\node_modules" rmdir /s /q "apps\web\node_modules"
if exist "apps\api\node_modules" rmdir /s /q "apps\api\node_modules"
if exist "packages\types\node_modules" rmdir /s /q "packages\types\node_modules"

echo Installing dependencies...
cd packages\types && call npm install
cd ..\..\apps\web && call npm install
cd ..\api && call npm install
cd ..\..

echo Clean install completed!
pause
goto menu

:exit
echo Goodbye!
exit /b 0