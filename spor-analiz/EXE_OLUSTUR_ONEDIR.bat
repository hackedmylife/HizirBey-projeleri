@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

title Spor Analiz Merkezi - V42 Guvenli ONEDIR EXE Build

REM Her durumda bu BAT dosyasinin bulundugu klasore gec.
set "ROOT=%~dp0"
cd /d "%ROOT%"
if errorlevel 1 (
  echo HATA: Build klasorune gecilemedi:
  echo %ROOT%
  pause
  exit /b 1
)

REM Kaynak yerlesimini otomatik bul.
set "PROJECT="
if exist "%ROOT%gui.py" set "PROJECT=%ROOT%"
if not defined PROJECT if exist "%ROOT%project\gui.py" set "PROJECT=%ROOT%project\"

if not defined PROJECT (
  echo ============================================================
  echo HATA: gui.py bulunamadi.
  echo.
  echo Bu dosyayi mevcut bet-analyzer klasorunun icine cikart.
  echo Desteklenen yapilar:
  echo   1^) bet-analyzer\gui.py
  echo   2^) bet-analyzer\project\gui.py
  echo ============================================================
  pause
  exit /b 1
)

set "VENV=%ROOT%.venv-build"
set "SPEC=%ROOT%gui_onedir.spec"
set "REQ=%ROOT%build_requirements.txt"
set "HIZIR_PROJECT_DIR=%PROJECT%"

if not exist "%SPEC%" (
  echo HATA: gui_onedir.spec bulunamadi.
  goto :fail
)
if not exist "%REQ%" (
  echo HATA: build_requirements.txt bulunamadi.
  goto :fail
)

cls
echo ============================================================
echo  Spor Analiz Merkezi - V42 Guvenli ONEDIR EXE Build
echo ============================================================
echo.
echo Kaynak klasoru otomatik bulundu:
echo %PROJECT%
echo.
echo NOT: Bu build token/API key dosyalarini KOPYALAMAZ, SILMEZ,
echo      PAKETE EKLEMEZ veya UZERINE YAZMAZ.
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo HATA: Python PATH icinde bulunamadi.
  echo PowerShell'de python --version komutunu kontrol et.
  goto :fail
)

if not exist "%VENV%\Scripts\python.exe" (
  echo [1/6] Build sanal ortami olusturuluyor...
  python -m venv "%VENV%"
  if errorlevel 1 goto :fail
) else (
  echo [1/6] Mevcut build sanal ortami kullaniliyor.
)

echo [2/6] Pip guncelleniyor...
"%VENV%\Scripts\python.exe" -m pip install --upgrade --no-cache-dir pip
if errorlevel 1 goto :fail

echo [3/6] Build bagimliliklari kuruluyor/guncelleniyor...
"%VENV%\Scripts\python.exe" -m pip install --upgrade --no-cache-dir -r "%REQ%"
if errorlevel 1 goto :fail

echo [4/6] Ana kaynak dosyasi syntax kontrolu...
"%VENV%\Scripts\python.exe" -m py_compile "%PROJECT%gui.py"
if errorlevel 1 goto :fail

if not exist "%PROJECT%gui.py" (
  echo HATA: Algilanan kaynak klasorunde gui.py yok.
  goto :fail
)

echo [5/6] Eski build/dist klasorleri temizleniyor...
if exist "%PROJECT%build" rmdir /S /Q "%PROJECT%build"
if exist "%PROJECT%dist" rmdir /S /Q "%PROJECT%dist"

echo [6/6] PyInstaller ONEDIR EXE olusturuluyor...
cd /d "%PROJECT%"
if errorlevel 1 (
  echo HATA: Kaynak klasorune gecilemedi: %PROJECT%
  goto :fail
)

"%VENV%\Scripts\python.exe" -m PyInstaller ^
  --clean ^
  --noconfirm ^
  --distpath "%PROJECT%dist" ^
  --workpath "%PROJECT%build" ^
  "%SPEC%"
set "RC=!ERRORLEVEL!"

cd /d "%ROOT%"
if not "!RC!"=="0" goto :fail

if not exist "%PROJECT%dist\SporAnalizMerkezi\SporAnalizMerkezi.exe" (
  echo HATA: PyInstaller tamamlandi ancak EXE bulunamadi.
  goto :fail
)

echo.
echo ============================================================
echo  BUILD BASARILI
 echo ============================================================
echo.
echo EXE:
echo %PROJECT%dist\SporAnalizMerkezi\SporAnalizMerkezi.exe
echo.
echo Dagitilacak klasor:
echo %PROJECT%dist\SporAnalizMerkezi
echo.
echo ONEMLI:
echo - Sadece EXE'yi degil SporAnalizMerkezi klasorunun TAMAMINI tasi.
echo - Token/API key dosyalari build paketine dahil edilmedi.
echo - Mevcut %%LOCALAPPDATA%%\HizirBeySports anahtarlari aynen korunur.
echo ============================================================
echo.
pause
exit /b 0

:fail
cd /d "%ROOT%" >nul 2>nul
echo.
echo ============================================================
echo  BUILD BASARISIZ
 echo Yukaridaki ilk HATA/ERROR satirlarini paylas.
echo ============================================================
echo.
pause
exit /b 1
