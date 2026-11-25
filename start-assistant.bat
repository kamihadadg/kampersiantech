@echo off
setlocal
cd /d "%~dp0"
title Hamrah Ulum Assistant

echo.
echo Hamrah Ulum - this PC only
echo For family Wi-Fi use START.bat
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\ensure-node.ps1" >nul
if errorlevel 1 (
  echo ERROR: Node missing. Run START.bat once first.
  pause
  exit /b 1
)

set "NODE_EXE="
if exist "%~dp0.runtime\node-exe.txt" set /p NODE_EXE=<"%~dp0.runtime\node-exe.txt"
if not defined NODE_EXE (
  echo ERROR: Node path missing.
  pause
  exit /b 1
)

"%NODE_EXE%" "%~dp0bin\hamrah-ulum.js" --host 127.0.0.1
echo.
pause
endlocal
