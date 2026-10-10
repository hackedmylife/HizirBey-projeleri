@echo off
setlocal
cd /d "%~dp0"
title Hizir Bey - EXE Olustur
where py >nul 2>nul
if not errorlevel 1 (
    py -3 build_exe.py
    goto result
)
where python >nul 2>nul
if not errorlevel 1 (
    python build_exe.py
    goto result
)
echo Python bulunamadi. Python 3'u python.org adresinden kurun.
echo Kurulumda Tcl/Tk destegi ve Add Python to PATH secili olsun.
pause
exit /b 1
:result
if errorlevel 1 (
    echo.
    echo EXE olusturulamadi. Yukaridaki hata metnini paylasabilirsiniz.
    pause
    exit /b 1
)
echo.
echo EXE hazir! Acilan dist klasorunden programi kullanabilirsiniz.
pause
exit /b 0
