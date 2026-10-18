// Bundled libfvad/WebRTC runs locally. No model download or audio upload is
// involved in this gate. It detects speech, not the identity of the speaker.
export function microphoneConstraints(config = {}) {
  return {audio: {channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: config.backgroundGuard === false,
    ...(config.deviceId ? {deviceId: {exact: config.deviceId}} : {})}};
}
export async function openMicrophone(config, devices = navigator.mediaDevices) {
  const stream = await devices.getUserMedia(microphoneConstraints(config));
  // Request cancellation of local playback only when the actual input track
  // advertises the mode. Older Chrome/devices retain ordinary cancellation.
  const track = stream.getAudioTracks?.()[0] || stream.getTracks()[0];
  try {
    const modes = track?.getCapabilities?.().echoCancellation;
    if (config.backgroundGuard !== false && Array.isArray(modes) && modes.includes('all')) await track.applyConstraints({echoCancellation: {exact: 'all'}});
  } catch { /* The initial echo cancellation remains enabled. */ }
  return stream;
}
export function backgroundLevel(levels) {
  const sorted = levels.filter(x => Number.isFinite(x) && x >= 0 && x <= 1).sort((a, b) => a - b);
  if (sorted.length < 20) throw new Error('Arka plan ölçümü tamamlanamadı. Mikrofonu kontrol edip yeniden dene.');
  return Math.min(0.2, sorted[Math.floor((sorted.length - 1) * 0.95)]);
}
function energy(frame) {let sum = 0; for (const n of frame) sum += n * n; return Math.sqrt(sum / frame.length);}
function pureTone(frame) {
  // A single sustained tone also fools WebRTC VAD. A sinusoid follows an
  // exact second-order recurrence; normal multi-harmonic speech does not.
  let numerator = 0, denominator = 0, power = 0;
  for (let i = 2; i < frame.length; i++) {numerator += (frame[i] + frame[i - 2]) * frame[i - 1]; denominator += frame[i - 1] ** 2; power += frame[i] ** 2;}
  if (power < 1e-10 || denominator < 1e-10) return true;
  const coefficient = Math.max(-2, Math.min(2, numerator / denominator));
  let error = 0; for (let i = 2; i < frame.length; i++) error += (frame[i] - coefficient * frame[i - 1] + frame[i - 2]) ** 2;
  return error / power < 0.0001;
}
export class SpeechFilter {
  constructor(instance, {sampleRate = 16000, sensitivity = 0.005, noiseLevel = 0} = {}) {
    if (![8000, 16000, 32000, 48000].includes(sampleRate)) throw new Error('Konuşma filtresi bu örnekleme hızını desteklemiyor.');
    this.api = instance.exports; this.size = sampleRate / 50; this.sensitivity = sensitivity; this.noiseLevel = noiseLevel;
    this.handle = this.api.fvad_new(); this.pointer = this.api.malloc(this.size * 2);
    if (!this.handle || !this.pointer || this.api.fvad_set_mode(this.handle, 3) < 0 || this.api.fvad_set_sample_rate(this.handle, sampleRate) < 0) {this.destroy(); throw new Error('Yerel konuşma filtresi başlatılamadı.');}
    this.pending = new Float32Array(this.size); this.offset = 0; this.votes = []; this.speaking = false; this.hold = 0;
  }
  classify(frame) {
    const pcm = new Int16Array(this.api.memory.buffer, this.pointer, this.size);
    for (let i = 0; i < frame.length; i++) {const n = Number.isFinite(frame[i]) ? Math.max(-1, Math.min(1, frame[i])) : 0; pcm[i] = n < 0 ? n * 32768 : n * 32767;}
    const result = this.api.fvad_process(this.handle, this.pointer, this.size);
    if (result < 0) throw new Error('Yerel konuşma filtresi sesi işleyemedi.');
    const rms = energy(frame), floor = Math.max(this.sensitivity, this.noiseLevel * (this.speaking ? 1.35 : 2));
    const candidate = result === 1 && rms >= floor && !pureTone(frame);
    this.votes.push(candidate); if (this.votes.length > 5) this.votes.shift();
    if (!this.speaking && this.votes.filter(Boolean).length >= 3) {this.speaking = true; this.hold = 5;}
    else if (this.speaking) {if (candidate) this.hold = 5; else if (--this.hold <= 0) this.speaking = false;}
    return {frame, speech: this.speaking, rms};
  }
  push(input) {
    if (!this.handle) throw new Error('Konuşma filtresi kapalı.');
    const frames = [];
    for (let i = 0; i < input.length;) {
      const count = Math.min(input.length - i, this.size - this.offset);
      this.pending.set(input.subarray(i, i + count), this.offset); this.offset += count; i += count;
      if (this.offset === this.size) {frames.push(this.classify(this.pending)); this.pending = new Float32Array(this.size); this.offset = 0;}
    }
    return frames;
  }
  flush() {if (!this.offset || !this.handle) return []; const frame = this.pending; this.pending = new Float32Array(this.size); this.offset = 0; return [this.classify(frame)];}
  destroy() {if (this.pointer) this.api.free(this.pointer); if (this.handle) this.api.fvad_free(this.handle); this.pointer = 0; this.handle = 0; this.pending = null;}
}
export async function createSpeechFilter(config, binary) {
  if (!binary) {
    const response = await fetch(chrome.runtime.getURL('vendor/fvad/libfvad.wasm'));
    if (!response.ok) throw new Error('Yerel konuşma filtresi dosyası bulunamadı. Güncel paketi aynı klasöre çıkarıp uzantıyı yenile.');
    binary = await response.arrayBuffer();
  }
  const {instance} = await WebAssembly.instantiate(binary);
  instance.exports._initialize?.();
  return new SpeechFilter(instance, config);
}
