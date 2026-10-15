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
export class Segmenter {
  constructor({sampleRate, threshold = 0.005, pauseMs = 1000, maxSeconds = 14, onSegment}) {
    Object.assign(this, {sampleRate, threshold, pauseMs, maxSeconds, onSegment});
    this.frames = []; this.pre = []; this.length = 0; this.silence = 0; this.voice = 0;
  }
  push(frame) {
    let sum = 0; for (const v of frame) sum += v * v;
    const rms = Math.sqrt(sum / Math.max(1, frame.length));
    const speaking = rms >= this.threshold;
    if (!this.length && !speaking) {this.pre.push(frame); while (this.pre.reduce((n, x) => n + x.length, 0) > this.sampleRate * 0.3) this.pre.shift(); return {rms, buffered: false};}
    if (!this.length) {this.frames = this.pre.splice(0); this.length = this.frames.reduce((n, x) => n + x.length, 0);}
    this.frames.push(frame); this.length += frame.length;
    if (speaking) {this.silence = 0; this.voice += frame.length;} else this.silence += frame.length;
    if (this.silence / this.sampleRate * 1000 >= this.pauseMs || this.length / this.sampleRate >= this.maxSeconds) this.flush();
    return {rms, buffered: this.length > 0};
  }
  flush() {
    const samples = this.length && this.voice / this.sampleRate >= 0.22 ? concatFrames(this.frames) : null;
    this.frames = []; this.pre = []; this.length = 0; this.silence = 0; this.voice = 0;
    if (samples) this.onSegment(samples);
  }
  clear() {this.frames = []; this.pre = []; this.length = 0; this.silence = 0; this.voice = 0;}
}
