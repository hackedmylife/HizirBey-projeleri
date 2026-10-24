"""Source-only delivery. Explicit files exclude private audio, models and runtime."""
from pathlib import Path
import hashlib
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "Hizir-Bey-Filtreli-Dikte.ahk", "bootstrap.ps1", "README.md", "NOTICE.txt", "TEST-RAPORU.md",
    "assets/logo.png", "assets/hizirbey.ico",
    "licenses/AutoHotkey-GPL.txt", "licenses/GPL-3.0.txt", "licenses/Resemblyzer-APACHE.txt",
    "src/Assets.ahk", "src/Core.ahk", "src/Panel.ahk", "src/Theme.ahk", "src/Process.ahk", "src/Filter.ahk",
    "engine/worker.py", "engine/service.py", "engine/dsp.py",
    "engine/resemblyzer/__init__.py", "engine/resemblyzer/audio.py",
    "engine/resemblyzer/hparams.py", "engine/resemblyzer/voice_encoder.py",
    "scripts/build-exe.ps1", "scripts/package.py",
    "tests/windows-tests.ahk", "tests/compiled-tests.ahk", "tests/filter-flow.ahk",
    "tests/drag-driver.ahk", "tests/keys-driver.ahk", "tests/capture.ps1",
    "tests/test_stream.py", "tests/model_stream.py",
]

if __name__ == "__main__":
    output = ROOT.parent / "paketler/Hizir-Bey-Filtreli-Dikte-0.1.0-kaynak.zip"
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in FILES:
            data = (ROOT / name).read_bytes()
            member = zipfile.ZipInfo("filtreli-dikte/" + name, (2026, 10, 24, 0, 0, 0))
            member.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(member, data)
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(FILES)
        for name in archive.namelist():
            assert not any(part in name.lower() for part in [".wav", ".npz", ".pt", ".env", "__pycache__", "config.ini"])
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    print(f"SOURCE_ZIP {output.name} {output.stat().st_size} bytes SHA256 {digest}")
