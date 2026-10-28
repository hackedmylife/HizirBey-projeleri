@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0vendor\AutoHotkey64.exe" (
  echo Calistirma dosyasi bulunamadi. ZIP dosyasinin tamamini bir klasore cikartin.
  pause
  exit /b 1
)
start "" "%~dp0vendor\AutoHotkey64.exe" /ErrorStdOut "%~dp0Hizir-Bey-WorkSpaces-Dikte-Mini.ahk"
