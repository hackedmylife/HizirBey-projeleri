"""CPU microphone -> reference-selected speech -> VB-CABLE. No raw fallback."""
import argparse
import configparser
import hashlib
import os
from pathlib import Path
import queue
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
os.environ["CUDA_VISIBLE_DEVICES"] = ""
import numpy as np
import worker
from dsp import RATE, AudioRing, WindowedFilter, calibrate, resample


def one_line(text):
    return str(text).replace("\r", " ").replace("\n", " ")


def state(root, phase, message):
    temporary = root / "state.tmp"
    temporary.write_text(f"phase={phase}\nmessage={one_line(message)}\n", encoding="utf-8")
    for attempt in range(10):
        try:
            temporary.replace(root / "state.txt")
            break
        except PermissionError:
            if attempt == 9:
                raise
            time.sleep(0.01)


def read_settings(root):
    parser = configparser.ConfigParser(interpolation=None)
    path = root / "config.ini"
    raw = path.read_bytes()
    encoding = "utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
    parser.read_string(raw.decode(encoding))
    return dict(parser["filter"])


def devices(module=None):
    if module is None:
        import sounddevice as module
    apis = module.query_hostapis()
    found = []
    for index, item in enumerate(module.query_devices()):
        host = one_line(apis[item["hostapi"]]["name"])
        name = one_line(item["name"])
        if host != "Windows WASAPI":
            continue
        kind = None
        if item["max_input_channels"] > 0 and "cable" not in name.lower() and "mapper" not in name.lower() and "stereo mix" not in name.lower():
            kind = "input"
        if item["max_output_channels"] > 0 and "cable input" in name.lower():
            kind = "output"
        if kind:
            found.append({"id": index, "name": name, "host": host, "kind": kind,
                          "rate": int(round(item["default_samplerate"])),
                          "channels": item["max_input_channels"] if kind == "input" else item["max_output_channels"]})
    return found


def write_devices(root):
    rows = []
    for item in devices():
        rows.append("\t".join(str(item[k]).replace("\t", " ") for k in ["kind", "id", "name", "host"]))
    (root / "devices.txt").write_text("\n".join(rows), encoding="utf-8")


def resolve_devices(settings, available):
    if settings.get("confirmed") != "1":
        raise ValueError("Win+H mikrofonunu CABLE Output olarak seçip ayarı onayla.")
    selected = []
    for kind in ["input", "output"]:
        matches = [x for x in available if x["kind"] == kind and x["name"] == settings.get(kind + "_name") and x["host"] == settings.get(kind + "_host")]
        if len(matches) != 1:
            raise ValueError("Mikrofon / CABLE aygıtı bulunamadı; Filtre ayarları'nı yenile.")
        selected.append(matches[0])
    if selected[0]["id"] == selected[1]["id"] or "cable" in selected[0]["name"].lower() or "cable input" not in selected[1]["name"].lower():
        raise ValueError("Ses geri beslemesini önlemek için gerçek mikrofon ve CABLE Input seçilmeli.")
    return selected


class Selector:
    def __init__(self, root, cache, reference):
        import torch
        self.torch = torch
        state(root, "warming", "Ses profilin hazırlanıyor · Mikrofon henüz açık değil")
        self.separator, self.encoder = worker.models(cache)
        audio, _ = worker.load_audio(reference, 5, 60)
        key = hashlib.sha256(Path(reference).read_bytes() + worker.ENCODER_GIT_BLOB.encode() + b"profile-v1").hexdigest()
        profile = root / "profile.npz"
        self.reference = None
        if profile.exists():
            try:
                with np.load(profile, allow_pickle=False) as data:
                    embedding = data["embedding"]
                    if str(data["key"]) == key and embedding.shape == (256,) and np.isfinite(embedding).all():
                        self.reference = embedding.copy()
            except (ValueError, KeyError, OSError):
                pass
        # Always warm the feature / LSTM path before opening any microphone.
        starts = range(0, max(1, len(audio) - 3 * RATE + 1), RATE)
        loudest = max(starts, key=lambda i: float(np.mean(audio[i:i + 3 * RATE] ** 2)))
        warm = worker.embedding(self.encoder, audio[loudest:loudest + 3 * RATE])
        if warm is None:
            raise ValueError("Referansta yeterli konuşma bulunamadı; sessiz ortamda yeniden kaydet.")
        if self.reference is None:
            self.reference = worker.embedding(self.encoder, audio)
            if self.reference is None:
                raise ValueError("Referansta yeterli konuşma bulunamadı.")
            with open(root / "profile.tmp", "wb") as handle:
                np.savez(handle, key=np.array(key), embedding=self.reference)
            (root / "profile.tmp").replace(profile)
        with torch.inference_mode():
            self.separator(torch.zeros(1, 1, 24000))

    def __call__(self, block, actual):
        low = resample(block, RATE, 8000)
        with self.torch.inference_mode():
            stems = self.separator(self.torch.from_numpy(low).reshape(1, 1, -1))[0].cpu().numpy()
        candidates = np.array([resample(x, 8000, RATE) for x in stems], dtype=np.float32)
        if candidates.shape != (2, 48000) or not np.isfinite(candidates).all():
            raise ValueError("Ayırıcı geçersiz ses döndürdü.")
        scores = []
        for candidate in candidates:
            vector = worker.embedding(self.encoder, candidate[:actual])
            scores.append(float(np.dot(vector, self.reference)) if vector is not None else -1.0)
        selected = worker.choose_source(scores)
        if selected is None:
            return np.zeros(48000, dtype=np.float32)
        return calibrate(candidates, block, actual)[selected]


