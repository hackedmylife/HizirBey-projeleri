"""Bounded buffers and overlap processing; no devices, network or file writes."""
from collections import deque
import math
import threading
import numpy as np
from scipy.signal import resample_poly

RATE = 16000


def resample(data, source_rate, target_rate):
    if source_rate == target_rate:
        return np.asarray(data, dtype=np.float32)
    divisor = math.gcd(source_rate, target_rate)
    return resample_poly(data, target_rate // divisor, source_rate // divisor).astype(np.float32)


def calibrate(candidates, mixture, actual):
    """Resolve SI-SNR model scale/sign against the mixture, not block peak.

    The published separator can emit very large, sign-inverted estimates.
    Least-squares mixing coefficients preserve a stable physical signal level.
    """
    if actual <= 0 or not np.isfinite(candidates).all():
        raise ValueError("Geçersiz ses bloğu.")
    matrix = np.asarray(candidates[:, :actual], dtype=np.float64).T
    target = np.asarray(mixture[:actual], dtype=np.float64)
    coefficients = np.linalg.lstsq(matrix, target, rcond=1e-6)[0]
    result = candidates * coefficients[:, None]
    input_rms = float(np.sqrt(np.mean(target * target)))
    for i in range(len(result)):
        rms = float(np.sqrt(np.mean(result[i, :actual] ** 2)))
        if rms > 2 * input_rms + 1e-5:
            result[i] *= (2 * input_rms + 1e-5) / rms
    if not np.isfinite(result).all():
        raise ValueError("Ses seviyesi çözümlenemedi.")
    return result.astype(np.float32)


class AudioRing:
    def __init__(self, capacity):
        self.capacity = capacity
        self.chunks = deque()
        self.frames = 0
        self.lock = threading.Lock()

    def push(self, data):
        data = np.asarray(data, dtype=np.float32)
        if data.ndim != 1 or not np.isfinite(data).all():
            raise ValueError("Geçersiz çıkış sesi.")
        with self.lock:
            if self.frames + len(data) > self.capacity:
                raise RuntimeError("Ses aktarımı geride kaldı; filtre durduruldu.")
            if len(data):
                self.chunks.append(data.copy())
                self.frames += len(data)

    def read(self, frames):
        output = np.zeros(frames, dtype=np.float32)
        position = 0
        with self.lock:
            while position < frames and self.chunks:
                chunk = self.chunks[0]
                take = min(len(chunk), frames - position)
                output[position:position + take] = chunk[:take]
                if take == len(chunk):
                    self.chunks.popleft()
                else:
                    self.chunks[0] = chunk[take:]
                position += take
                self.frames -= take
        return output

    def size(self):
        with self.lock:
            return self.frames


class WindowedFilter:
    """3 s lookahead, 2 s hops. Every accepted sample, including the tail, stays ordered."""
    def __init__(self, processor, input_rate=RATE):
        self.processor = processor
        self.input_rate = input_rate
        self.window = 3 * RATE
        self.hop = 2 * RATE
        self.input_window = 3 * input_rate
        self.input_hop = 2 * input_rate
        self.buffer = np.empty(0, dtype=np.float32)
        self.signal = np.zeros(self.window, dtype=np.float64)
        self.weights = np.zeros(self.window, dtype=np.float64)
        self.fade = np.hanning(self.window + 2)[1:-1]
        self.processed = False
        self.finished = False

    def _add(self, block, actual):
        chosen = self.processor(block, actual)
        if chosen.shape != (self.window,) or not np.isfinite(chosen).all():
            raise ValueError("Ayırıcı geçersiz bir blok döndürdü.")
        self.signal[:actual] += chosen[:actual] * self.fade[:actual]
        self.weights[:actual] += self.fade[:actual]
        self.processed = True

    def _emit(self, frames):
        result = np.divide(self.signal[:frames], self.weights[:frames],
                           out=np.zeros(frames), where=self.weights[:frames] > 1e-10)
        self.signal = np.concatenate((self.signal[frames:], np.zeros(frames)))
        self.weights = np.concatenate((self.weights[frames:], np.zeros(frames)))
        # Fixed +6 dB and a smooth safety limiter. No utterance-wide normalization.
        return (0.95 * np.tanh(2.0 * result / 0.95)).astype(np.float32)

    def push(self, data):
        if self.finished:
            raise RuntimeError("Biten akışa ses eklenemez.")
        data = np.asarray(data, dtype=np.float32)
        if not np.isfinite(data).all():
            raise ValueError("Mikrofon geçersiz ses döndürdü.")
        self.buffer = np.concatenate((self.buffer, data))
        if len(self.buffer) > 8 * self.input_rate:
            raise RuntimeError("Mikrofon kuyruğu doldu; filtre durduruldu.")
        outputs = []
        while len(self.buffer) >= self.input_window:
            block = resample(self.buffer[:self.input_window], self.input_rate, RATE)
            self._add(block, self.window)
            outputs.append(self._emit(self.hop))
            self.buffer = self.buffer[self.input_hop:]
        return outputs

    def finish(self):
        if self.finished:
            return []
        self.finished = True
        actual = round(len(self.buffer) * RATE / self.input_rate)
        if not actual:
            return []
        if not self.processed or actual > self.window - self.hop:
            padded = np.pad(self.buffer, (0, self.input_window - len(self.buffer)))
            block = resample(padded, self.input_rate, RATE)
            self._add(block, actual)
        result = self._emit(actual)
        self.buffer = np.empty(0, dtype=np.float32)
        return [result]
