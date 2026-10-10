# -*- mode: python ; coding: utf-8 -*-

import os
from PyInstaller.utils.hooks import collect_all, collect_submodules

APP_DIR = os.environ.get("HIZIR_PROJECT_DIR", "").strip()
if not APP_DIR:
    raise RuntimeError("HIZIR_PROJECT_DIR tanimli degil. EXE_OLUSTUR_ONEFILE.bat ile calistirin.")
APP_DIR = os.path.abspath(APP_DIR)


def app_path(name):
    return os.path.join(APP_DIR, name)


# Sadece uygulamanin gercek asset/config dosyalari eklenir.
# Token/API key dosyalari KASITLI OLARAK bu listeye alinmaz.
datas = []
for filename in (
    "hizir_bey_header.png",
    "hizir_bey_reference_logo.png",
    "hizir_bey_transparent.png",
    "premium_header_art.png",
    "premium_score_hero.png",
    "premium_app_badge.png",
    "groq_web_config.json",
):
    full = app_path(filename)
    if os.path.exists(full):
        datas.append((full, "."))

binaries = []
hiddenimports = [
    "PIL",
    "PIL.Image",
    "PIL.ImageTk",
    "requests",
    "urllib3",
]

# Proje kokundeki tum Python modullerini guvenceye al.
# Bu sayede yeni fallback/source modulleri eklendiginde spec'i tek tek guncellemek gerekmez.
for filename in os.listdir(APP_DIR):
    if filename.endswith(".py") and filename != "gui.py" and not filename.startswith("_"):
        hiddenimports.append(filename[:-3])

# Alt paketler.
for package_name in ("fetchers",):
    package_dir = app_path(package_name)
    if os.path.isdir(package_dir):
        hiddenimports.append(package_name)
        try:
            hiddenimports += collect_submodules(package_name)
        except Exception:
            pass

# Binary/DLL/veri kullanan kutuphaneleri tam topla.
for module_name in ("curl_cffi", "certifi"):
    try:
        d, b, h = collect_all(module_name)
        datas += d
        binaries += b
        hiddenimports += h
    except Exception:
        pass

try:
    hiddenimports += collect_submodules("curl_cffi")
except Exception:
    pass

hiddenimports = list(dict.fromkeys(hiddenimports))

icon_path = app_path("app_icon.ico")
if not os.path.exists(icon_path):
    icon_path = None

a = Analysis(
    [app_path("gui.py")],
    pathex=[APP_DIR],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

# ONEFILE: binary + datas dogrudan EXE paketine girer; COLLECT yoktur.
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="SporAnalizMerkezi",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icon_path,
)
