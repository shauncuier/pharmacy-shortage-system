@echo off
setlocal
title BMH Pharmacy System - Internet Tunnel (24/7)

:: Always run from the project root (this file lives in .\scripts\)
cd /d "%~dp0.."

:: Ensure Node/npm are reachable even when launched by Task Scheduler at boot
set "PATH=C:\Program Files\nodejs;%PATH%"

:: Prepare log folder
if not exist "logs" mkdir "logs"
set "LOGFILE=logs\tunnel.log"

:: Rotate the log file once it grows past ~5 MB
if exist "%LOGFILE%" (
  for %%A in ("%LOGFILE%") do (
    if %%~zA GTR 5242880 move /y "%LOGFILE%" "%LOGFILE%.old" >nul 2>nul
  )
)

:loop
echo. >> "%LOGFILE%"
echo ============================================================ >> "%LOGFILE%"
echo [%date% %time%] Starting ngrok tunnel (public internet access)... >> "%LOGFILE%"

:: Run the tunnel script (blocks until it exits). Exit codes:
::   0 = closed cleanly (Ctrl+C)       -> restart the loop
::   2 = configuration error (no token)-> stop, retrying cannot help
::   1 = transient failure (no internet, ngrok error) -> retry below
node scripts\ngrok-tunnel.mjs >> "%LOGFILE%" 2>&1
set "RC=%errorlevel%"

if "%RC%"=="2" (
  echo [%date% %time%] FATAL: NGROK_AUTHTOKEN is missing in .env - stopping the tunnel supervisor. >> "%LOGFILE%"
  echo [%date% %time%] Get a free token: https://dashboard.ngrok.com/get-started/your-authtoken >> "%LOGFILE%"
  exit /b 2
)

echo [%date% %time%] Tunnel exited with code %RC%. Restarting in 30 seconds... >> "%LOGFILE%"

:: 'ping' is used instead of 'timeout' because it also works when the script is
:: launched headless by Task Scheduler (no console / no stdin redirection).
ping -n 31 127.0.0.1 >nul
goto loop
