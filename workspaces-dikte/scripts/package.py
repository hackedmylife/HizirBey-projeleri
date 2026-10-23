"""Deterministic, allowlisted package. Run with Python's standard library only."""

import argparse
import hashlib
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.2.0"
RUNTIME_SHA256 = "2eab99848ebc07f8ab0cc448bf69af8c700b2fc7fcd1ff8794df743dcc58da51"
FILES = [
    "BASLAT.cmd",
    "Hizir-Bey-WorkSpaces-Dikte.ahk",
    "KULLANIM.txt",
    "README.md",
    "TEST-RAPORU.md",
    "src/Core.ahk",
    "src/Panel.ahk",
    "scripts/package.py",
    "tests/windows-tests.ahk",
    "tests/bridge-browser.mjs",
    "livechat-kopru/manifest.json",
    "livechat-kopru/editor.js",
    "livechat-kopru/content.js",
    "livechat-kopru/background.js",
    "vendor/AutoHotkey64.exe",
    "vendor/license.txt",
    "vendor/PROVENANCE.txt",
]


def validate():
    for relative in FILES:
        path = ROOT / relative
        if not path.is_file():
            raise ValueError(f"Missing package file: {relative}")
        if path.suffix.lower() != ".exe":
            content = path.read_text(encoding="utf-8-sig")
            if re.search(r"gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,}|(?m:^-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----$)", content):
                raise ValueError(f"Credential-like content found: {relative}")
    import json
    manifest = json.loads((ROOT / "livechat-kopru/manifest.json").read_text(encoding="utf-8"))
    if manifest["version"] != VERSION or "clipboardRead" in manifest["permissions"]:
        raise ValueError("Unexpected bridge version or clipboard read permission")
    digest = hashlib.sha256((ROOT / "vendor/AutoHotkey64.exe").read_bytes()).hexdigest()
    if digest != RUNTIME_SHA256:
        raise ValueError("Portable runtime SHA-256 mismatch")
    print(f"Verified {len(FILES)} allowlisted files and official runtime SHA-256")


def package(destination):
    validate()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for relative in sorted(FILES):
            entry = zipfile.ZipInfo(f"Hizir-Bey-WorkSpaces-Dikte-{VERSION}/{relative}", (2026, 10, 23, 12, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            data = (ROOT / relative).read_bytes()
            if relative.endswith(".cmd"):
                data = data.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
            archive.writestr(entry, data)
    with zipfile.ZipFile(destination) as archive:
        if archive.testzip():
            raise ValueError("ZIP CRC verification failed")
        if len(archive.infolist()) != len(FILES):
            raise ValueError("Unexpected archive members")
    print(f"Created {destination.name}: {destination.stat().st_size:,} bytes")
    print(f"SHA256 {hashlib.sha256(destination.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT.parent / "paketler" / f"Hizir-Bey-WorkSpaces-Dikte-{VERSION}.zip")
    args = parser.parse_args()
    if args.check:
        validate()
    else:
        package(args.output)
