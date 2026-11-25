@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Hamrah Ulum

echo.
echo  ========================================
echo   Hamrah Ulum  -  one click
echo  ========================================
echo   1) If Windows asks, click YES
echo   2) First run may download Node (internet)
echo   3) Keep this window OPEN
echo   4) Browser opens for login
echo  ========================================
echo.

net session >nul 2>&1
if errorlevel 1 (
  echo Asking Windows for permission...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Checking Node.js...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\ensure-node.ps1" >nul
if errorlevel 1 (
  echo.
  echo ERROR: Node.js could not be installed automatically.
  echo Read BARAYE-VALEDIN.txt or install Node 22 from https://nodejs.org
  echo.
  pause
  exit /b 1
)

set "NODE_EXE="
if exist "%~dp0.runtime\node-exe.txt" (
  set /p NODE_EXE=<"%~dp0.runtime\node-exe.txt"
)

if not defined NODE_EXE (
  echo ERROR: Node path file missing.
  pause
  exit /b 1
)

if not exist "%NODE_EXE%" (
  echo ERROR: Node not found: %NODE_EXE%
  pause
  exit /b 1
)

echo Using: %NODE_EXE%
echo Starting server...
echo.

"%NODE_EXE%" "%~dp0bin\hamrah-ulum.js" --host 0.0.0.0
set "ERR=%ERRORLEVEL%"

echo.
if not "%ERR%"=="0" (
  echo Server exited with error %ERR%.
) else (
  echo Server stopped.
)
pause
endlocal