def command(root):
    try:
        return (root / "command.txt").read_text(encoding="utf-8-sig").strip()
    except FileNotFoundError:
        return ""


def run_audio(root, settings, selector, selected):
    import sounddevice as sd
    source, target = selected
    input_rate, output_rate = source["rate"], target["rate"]
    channels = min(2, target["channels"])
    sd.check_input_settings(device=source["id"], channels=1, dtype="float32", samplerate=input_rate)
    sd.check_output_settings(device=target["id"], channels=channels, dtype="float32", samplerate=output_rate)
    inputs = queue.Queue(maxsize=60)
    output = AudioRing(output_rate * 8)
    failure = []
    processor = WindowedFilter(selector, input_rate)

    def capture(indata, frames, timing, flags):
        if flags.input_overflow:
            failure.append("Mikrofon akışı aksadı; dikte durduruldu.")
        try:
            inputs.put_nowait(indata[:, 0].copy())
        except queue.Full:
            failure.append("İşlemci ses akışına yetişemedi; dikte durduruldu.")

    def render(outdata, frames, timing, flags):
        samples = output.read(frames)
        outdata[:] = samples[:, None]

    def enqueue(chunks):
        for chunk in chunks:
            output.push(resample(chunk, RATE, output_rate))

    with sd.OutputStream(device=target["id"], samplerate=output_rate, channels=channels,
                         dtype="float32", latency=0.1, callback=render) as speaker:
        with sd.InputStream(device=source["id"], samplerate=input_rate, channels=1,
                            dtype="float32", blocksize=max(1, input_rate // 10), latency=0.1, callback=capture) as microphone:
            state(root, "running", "Filtre açık · Ses yaklaşık 3–4 saniye gecikmeli aktarılır")
            while command(root).startswith("start"):
                if failure:
                    raise RuntimeError(failure[0])
                if not microphone.active or not speaker.active:
                    raise RuntimeError("Ses aygıtı kapandı; dikte durduruldu.")
                try:
                    data = inputs.get(timeout=0.05)
                except queue.Empty:
                    continue
                enqueue(processor.push(data))
            state(root, "draining", "Son kelimeler aktarılıyor…")
        # Input is now closed. Complete the overlap tail before telling Win+H to stop.
        if command(root).startswith("quit"):
            return
        if failure:
            raise RuntimeError(failure[0])
        while not inputs.empty():
            enqueue(processor.push(inputs.get_nowait()))
        enqueue(processor.finish())
        deadline = time.monotonic() + 8
        while output.size():
            if command(root).startswith("quit"):
                return
            if time.monotonic() > deadline or not speaker.active:
                raise RuntimeError("Son ses aktarımı tamamlanamadı; dikte durduruldu.")
            time.sleep(0.02)
        # Keep the recognizer open through device latency and a short quiet tail.
        time.sleep(1.0)
    state(root, "stopped", "Durduruldu · Metin kutuda")


def serve(root, cache):
    settings = read_settings(root)
    selected = resolve_devices(settings, devices())
    selector = Selector(root, cache, settings["reference"])
    state(root, "ready", "Ses profili hazır · Başlat / Win+H")
    last = ""
    while True:
        action = command(root)
        if action.startswith("quit"):
            return
        if action.startswith("start") and action != last:
            last = action
            run_audio(root, settings, selector, selected)
        time.sleep(0.05)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["prepare", "devices", "serve"])
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--cache-root", required=True, type=Path)
    args = parser.parse_args()
    args.root.mkdir(parents=True, exist_ok=True)
    try:
        if args.action == "prepare":
            worker.prepare(args.cache_root)
            write_devices(args.root)
            (args.root / "ready.txt").write_text("cpu-sounddevice-0.5.1", encoding="utf-8")
            state(args.root, "devices", "Hazır · Mikrofonunu, CABLE Input ve ses referansını seç")
        elif args.action == "devices":
            write_devices(args.root)
            state(args.root, "devices", "Aygıt listesi yenilendi")
        else:
            serve(args.root, args.cache_root)
    except Exception as exc:
        state(args.root, "error", str(exc)[:350])
        raise


if __name__ == "__main__":
    main()
