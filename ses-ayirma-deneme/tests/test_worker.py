import hashlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("cpu_worker", Path(__file__).parents[1] / "engine/worker.py")
worker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(worker)


class WorkerTests(unittest.TestCase):
    def test_known_speaker_and_order(self):
        self.assertEqual(worker.choose_source([0.82, 0.30]), 0)
        self.assertEqual(worker.choose_source([0.30, 0.82]), 1)

    def test_unknown_or_ambiguous_is_not_passed_through(self):
        for scores in [[0.4, 0.2], [0.8, 0.78], [-1, -1], [float("nan"), .8], [1], []]:
            with self.subTest(scores=scores):
                self.assertIsNone(worker.choose_source(scores))

    def test_verified_download_and_corrupt_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.bin"
            good = b"verified model bytes"
            path.write_bytes(b"broken cache")
            with patch("urllib.request.urlopen", return_value=io.BytesIO(good)) as response:
                worker.download("https://example.com/model", path, sha256=hashlib.sha256(good).hexdigest())
                response.assert_called_once()
            self.assertEqual(path.read_bytes(), good)
            with patch("urllib.request.urlopen") as response:
                worker.download("https://example.com/model", path, sha256=hashlib.sha256(good).hexdigest())
                response.assert_not_called()

    def test_invalid_download_is_never_installed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.bin"
            with patch("urllib.request.urlopen", return_value=io.BytesIO(b"incorrect")):
                with self.assertRaises(ValueError):
                    worker.download("https://example.com/model", path, sha256="0" * 64)
            self.assertFalse(path.exists())

    def test_git_blob_pin(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.pt"
            data = b"checkpoint"
            digest = hashlib.sha1(b"blob 10\0" + data).hexdigest()
            with patch("urllib.request.urlopen", return_value=io.BytesIO(data)):
                worker.download("https://example.com/model", path, git_blob=digest)
            self.assertEqual(path.read_bytes(), data)

    def test_audio_validation_resampling_and_stereo(self):
        import numpy as np
        import soundfile as sf
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "audio.wav"
            data = .1 * np.sin(2 * np.pi * 200 * np.arange(48000 * 3) / 48000)
            sf.write(path, np.stack([data, data], axis=1), 48000)
            audio, info = worker.load_audio(path, 3, 60)
            self.assertEqual(audio.shape, (48000,))
            self.assertAlmostEqual(info["seconds"], 3)
            self.assertTrue(np.isfinite(audio).all())
            sf.write(path, np.zeros(16000 * 3), 16000)
            with self.assertRaises(ValueError):
                worker.load_audio(path, 3, 60)
            sf.write(path, data[:48000], 48000)
            with self.assertRaises(ValueError):
                worker.load_audio(path, 3, 60)

    def test_atomic_metadata_and_unicode_paths(self):
        with tempfile.TemporaryDirectory(prefix="Ses Türkçe ") as directory:
            path = Path(directory) / "rapor.json"
            worker.write_json(path, {"durum": "İşlem"})
            self.assertIn("İşlem", path.read_text(encoding="utf-8"))
            self.assertFalse(path.with_suffix(".json.tmp").exists())


if __name__ == "__main__":
    unittest.main()
