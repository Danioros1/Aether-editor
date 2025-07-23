@echo off
title Aether Editor - Quick Start
color 0B

echo.
echo =====================================
echo    AETHER EDITOR - QUICK START
echo =====================================
echo.
echo 🚀 Starting services...
echo.
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo.

REM Start services in parallel
start "Aether Frontend" cmd /k "cd apps\web && npm run dev"
timeout /t 2 /nobreak >nul
start "Aether Backend + Worker" cmd /k "cd apps\api && npm run dev:all"

echo ✅ Services started in separate windows
echo.
echo Press any key to exit this launcher...
pause >nul