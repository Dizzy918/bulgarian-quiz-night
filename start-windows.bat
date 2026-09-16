@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed on this computer.
  echo   Get it from https://nodejs.org ^(the green LTS button^), then run this again.
  echo.
  pause
  exit /b 1
)
node server.js
pause
