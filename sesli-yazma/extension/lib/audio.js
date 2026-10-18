// Gain is applied after VAD so boosting never turns quiet background noise into speech.
// A soft knee preserves headroom on loud syllables instead of hard clipping.
export function boostSample(value, gain = 1.35) {
  const boosted = (Number.isFinite(value) ? value : 0) * Math.max(1, Math.min(2, Number(gain) || 1.35));
  const amplitude = Math.abs(boosted);
  return amplitude <= 0.85 ? boosted : Math.sign(boosted) * (0.85 + 0.15 * Math.tanh((amplitude - 0.85) / 0.15));
}
export function wavBlob(samples, sampleRate, gain = 1) {
  const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
  const write = (at, text) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {const n = gain === 1 ? Math.max(-1, Math.min(1, samples[i])) : boostSample(samples[i], gain); view.setInt16(44 + i * 2, n < 0 ? n * 32768 : n * 32767, true);}
  return new Blob([buffer], {type: 'audio/wav'});
}
export function concatFrames(frames) {const result = new Float32Array(frames.reduce((n, x) => n + x.length, 0)); let offset = 0; for (const frame of frames) {result.set(frame, offset); offset += frame.length;} return result;}
// A half-second preview is not a new sentence. Re-recognize nearby chunks
// together, then replace this window's own text instead of appending it twice.
// No text-similarity deduplication: genuinely repeated spoken words survive.
export class SpeechWindows {
  constructor(sampleRate, maxSeconds = 12) {this.sampleRate = sampleRate; this.maxSeconds = maxSeconds; this.nextId = 1; this.current = null;}
  append(samples) {
    if (!this.current || this.current.samples.length + samples.length > this.sampleRate * this.maxSeconds) this.current = {windowId: this.nextId++, samples};
    else this.current = {...this.current, samples: concatFrames([this.current.samples, samples])};
    return this.current;
  }
  boundary() {this.current = null;}
}
export class Segmenter {
  constructor({sampleRate, threshold = 0.005, pauseMs = 500, maxSeconds = 8, splitAfterSeconds = 4, settleMs = 1000, onSegment, onSpeechStart, onBoundary}) {
    Object.assign(this, {sampleRate, threshold, pauseMs, maxSeconds, splitAfterSeconds, settleMs, onSegment, onSpeechStart, onBoundary});
    this.frames = []; this.pre = []; this.length = 0; this.silence = 0; this.voice = 0;
    this.utterance = false; this.quiet = 0;
  }
  push(frame, {speech} = {}) {
    let sum = 0; for (const v of frame) sum += v * v;
    const rms = Math.sqrt(sum / Math.max(1, frame.length));
    const speaking = typeof speech === 'boolean' ? speech : rms >= this.threshold;
    if (speaking) {
      if (!this.utterance) {this.utterance = true; this.onSpeechStart?.();}
      this.quiet = 0;
    } else if (this.utterance) {
      this.quiet += frame.length;
      if (this.quiet / this.sampleRate * 1000 >= Math.max(this.pauseMs, this.settleMs)) {
        this.flush(); this.utterance = false; this.quiet = 0; this.onBoundary?.();
      }
    }
    if (!this.length && !speaking) {this.pre.push(frame); while (this.pre.reduce((n, x) => n + x.length, 0) > this.sampleRate * 0.3) this.pre.shift(); return {rms, speaking, buffered: false};}
    if (!this.length) {this.frames = this.pre.splice(0); this.length = this.frames.reduce((n, x) => n + x.length, 0);}
    this.frames.push(frame); this.length += frame.length;
    if (speaking) {this.silence = 0; this.voice += frame.length;} else this.silence += frame.length;
    const longPause = this.length / this.sampleRate >= this.splitAfterSeconds && this.silence / this.sampleRate >= 0.25;
    if (longPause || this.silence / this.sampleRate * 1000 >= this.pauseMs || this.length / this.sampleRate >= this.maxSeconds) this.flush();
    return {rms, speaking, buffered: this.length > 0};
  }
  flush() {
    // Keep a short tail for word endings; avoid uploading a full pause as speech.
    const keep = Math.max(0, this.length - Math.max(0, this.silence - Math.round(this.sampleRate * 0.25)));
    const samples = this.length && this.voice / this.sampleRate >= 0.22 ? concatFrames(this.frames).slice(0, keep) : null;
    const silenceMs = this.silence / this.sampleRate * 1000;
    this.frames = []; this.pre = []; this.length = 0; this.silence = 0; this.voice = 0;
    if (samples) this.onSegment(samples, {silenceMs});
  }
  clear() {this.frames = []; this.pre = []; this.length = 0; this.silence = 0; this.voice = 0; this.utterance = false; this.quiet = 0;}
}
