import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / "engine"))
from dsp import AudioRing, WindowedFilter, calibrate, resample
from service import resolve_devices


class StreamTests(unittest.TestCase):
    def test_scale_and_polarity_are_resolved_against_mixture(self):
        t = np.arange(48000) / 16000
        voice = .03 * np.sin(2 * np.pi * 200 * t)
        background = .01 * np.sin(2 * np.pi * 450 * t)
        estimated = np.array([-65000 * voice, -42000 * background], dtype=np.float32)
        result = calibrate(estimated, voice + background, len(t))
        np.testing.assert_allclose(result[0], voice, atol=1e-7)
        np.testing.assert_allclose(result[1], background, atol=1e-7)

    def test_chunk_order_and_tail_are_preserved(self):
        t = np.arange(16000 * 7 + 831) / 16000
        signal = (.03 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
        processor = WindowedFilter(lambda x, actual: x.copy())
        chunks = []
        for start in range(0, len(signal), 1600):
            chunks.extend(processor.push(signal[start:start + 1600]))
        chunks.extend(processor.finish())
        output = np.concatenate(chunks)
        expected = .95 * np.tanh(2 * signal / .95)
        self.assertEqual(output.shape, signal.shape)
        np.testing.assert_allclose(output, expected, atol=1e-7)
        self.assertEqual(processor.finish(), [])
        with self.assertRaises(RuntimeError):
            processor.push(np.zeros(100, dtype=np.float32))

    def test_short_utterance_and_exact_window(self):
        for length in [9000, 16000, 32000, 48000, 64000, 80000, 96000]:
            with self.subTest(length=length):
                data = np.full(length, .01, dtype=np.float32)
                pipeline = WindowedFilter(lambda x, actual: x.copy())
                output = pipeline.push(data)
                output.extend(pipeline.finish())
                self.assertEqual(sum(len(x) for x in output), length)
                self.assertTrue(np.isfinite(np.concatenate(output)).all())

    def test_unknown_speech_is_silenced_without_raw_fallback(self):
        data = np.full(48000, .1, dtype=np.float32)
        pipeline = WindowedFilter(lambda x, actual: np.zeros_like(x))
        output = pipeline.push(data) + pipeline.finish()
        self.assertEqual(float(np.max(np.abs(np.concatenate(output)))), 0)

    def test_hardware_rate_is_resampled_and_buffers_stay_bounded(self):
        pipeline = WindowedFilter(lambda x, actual: x.copy(), input_rate=48000)
        signal = np.zeros(48000 * 5, dtype=np.float32)
        chunks = pipeline.push(signal) + pipeline.finish()
        self.assertEqual(sum(map(len, chunks)), 16000 * 5)
        with self.assertRaises(RuntimeError):
            WindowedFilter(lambda x, actual: x).push(np.zeros(16000 * 9, dtype=np.float32))
        with self.assertRaises(ValueError):
            WindowedFilter(lambda x, actual: x).push(np.array([np.nan]))

    def test_output_ring_keeps_order_and_zeros_underflow(self):
        ring = AudioRing(10)
        ring.push(np.arange(5, dtype=np.float32))
        np.testing.assert_array_equal(ring.read(3), [0, 1, 2])
        ring.push(np.arange(5, 9, dtype=np.float32))
        np.testing.assert_array_equal(ring.read(8), [3, 4, 5, 6, 7, 8, 0, 0])
        self.assertEqual(ring.size(), 0)
        with self.assertRaises(RuntimeError):
            ring.push(np.zeros(11))
        with self.assertRaises(ValueError):
            ring.push(np.array([np.inf]))

    def test_device_routing_requires_explicit_virtual_output(self):
        items = [dict(id=2, kind="input", name="Dahili mikrofon", host="Windows WASAPI"),
                 dict(id=4, kind="output", name="CABLE Input (VB-Audio Virtual Cable)", host="Windows WASAPI")]
        settings = dict(confirmed="1", input_name=items[0]["name"], input_host=items[0]["host"],
                        output_name=items[1]["name"], output_host=items[1]["host"])
        self.assertEqual(resolve_devices(settings, items)[1]["id"], 4)
        with self.assertRaises(ValueError):
            resolve_devices(settings, [items[0]])
        with self.assertRaises(ValueError):
            resolve_devices({**settings, "confirmed": "0"}, items)
        with self.assertRaises(ValueError):
            resolve_devices(settings, items + [items[0]])
        bad = [{**items[0], "name": "CABLE Output"}, items[1]]
        with self.assertRaises(ValueError):
            resolve_devices({**settings, "input_name": "CABLE Output"}, bad)


if __name__ == "__main__":
    unittest.main()
