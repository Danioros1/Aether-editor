@echo off
title Aether Editor - Startup Script
color 0A

echo.
echo ========================================
echo    AETHER EDITOR - STARTUP SCRIPT
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: npm is not available
    pause
    exit /b 1
)

echo ✅ Node.js and npm are available
echo.

REM Check if Redis is running (optional check)
echo 🔍 Checking Redis connection...
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo ⚠️  WARNING: Redis server may not be running
    echo   The API requires Redis for job queue management
    echo   Please start Redis server or install it from:
    echo   https://redis.io/download
    echo.
    echo   For Windows, you can use:
    echo   - Docker: docker run -d -p 6379:6379 redis
    echo   - WSL2 with Redis
    echo   - Redis for Windows
    echo.
    set /p continue="Continue anyway? (y/n): "
    if /i not "%continue%"=="y" exit /b 1
) else (
    echo ✅ Redis is running
)

echo.
echo 📦 Installing dependencies...
echo.

REM Install web dependencies
echo Installing frontend dependencies...
cd apps\web
call npm install
if errorlevel 1 (
    echo ❌ Failed to install web dependencies
    pause
    exit /b 1
)

REM Install API dependencies
echo Installing backend dependencies...
cd ..\api
call npm install
if errorlevel 1 (
    echo ❌ Failed to install API dependencies
    pause
    exit /b 1
)

REM Install types package dependencies
echo Installing shared types dependencies...
cd ..\..\packages\types
call npm install
if errorlevel 1 (
    echo ❌ Failed to install types dependencies
    pause
    exit /b 1
)

cd ..\..\

echo.
echo ✅ All dependencies installed successfully!
echo.
echo 🚀 Starting Aether Editor...
echo.
echo   Frontend (React): http://localhost:3000
echo   Backend API:      http://localhost:3001
echo.
echo Press Ctrl+C to stop all services
echo.

REM Start all services in parallel
start "Aether Frontend" cmd /k "cd apps\web && npm run dev"
timeout /t 2 /nobreak >nul
start "Aether Backend" cmd /k "cd apps\api && npm run dev:all"

echo.
echo 🎉 Aether Editor is starting up!
echo.
echo Services starting in separate windows:
echo   - Frontend development server
echo   - Backend API + Worker processes
echo.
echo Close this window or press any key to exit...
pause >nul