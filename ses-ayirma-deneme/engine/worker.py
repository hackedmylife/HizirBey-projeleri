"""CPU-only experimental separation + reference-based source selection.

This is an offline benchmark, not a microphone driver or a Win+H integration.
No input audio, voice profile, or derived embedding is uploaded.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import time
import urllib.request

os.environ["CUDA_VISIBLE_DEVICES"] = ""
RATE = 16000
SEPARATOR_RATE = 8000
THRESHOLD = 0.60
MARGIN = 0.08
_CPU_CONFIGURED = False
RES_COMMIT = "15d828edebe06bc72b9cabc8ef8ca5ab2cb457ce"
SEPARATOR_URL = "https://download.pytorch.org/torchaudio/models/conv_tasnet_base_libri2mix.pt"
SEPARATOR_SHA256 = "ddf97d8341f616c6d8d1a4b20dd51042760392c6543e9eaac276c9f96eba0f0e"
ENCODER_URL = f"https://raw.githubusercontent.com/resemble-ai/Resemblyzer/{RES_COMMIT}/resemblyzer/pretrained.pt"
ENCODER_GIT_BLOB = "47e405a459e4b97a21325dc78ba6f8270498ac06"


def write_json(path, value):
    path = Path(path)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(path)


def status(root, message):
    root.mkdir(parents=True, exist_ok=True)
    temp = root / "status.tmp"
    temp.write_text(message, encoding="utf-8")
    temp.replace(root / "status.txt")


def download(url, target, *, sha256=None, git_blob=None):
    def valid(data):
        if sha256 and hashlib.sha256(data).hexdigest() != sha256:
            return False
        if git_blob:
            digest = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
            if digest != git_blob:
                return False
        return True

    if target.exists() and valid(target.read_bytes()):
        return
    request = urllib.request.Request(url, headers={"User-Agent": "HizirBey-CPU-Test/0.1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read(80 * 1024 * 1024 + 1)
    if len(data) > 80 * 1024 * 1024 or not valid(data):
        raise ValueError("Model indirme bütünlük kontrolü başarısız.")
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".download")
    temporary.write_bytes(data)
    temporary.replace(target)


def prepare(root):
    status(root, "CPU modelleri hazırlanıyor; ilk kullanımda indirme yapılır…")
    download(SEPARATOR_URL, root / "models/separator.pt", sha256=SEPARATOR_SHA256)
    download(ENCODER_URL, root / "models/encoder.pt", git_blob=ENCODER_GIT_BLOB)
    # Check imports in the actual isolated runtime before declaring readiness.
    import torch
    import torchaudio
    import librosa
    import soundfile
    import webrtcvad
    if torch.version.cuda is not None:
        raise RuntimeError("Bu deneme yalnız CPU çalışma paketi kullanır.")
    write_json(root / "ready.json", {"version": "0.1.0", "device": "cpu", "torch": torch.__version__})
    status(root, "Hazır · Önce sessiz ortamda ses referansını kaydet.")


def load_audio(path, minimum, maximum):
    import numpy as np
    import soundfile as sf
    from scipy.signal import resample_poly

    info = sf.info(str(path))
    if not (minimum <= info.duration <= maximum) or info.channels > 8:
        raise ValueError(f"Kayıt süresi {minimum}–{maximum} saniye arasında olmalı.")
    data, sr = sf.read(str(path), dtype="float32", always_2d=True)
    data = data.mean(axis=1)
    if sr != RATE:
        divisor = math.gcd(sr, RATE)
        data = resample_poly(data, RATE // divisor, sr // divisor).astype("float32")
    if not np.isfinite(data).all():
        raise ValueError("Kayıtta geçersiz örnekler var.")
    rms = float(np.sqrt(np.mean(data * data)))
    if rms < 0.0005:
        raise ValueError("Kayıt sessiz veya çok düşük seviyede; mikrofonu kontrol et.")
    return data, {"seconds": len(data) / RATE, "rms_dbfs": 20 * math.log10(rms),
                  "clipped_fraction": float(np.mean(np.abs(data) >= 0.999))}


def choose_source(scores, threshold=THRESHOLD, margin=MARGIN):
    """Unknown/ambiguous speakers produce silence, never a raw-audio fallback."""
    if len(scores) != 2 or not all(math.isfinite(x) for x in scores):
        return None
    best = 0 if scores[0] >= scores[1] else 1
    if scores[best] < threshold or scores[best] - scores[1 - best] < margin:
        return None
    return best


def models(root):
    import torch
    from torchaudio.models import conv_tasnet_base
    from resemblyzer import VoiceEncoder

    global _CPU_CONFIGURED
    if not _CPU_CONFIGURED:
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        torch.set_num_interop_threads(1)
        _CPU_CONFIGURED = True
    separator = conv_tasnet_base(num_sources=2)
    separator.load_state_dict(torch.load(root / "models/separator.pt", map_location="cpu", weights_only=True))
    separator.to("cpu").eval()
    encoder = VoiceEncoder(device="cpu", verbose=False, weights_fpath=root / "models/encoder.pt")
    encoder.eval()
    return separator, encoder


def embedding(encoder, data):
    import numpy as np
    from resemblyzer import preprocess_wav

    if len(data) < RATE // 2 or np.sqrt(np.mean(data * data)) < 0.0001:
        return None
    peak = float(np.max(np.abs(data)))
    data = data * min(1.0, 0.98 / peak) if peak > 0 else data
    clean = preprocess_wav(data.copy(), source_sr=RATE)
    if len(clean) < RATE // 2:
        return None
    result = encoder.embed_utterance(clean)
    return result if np.isfinite(result).all() else None


def extract(root, reference_path, mixture_path, destination):
    import numpy as np
    import soundfile as sf
    import torch
    from scipy.signal import resample_poly

    status(root, "Kayıtlar ve CPU modelleri açılıyor…")
    reference, ref_info = load_audio(reference_path, 5, 60)
    mixture, mix_info = load_audio(mixture_path, 3, 60)
    separator, encoder = models(root)
    load_finished = time.perf_counter()
    ref_embedding = embedding(encoder, reference)
    if ref_embedding is None:
        raise ValueError("Referansta yeterli konuşma yok; sessiz ortamda yeniden kaydet.")
    reference_seconds = time.perf_counter() - load_finished
    window = 3 * RATE
    hop = 2 * RATE
    signal = np.zeros(len(mixture), dtype=np.float64)
    weights = np.zeros(len(mixture), dtype=np.float64)
    blocks = []
    started = time.perf_counter()
    for start in range(0, len(mixture), hop):
        segment = mixture[start:start + window]
        actual = len(segment)
        if actual < RATE and start:
            break  # previous overlapping window already covers this tail
        if actual < window:
            segment = np.pad(segment, (0, window - actual))
        block_started = time.perf_counter()
        low = resample_poly(segment, 1, 2).astype("float32")
        with torch.inference_mode():
            separated = separator(torch.from_numpy(low).reshape(1, 1, -1))[0].cpu().numpy()
        if separated.shape != (2, window // 2) or not np.isfinite(separated).all():
            raise ValueError("Ayırma modelinin çıktısı geçersiz.")
        candidates = [resample_poly(x, 2, 1).astype("float32")[:window] for x in separated]
        scores = []
        for candidate in candidates:
            emb = embedding(encoder, candidate[:actual])
            scores.append(float(np.dot(emb, ref_embedding)) if emb is not None else -1.0)
        selected = choose_source(scores)
        chosen = candidates[selected] if selected is not None else np.zeros(window, dtype="float32")
        # Shared gain/overlap: independently normalizing each block would pump noise.
        fade = np.hanning(window + 2)[1:-1][:actual]
        signal[start:start + actual] += chosen[:actual] * fade
        weights[start:start + actual] += fade
        elapsed = time.perf_counter() - block_started
        blocks.append({"start_seconds": start / RATE, "duration_seconds": actual / RATE,
                       "scores": scores, "selected": selected, "processing_seconds": elapsed})
        status(root, f"CPU ayırma · {min(start + actual, len(mixture)) / RATE:.0f} / {len(mixture) / RATE:.0f} sn")
    processing = time.perf_counter() - started
    output = np.divide(signal, weights, out=np.zeros_like(signal), where=weights > 1e-10).astype("float32")
    peak = float(np.max(np.abs(output))) if len(output) else 0.0
    gain = min(1.0, 0.98 / peak) if peak > 0 else 1.0
    output *= gain
    destination.mkdir(parents=True, exist_ok=True)
    sf.write(str(destination / "ham.wav"), mixture, RATE, subtype="PCM_16")
    sf.write(str(destination / "ayrilmis.wav"), output, RATE, subtype="PCM_16")
    duration = len(mixture) / RATE
    report = {"version": "0.1.0", "device": "cpu", "threads": torch.get_num_threads(),
              "method": "ConvTasNet two-source separation + Resemblyzer reference selection",
              "reference": ref_info, "mixture": mix_info, "reference_processing_seconds": reference_seconds,
              "processing_seconds": processing, "audio_seconds": duration, "rtf": processing / duration,
              "window_seconds": 3, "hop_seconds": 2, "threshold": THRESHOLD, "margin": MARGIN,
              "selected_blocks": sum(x["selected"] is not None for x in blocks), "blocks": blocks,
              "output_gain": gain, "streaming_tested": False,
              "limits": "Offline, two speech sources, 8 kHz separator; music/TV/Turkish not validated. Thresholds are experimental. RTF is not end-to-end dictation latency."}
    write_json(destination / "rapor.json", report)
    status(root, f"Bitti · {duration:.1f} sn kayıt / {processing:.1f} sn işlem · RTF {processing / duration:.2f} · Sonuçları dinle.")
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["prepare", "extract"])
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--reference", type=Path)
    parser.add_argument("--mixture", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        if args.action == "prepare":
            prepare(args.root)
        else:
            if not all([args.reference, args.mixture, args.output]):
                raise ValueError("Referans, karışık kayıt ve çıktı yolu gerekli.")
            report = extract(args.root, args.reference, args.mixture, args.output)
            print(json.dumps({k: report[k] for k in ["device", "processing_seconds", "audio_seconds", "rtf", "selected_blocks"]}))
    except Exception as exc:
        status(args.root, "İşlem tamamlanamadı: " + str(exc)[:350])
        raise


if __name__ == "__main__":
    main()
