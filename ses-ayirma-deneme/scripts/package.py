"""Explicit source-only allowlist; no model, environment or user data files."""
import argparse
import hashlib
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "Hizir-Bey-CPU-Ses-Testi.ahk", "bootstrap.ps1", "README.md", "NOTICE.txt", "TEST-RAPORU.md",
    "assets/hizirbey.ico", "engine/worker.py", "engine/resemblyzer/__init__.py",
    "engine/resemblyzer/audio.py", "engine/resemblyzer/hparams.py", "engine/resemblyzer/voice_encoder.py",
    "licenses/AutoHotkey-GPL.txt", "licenses/GPL-3.0.txt", "licenses/Resemblyzer-APACHE.txt",
    "scripts/build-exe.ps1", "scripts/package.py", "tests/test_worker.py", "tests/model_check.py",
    "tests/windows-tests.ahk", "tests/capture.ps1",
]
PATTERN = re.compile(rb"gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")


def package(output):
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for relative in sorted(FILES):
            data = (ROOT / relative).read_bytes()
            if PATTERN.search(data):
                raise ValueError("Credential-like content in " + relative)
            entry = zipfile.ZipInfo("Hizir-Bey-CPU-Ses-Testi-0.1.0/" + relative, (2026, 10, 24, 12, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            archive.writestr(entry, data)
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None and len(archive.infolist()) == len(FILES)
        for name in archive.namelist():
            assert not PATTERN.search(archive.read(name))
    print(output.name, output.stat().st_size, hashlib.sha256(output.read_bytes()).hexdigest())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT.parent / "paketler/Hizir-Bey-CPU-Ses-Testi-0.1.0-kaynak.zip")
    package(parser.parse_args().output)
