@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

title Spor Analiz Merkezi - V41 Guvenli EXE Build

REM Her durumda BAT dosyasinin bulundugu klasore gec.
set "ROOT=%~dp0"
pushd "%ROOT%" >nul 2>nul
if errorlevel 1 (
  echo HATA: Build klasorune gecilemedi:
  echo %ROOT%
  pause
  exit /b 1
)

REM Kaynak yerlesimini otomatik bul.
set "PROJECT="
if exist "%ROOT%gui.py" set "PROJECT=%ROOT%"
if not defined PROJECT if exist "%ROOT%project\gui.py" set "PROJECT=%ROOT%project"

if not defined PROJECT (
  echo ============================================================
  echo HATA: gui.py bulunamadi.
  echo.
  echo Bu dosyayi mevcut bet-analyzer klasorunun icine cikart.
  echo Desteklenen yapilar:
  echo   1^) bet-analyzer\gui.py
  echo   2^) bet-analyzer\project\gui.py
  echo ============================================================
  popd
  pause
  exit /b 1
)

set "VENV=%ROOT%.venv-build"
set "SPEC=%ROOT%gui_onedir_v41.spec"
set "REQ=%ROOT%build_requirements_v41.txt"
set "HIZIR_PROJECT_DIR=%PROJECT%"

if not exist "%SPEC%" (
  echo HATA: gui_onedir_v41.spec bulunamadi.
  goto :fail
)
if not exist "%REQ%" (
  echo HATA: build_requirements_v41.txt bulunamadi.
  goto :fail
)

echo ============================================================
echo  Spor Analiz Merkezi - V41 Guvenli ONEDIR EXE Build
echo ============================================================
echo.
echo Kaynak klasoru otomatik bulundu:
echo %PROJECT%
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo HATA: Python PATH icinde bulunamadi.
  echo PowerShell'de "python --version" komutunun calistigini kontrol et.
  goto :fail
)

REM Administrator olarak calismak gerekmez. Sadece uyari ver.
net session >nul 2>&1
if not errorlevel 1 (
  echo UYARI: Terminal Yonetici olarak acilmis gorunuyor.
  echo PyInstaller icin Yonetici yetkisi gerekmez. Mumkunse normal PowerShell/CMD kullan.
  echo.
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

echo [3/6] Build bagimliliklari kontrol ediliyor...
"%VENV%\Scripts\python.exe" -m pip install --no-cache-dir -r "%REQ%"
if errorlevel 1 goto :fail

echo [4/6] Kaynak kod syntax kontrolu...
"%VENV%\Scripts\python.exe" -m compileall -q "%PROJECT%"
if errorlevel 1 goto :fail

if not exist "%PROJECT%\gui.py" (
  echo HATA: Algilanan kaynak klasorunde gui.py yok.
  goto :fail
)

echo [5/6] Eski build/dist klasorleri temizleniyor...
if exist "%PROJECT%\build" rmdir /S /Q "%PROJECT%\build"
if exist "%PROJECT%\dist" rmdir /S /Q "%PROJECT%\dist"

echo [6/6] PyInstaller ONEDIR EXE olusturuluyor...
REM PyInstaller'i kaynak klasorune gecerek calistir; System32'ye dusmesine izin verme.
pushd "%PROJECT%" >nul 2>nul
if errorlevel 1 (
  echo HATA: Kaynak klasorune gecilemedi: %PROJECT%
  goto :fail_from_project
)

"%VENV%\Scripts\python.exe" -m PyInstaller ^
  --clean ^
  --noconfirm ^
  --distpath "%PROJECT%\dist" ^
  --workpath "%PROJECT%\build" ^
  "%SPEC%"
set "RC=!ERRORLEVEL!"
popd

if not "!RC!"=="0" goto :fail

if not exist "%PROJECT%\dist\SporAnalizMerkezi\SporAnalizMerkezi.exe" (
  echo HATA: PyInstaller tamamlandi ancak EXE bulunamadi.
  goto :fail
)

echo.
echo ============================================================
echo  BUILD BASARILI
echo ============================================================
echo.
echo EXE:
echo %PROJECT%\dist\SporAnalizMerkezi\SporAnalizMerkezi.exe
echo.
echo Dagitacagin klasor:
echo %PROJECT%\dist\SporAnalizMerkezi
echo.
echo ONEMLI:
echo - Sadece EXE'yi degil SporAnalizMerkezi klasorunun TAMAMINI tasi.
echo - Token/API key dosyalari EXE'ye gomulmedi ve bu build araci onlara dokunmadi.
echo - Mevcut %%LOCALAPPDATA%%\HizirBeySports anahtarlari aynen kalir.
echo ============================================================
echo.
popd
pause
exit /b 0

:fail_from_project
REM PROJECT pushd basarisizsa ana ROOT pushd hala aktiftir.
goto :fail

:fail
echo.
echo ============================================================
echo  BUILD BASARISIZ
 echo Yukaridaki ilk HATA/ERROR satirlarini paylas.
echo ============================================================
echo.
popd
pause
exit /b 1
