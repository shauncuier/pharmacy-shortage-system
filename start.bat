@echo off
setlocal enabledelayedexpansion
title BMH Pharmacy System - Auto Launcher

echo ======================================================================
echo          🏥 BARA-AWLIA MEDICAL HALL PHARMACY SYSTEM
echo ======================================================================
echo.

:: 1. Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js (v18 or higher) from https://nodejs.org
    echo After installing, double-click this file again.
    echo.
    pause
    exit /b 1
)

:: 2. Check and install npm dependencies if missing
if not exist "node_modules\" (
    echo [1/3] First-time setup detected. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install npm dependencies.
        pause
        exit /b 1
    )
) else (
    echo [1/3] Dependencies verified.
)

:: 3. Run auto-environment & database initializer
echo [2/3] Verifying database and environment variables...
call node scripts/ensure-setup.mjs
if %errorlevel% neq 0 (
    echo [ERROR] Auto-setup failed. Please check the logs above.
    pause
    exit /b 1
)

:: 4. Launch browser and start dev server
echo [3/3] Starting server on port 3000...
echo.
echo ======================================================================
echo  🚀 SERVER IS STARTING!
echo  👉 Local Access:   http://localhost:3000
echo  🔑 Default Login:  RASEL / PIN: admin1234
echo ======================================================================
echo.

:: Open browser after 2 seconds in background
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Start Next.js server
call npm run dev
pause
