import os
from pathlib import Path
import subprocess
import sys
import venv


def main():
    if sys.platform != "win32":
        raise RuntimeError("Bu derleyici Windows bilgisayarda calistirilmalidir.")
    if sys.version_info < (3, 9):
        raise RuntimeError("Python 3.9 veya daha yeni bir surum gerekli.")
    import tkinter
    root = tkinter.Tk()
    root.withdraw()
    root.destroy()
    directory = Path(__file__).resolve().parent
    os.chdir(directory)
    compile((directory / "hesapla.py").read_text(encoding="utf-8"), "hesapla.py", "exec")
    environment = directory / ".build-venv"
    python = environment / "Scripts" / "python.exe"
    if not python.exists():
        print("Yalitimli derleme ortami hazirlaniyor...", flush=True)
        venv.EnvBuilder(with_pip=True).create(environment)
    subprocess.run([str(python), "-m", "pip", "install", "PyInstaller==6.22.3"], check=True)
    subprocess.run([
        str(python), "-m", "PyInstaller", "--noconfirm", "--clean",
        "--onefile", "--windowed", "--noupx", "--name", "HizirBey_Hesaplayici",
        "--icon", str(directory / "hizirbey.ico"), str(directory / "hesapla.py")
    ], check=True)
    executable = directory / "dist" / "HizirBey_Hesaplayici.exe"
    if not executable.is_file() or executable.stat().st_size < 1024:
        raise RuntimeError("EXE olusturulamadi.")
    print("\nTAMAMLANDI: " + str(executable), flush=True)
    if not os.environ.get("CI"):
        os.startfile(str(executable.parent))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("\nDERLEME HATASI: " + str(error), file=sys.stderr)
        sys.exit(1)
