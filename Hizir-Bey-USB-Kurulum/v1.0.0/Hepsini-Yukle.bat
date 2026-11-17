@echo off
setlocal DisableDelayedExpansion
title Hizir Bey - USB Program Kurulumu
if not exist "%~dp0Kurulum.ps1" (
  echo HATA: Kurulum.ps1 bulunamadi. ZIP dosyasini once tamamen cikartin.
  pause
  exit /b 1
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Kurulum.ps1"
exit /b %errorlevel%
