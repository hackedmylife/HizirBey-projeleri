"""Public LibriSpeech-only CPU integration test. No user's audio enters CI."""
import sys
from pathlib import Path
import tempfile
import urllib.request
import time
import json
import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parents[1] / "engine"))
import worker
from service import Selector
from dsp import WindowedFilter

root, cache = map(Path, sys.argv[1:3])
worker.prepare(cache)
with tempfile.TemporaryDirectory(prefix="Public Speech ") as directory:
    temporary = Path(directory)
    names = ["1688/1688-142285-0000.flac", "1688/1688-142285-0001.flac", "1998/1998-15444-0000.flac"]
    samples = []
    for index, name in enumerate(names):
        url = f"https://raw.githubusercontent.com/resemble-ai/Resemblyzer/{worker.RES_COMMIT}/audio_data/librispeech_test-other/{name}"
        path = temporary / f"sample-{index}.flac"
        with urllib.request.urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())
        data, rate = sf.read(path, dtype="float32")
        assert rate == 16000
        samples.append(data)
    reference = temporary / "reference.wav"
    sf.write(reference, samples[0][:160000], 16000)
    selector = Selector(root, cache, reference)
    length = 6 * 16000 + 719
    def scaled(data):
        data = data[:length]
        return .04 * data / max(float(np.sqrt(np.mean(data * data))), 1e-6)
    mixture = scaled(samples[1]) + scaled(samples[2])
    pipeline = WindowedFilter(selector)
    started = time.perf_counter()
    outputs = []
    for start in range(0, len(mixture), 1600):
        outputs.extend(pipeline.push(mixture[start:start + 1600]))
    outputs.extend(pipeline.finish())
    result = np.concatenate(outputs)
    elapsed = time.perf_counter() - started
    assert len(result) == len(mixture) and np.isfinite(result).all()
    assert np.max(np.abs(result)) <= .95
    assert (root / "profile.npz").exists()
    print("CPU_STREAM_CHECK " + json.dumps({"seconds": len(result) / 16000, "processing_seconds": elapsed,
        "rtf": elapsed / (len(result) / 16000), "peak": float(np.max(np.abs(result))),
        "rms": float(np.sqrt(np.mean(result * result))), "device": "cpu", "hardware_io_tested": False}))
    print("Real CPU streaming-window selection, scale calibration, cache, tail length and level checks passed.")
