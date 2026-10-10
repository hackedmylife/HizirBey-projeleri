@echo off
setlocal
powershell.exe -NoProfile -Command "if (Get-Process chrome -ErrorAction SilentlyContinue) { exit 10 }"
if errorlevel 10 (
  echo Chrome hala calisiyor. Chrome menusunden Cikis yapin.
  echo Gerekirse arka planda calisan Chrome'u da normal sekilde kapatin.
  echo Bu dosya acik tarayiciyi zorla kapatmaz.
  pause
  exit /b 10
)
set "ramChromePath="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "ramChromePath=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined ramChromePath if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "ramChromePath=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined ramChromePath if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "ramChromePath=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined ramChromePath (
  echo Chrome standart kurulum yollarinda bulunamadi.
  echo Chrome kisayolunuzun Hedef alanina boslukla --enable-experimental-extension-apis ekleyebilirsiniz.
  pause
  exit /b 1
)
start "" "%ramChromePath%" --enable-experimental-extension-apis --restore-last-session
endlocal
