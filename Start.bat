@echo off
chcp 65001 >nul
title Emden Tigers Hub
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 server.py
    goto ende
)
where python >nul 2>nul
if %errorlevel%==0 (
    python server.py
    goto ende
)

echo.
echo  Python wurde nicht gefunden.
echo  Bitte Python 3 von https://www.python.org/downloads/ installieren
echo  und dabei "Add python.exe to PATH" anhaken. Danach diese Datei erneut starten.
echo.
pause
exit /b

:ende
pause
