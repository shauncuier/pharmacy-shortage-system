@echo off
setlocal
title BMH Pharmacy System - Internet Tunnel (ngrok)

:: Always run from the project root (this file lives in .\scripts\)
cd /d "%~dp0.."

echo ======================================================================
echo   🌐 BMH PHARMACY SYSTEM - INTERNET TUNNEL (ngrok)
echo ======================================================================
echo.
echo  The pharmacy server must already be running
echo  (start.bat / start-server.bat / npm run dev) on port 3000.
echo.
echo  Keep THIS window open while you need internet access.
echo  Press Ctrl+C or close this window to stop the tunnel.
echo.
echo ======================================================================
echo.

node scripts\ngrok-tunnel.mjs

echo.
echo [tunnel] Stopped. The public URL is now OFFLINE.
pause
