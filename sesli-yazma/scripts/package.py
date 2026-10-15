#!/usr/bin/env python3
"""Build a reproducible, credential-free unpacked Chrome extension archive."""
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
EXTENSION = ROOT / 'extension'
VERSION = json.loads((EXTENSION / 'manifest.json').read_text())['version']
NAME = f'Hizir-Bey-Sesli-Yazma-{VERSION}'
DESTINATION = REPO / 'paketler' / f'{NAME}.zip'
SECRET = re.compile(rb'\b(?:gsk_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|sk-or-[A-Za-z0-9]{20,})\b')

def main():
    files = sorted(path for path in EXTENSION.rglob('*') if path.is_file())
    files += [ROOT / name for name in ('KURULUM.txt', 'README.md', 'SURUM-NOTLARI.md', 'TEST-RAPORU.md')]
    files += [ROOT / 'windows' / name for name in ('Hizir-Bey-Win-H.ahk', 'Windows-Kisayol.txt')]
    for path in files:
        if not path.is_file():
            raise RuntimeError(f'Missing release document: {path.name}')
        if path.suffix.lower() not in ('.js', '.json', '.html', '.css', '.png', '.md', '.txt', '.ahk'):
            raise RuntimeError(f'Unexpected extension asset: {path.name}')
        if re.search(r'(?:credential|token|api.?key|\.env)', path.name, re.I):
            raise RuntimeError(f'Credential-like file name: {path.name}')
        if SECRET.search(path.read_bytes()):
            raise RuntimeError(f'Possible literal credential: {path.name}')
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(DESTINATION, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            info = ZipInfo(f'{NAME}/{path.relative_to(ROOT).as_posix()}', (2026, 10, 15, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    with ZipFile(DESTINATION) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(files)
        for name in archive.namelist():
            assert '..' not in Path(name).parts
            assert not SECRET.search(archive.read(name))
    digest = hashlib.sha256(DESTINATION.read_bytes()).hexdigest()
    print(json.dumps({'file': str(DESTINATION), 'files': len(files), 'bytes': DESTINATION.stat().st_size, 'sha256': digest}))

if __name__ == '__main__':
    main()
