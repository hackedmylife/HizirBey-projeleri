# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_all

datas = [
    ('hizir_bey_header.png', '.'),
    ('hizir_bey_transparent.png', '.'),
    ('premium_header_art.png', '.'),
    ('premium_app_badge.png', '.'),
    ('groq_web_config.json', '.'),
]
binaries = []
hiddenimports = [
    "PIL",
    "PIL.Image",
    "PIL.ImageTk",
    "analyzer",
    "market_options",
    "sports_config",
    "esports_sources",
    "sofascore_web",
    "groq_web_fallback",
    "fetchers",
    "fetchers.scraper",
]

try:
    d, b, h = collect_all("curl_cffi")
    datas += d
    binaries += b
    hiddenimports += h
except Exception:
    pass

try:
    d, b, h = collect_all("certifi")
    datas += d
    binaries += b
    hiddenimports += h
except Exception:
    pass

a = Analysis(
    ["gui.py"],
    pathex=[],
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

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="FutbolMacAnaliz",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
