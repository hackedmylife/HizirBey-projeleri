#!/usr/bin/env python3
"""Restore pinned dependencies excluded from the public source backup."""
from pathlib import Path
import hashlib, os, subprocess, tarfile, tempfile, urllib.request, shutil
ROOT=Path(__file__).resolve().parent

def fetch(url,path,digest):
    path.parent.mkdir(parents=True,exist_ok=True)
    if path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest()==digest:return
    temp=path.with_suffix(path.suffix+'.part')
    with urllib.request.urlopen(url,timeout=120) as source,temp.open('wb') as out:
        while data:=source.read(1048576):out.write(data)
    if hashlib.sha256(temp.read_bytes()).hexdigest()!=digest:
        temp.unlink();raise RuntimeError('Checksum mismatch: '+path.name)
    temp.replace(path)

def main():
    fetch('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin',ROOT/'app/src/main/assets/models/ggml-base-q5_1.bin','422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898')
    fetch('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin',ROOT/'app/src/main/assets/models/ggml-tiny.en-q5_1.bin','c77c5766f1cef09b6b7d47f21b546cbddd4157886b3b5d6d4f709e91e66c7c2b')
    fetch('https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/mkd.traineddata',ROOT/'app/src/main/assets/tessdata/mkd.traineddata','58622bf154830fa62103359938564aeb8112b929759e22a48224f3ecfaac34c6')
    fetch('https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin',ROOT/'app/src/main/assets/models/ggml-silero-v5.1.2.bin','29940d98d42b91fbd05ce489f3ecf7c72f0a42f027e4875919a28fb4c04ea2cf')
    if not (ROOT/'vendor/include/whisper.h').exists():
        with tempfile.TemporaryDirectory() as directory:
            archive=Path(directory)/'whisper.tar.gz'
            fetch('https://github.com/ggml-org/whisper.cpp/archive/refs/tags/v1.7.6.tar.gz',archive,'166140e9a6d8a36f787a2bd77f8f44dd64874f12dd8359ff7c1f4f9acb86202e')
            with tarfile.open(archive,'r:gz') as tar:
                for item in tar:
                    parts=Path(item.name).parts[1:]
                    if not parts or item.issym() or item.islnk():continue
                    path=ROOT/'vendor'/Path(*parts)
                    if not path.resolve().is_relative_to((ROOT/'vendor').resolve()):raise RuntimeError('Unsafe archive path')
                    if item.isdir():path.mkdir(parents=True,exist_ok=True)
                    elif item.isfile():
                        path.parent.mkdir(parents=True,exist_ok=True)
                        with tar.extractfile(item) as source,path.open('wb') as out:out.write(source.read())
    fixture=ROOT/'app/src/androidTest/assets/jfk.wav'
    fixture.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(ROOT/'vendor/samples/jfk.wav',fixture)
    key=ROOT/'signing/hizirbey-test.keystore'
    if not key.exists():
        key.parent.mkdir(parents=True,exist_ok=True)
        tool=Path(os.environ.get('JAVA_HOME',''))/'bin/keytool'
        subprocess.run([str(tool) if tool.is_file() else 'keytool','-genkeypair','-keystore',str(key),'-alias','androiddebugkey','-keyalg','RSA','-keysize','2048','-validity','10000','-storepass','android','-keypass','android','-dname','CN=Local Test Build, O=Hizir Bey, C=TR','-noprompt'],check=True)
        print('New LOCAL key generated. Restore your original private key for updates over the supplied APK.')
    print('Pinned dependencies ready.')
if __name__=='__main__':main()
