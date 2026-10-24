"""Real CPU inference using public CC-BY LibriSpeech clips, not user audio."""
import json
import os
from pathlib import Path
import sys
import tempfile
import urllib.request

engine = Path(__file__).parents[1] / "engine"
sys.path.insert(0, str(engine))
import worker
import numpy as np
import soundfile as sf

root = Path(sys.argv[1])
worker.prepare(root)
with tempfile.TemporaryDirectory(prefix="Cpu Public Samples ") as directory:
    temp = Path(directory)
    names = ["1688/1688-142285-0000.flac", "1688/1688-142285-0001.flac", "1998/1998-15444-0000.flac"]
    loaded = []
    for index, name in enumerate(names):
        url = f"https://raw.githubusercontent.com/resemble-ai/Resemblyzer/{worker.RES_COMMIT}/audio_data/librispeech_test-other/{name}"
        path = temp / f"public-{index}.flac"
        with urllib.request.urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())
        audio, sr = sf.read(path, dtype="float32")
        assert sr == 16000 and len(audio) >= 6 * sr
        loaded.append(audio)
    reference, target, interference = loaded
    length = 6 * 16000
    def normalize(data):
        return data / max(float(np.sqrt(np.mean(data * data))), 1e-6) * .08
    mixture = normalize(target[:length]) + normalize(interference[:length])
    sf.write(temp / "reference.wav", reference[:10 * 16000], 16000)
    sf.write(temp / "mixture.wav", mixture, 16000)
    report = worker.extract(root, temp / "reference.wav", temp / "mixture.wav", temp / "output")
    output, sr = sf.read(temp / "output/ayrilmis.wav")
    assert sr == 16000 and len(output) == length and np.isfinite(output).all()
    assert report["device"] == "cpu" and report["threads"] <= 4
    assert report["processing_seconds"] > 0 and report["streaming_tested"] is False
    assert len(report["blocks"]) >= 2
    assert all(np.isfinite(block["scores"]).all() for block in report["blocks"])
    assert all(block["selected"] in [None, 0, 1] for block in report["blocks"])
    # Scores and selection are reported, not promoted to a claim of general quality.
    summary = {k: report[k] for k in ["device", "processing_seconds", "audio_seconds", "rtf", "selected_blocks"]}
    summary["output_rms"] = float(np.sqrt(np.mean(output * output)))
    print("CPU_MODEL_CHECK " + json.dumps(summary))
    print("Real model load, two-source inference, reference scoring, selection, output shape and report checks passed.")
