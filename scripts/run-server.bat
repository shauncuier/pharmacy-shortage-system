@echo off
setlocal
title BMH Pharmacy System - Server (24/7)

:: Always run from the project root (this file lives in .\scripts\)
cd /d "%~dp0.."

:: Ensure Node/npm are reachable even when launched by Task Scheduler at boot
set "PATH=C:\Program Files\nodejs;%PATH%"

:: Prepare log folder
if not exist "logs" mkdir "logs"
set "LOGFILE=logs\server.log"

:: Rotate the log file once it grows past ~5 MB
if exist "%LOGFILE%" (
  for %%A in ("%LOGFILE%") do (
    if %%~zA GTR 5242880 move /y "%LOGFILE%" "%LOGFILE%.old" >nul 2>nul
  )
)

:loop
echo. >> "%LOGFILE%"
echo ============================================================ >> "%LOGFILE%"
echo [%date% %time%] Starting BMH Pharmacy server (production) on port 3000... >> "%LOGFILE%"

set PORT=3000
set NODE_ENV=production
set COOKIE_SECURE=false

:: Start the production server. Blocks until it exits.
call npm start >> "%LOGFILE%" 2>&1

echo [%date% %time%] Server exited with code %errorlevel%. Restarting in 5 seconds... >> "%LOGFILE%"
timeout /t 5 /nobreak >nul
goto loop