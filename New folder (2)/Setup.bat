@echo off
setlocal
title DATAVOX Setup - Afrasiab Labs
echo.
echo  DATAVOX - Afrasiab Labs
echo  Installing the prebuilt DATAVOX desktop application.
echo  No Visual Studio or developer tools are required.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup.ps1"
if errorlevel 1 (
  echo.
  echo Installation did not complete. Read the error above.
  pause
  exit /b 1
)
echo.
pause
