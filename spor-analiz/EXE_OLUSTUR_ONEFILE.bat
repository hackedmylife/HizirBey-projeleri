@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

title Spor Analiz Merkezi - V45 Guvenli ONEFILE EXE Build

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
set "SPEC=%ROOT%gui_onefile.spec"
set "REQ=%ROOT%build_requirements.txt"
set "HIZIR_PROJECT_DIR=%PROJECT%"
set "DIST=%PROJECT%dist_onefile"
set "WORK=%PROJECT%build_onefile"

if not exist "%SPEC%" (
  echo HATA: gui_onefile.spec bulunamadi.
  goto :fail
)
if not exist "%REQ%" (
  echo HATA: build_requirements.txt bulunamadi.
  goto :fail
)

cls
echo ============================================================
echo  Spor Analiz Merkezi - V45 Guvenli ONEFILE EXE Build
echo ============================================================
echo.
echo Kaynak klasoru otomatik bulundu:
echo %PROJECT%
echo.
echo ONEFILE cikisi mevcut ONEDIR build'i SILMEZ.
echo Cikti: %DIST%\SporAnalizMerkezi.exe
echo.
echo NOT: Token/API key dosyalari KOPYALANMAZ, SILINMEZ,
echo      EXE'YE GOMULMEZ veya UZERINE YAZILMAZ.
echo      Anahtarlar %%LOCALAPPDATA%%\HizirBeySports'tan okunabilir.
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo HATA: Python PATH icinde bulunamadi.
  echo PowerShell'de python --version komutunu kontrol et.
  goto :fail
)

if not exist "%VENV%\Scripts\python.exe" (
  echo [1/7] Build sanal ortami olusturuluyor...
  python -m venv "%VENV%"
  if errorlevel 1 goto :fail
) else (
  echo [1/7] Mevcut build sanal ortami kullaniliyor.
)

echo [2/7] Pip guncelleniyor...
"%VENV%\Scripts\python.exe" -m pip install --upgrade --no-cache-dir pip
if errorlevel 1 goto :fail

echo [3/7] Build bagimliliklari kuruluyor/guncelleniyor...
"%VENV%\Scripts\python.exe" -m pip install --upgrade --no-cache-dir -r "%REQ%"
if errorlevel 1 goto :fail

echo [4/7] Kaynak Python dosyalari syntax kontrolu...
for %%F in ("%PROJECT%*.py") do (
  "%VENV%\Scripts\python.exe" -m py_compile "%%~fF"
  if errorlevel 1 goto :fail
)
if exist "%PROJECT%fetchers\*.py" (
  for %%F in ("%PROJECT%fetchers\*.py") do (
    "%VENV%\Scripts\python.exe" -m py_compile "%%~fF"
    if errorlevel 1 goto :fail
  )
)

if not exist "%PROJECT%gui.py" (
  echo HATA: Algilanan kaynak klasorunde gui.py yok.
  goto :fail
)

echo [5/7] Eski ONEFILE build klasorleri temizleniyor...
if exist "%WORK%" rmdir /S /Q "%WORK%"
if exist "%DIST%" rmdir /S /Q "%DIST%"

echo [6/7] PyInstaller ONEFILE EXE olusturuluyor...
cd /d "%PROJECT%"
if errorlevel 1 (
  echo HATA: Kaynak klasorune gecilemedi: %PROJECT%
  goto :fail
)

"%VENV%\Scripts\python.exe" -m PyInstaller ^
  --clean ^
  --noconfirm ^
  --distpath "%DIST%" ^
  --workpath "%WORK%" ^
  "%SPEC%"
set "RC=!ERRORLEVEL!"

cd /d "%ROOT%"
if not "!RC!"=="0" goto :fail

echo [7/7] Cikti kontrol ediliyor...
if not exist "%DIST%\SporAnalizMerkezi.exe" (
  echo HATA: PyInstaller tamamlandi ancak ONEFILE EXE bulunamadi.
  goto :fail
)

for %%A in ("%DIST%\SporAnalizMerkezi.exe") do set "EXESIZE=%%~zA"

echo.
echo ============================================================
echo  ONEFILE BUILD BASARILI
echo ============================================================
echo.
echo Tek EXE:
echo %DIST%\SporAnalizMerkezi.exe
echo.
echo Boyut: !EXESIZE! byte
echo.
echo DAGITIM:
echo - Yalniz SporAnalizMerkezi.exe dosyasini tasiyabilirsin.
echo - Token/API key dosyalari EXE icinde DEGILDIR.
echo - Tokenlar %%LOCALAPPDATA%%\HizirBeySports klasorunde kalabilir.
echo - Ilk acilis ONEDIR surumunden birkac saniye daha uzun surebilir.
echo - Mevcut dist\SporAnalizMerkezi ONEDIR klasorune dokunulmadi.
echo ============================================================
echo.
pause
exit /b 0

:fail
cd /d "%ROOT%" >nul 2>nul
echo.
echo ============================================================
echo  ONEFILE BUILD BASARISIZ
echo  Yukaridaki ilk HATA/ERROR satirlarini paylas.
echo ============================================================
echo.
pause
exit /b 1
