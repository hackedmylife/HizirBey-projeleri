import {dictationTextRisk} from './safety.js';
import {boostSample} from './audio.js';

// Chrome's final recognition result closes a turn, never the user's dictation.
// A fresh recognizer continues on the same processed microphone track.
export class BrowserSpeech {
  constructor({Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition, track, onText, onWarning, onError, onState}) {
    if (!Recognition) throw new Error('Bu tarayıcı Chrome ses tanımayı desteklemiyor. Güncel Google Chrome kullan veya ayarlardan Groq seç.');
    Object.assign(this, {Recognition, track, onText, onWarning, onError, onState});
    this.committed = ''; this.results = []; this.wanted = false; this.ready = false; this.failures = 0;
  }
  start() {this.wanted = true; this.open();}
  open() {
    if (!this.wanted) return;
    const recognition = new this.Recognition(); this.recognition = recognition; this.results = []; this.turnError = ''; this.turnStarted = Date.now();
    recognition.lang = 'tr-TR'; recognition.continuous = true; recognition.interimResults = true; recognition.maxAlternatives = 1;
    // Chrome 151+ can infer punctuation itself. Keep it off while listening;
    // the one whole-draft punctuation pass happens only after the user's stop.
    if ('unspokenPunctuation' in recognition) recognition.unspokenPunctuation = false;
    if ('processLocally' in recognition) recognition.processLocally = false;
    recognition.onstart = () => {if (this.recognition === recognition) {this.ready = true; this.onState?.(true);}};
    recognition.onresult = event => {
      if (this.recognition !== recognition) return;
      const results = [];
      for (const result of Array.from(event.results || [])) {
        const text = String(result[0]?.transcript || '').trim();
        if (dictationTextRisk(text)) {results.push(''); this.onWarning?.('Chrome ses tanımada şüpheli bir bölüm yazılmadı. O bölümü tekrar söyle; dinleme sürüyor.');}
        else results.push(text);
      }
      this.results = results;
      const text = [this.committed, ...results].filter(Boolean).join(' ');
      if (text.length > 8000) {this.fatal(new Error('Taslak uzunluk sınırına ulaştı. Mevcut metni kontrol edip gönder; yeni dikte başlat.')); return;}
      if (text) {this.failures = 0; this.onText?.(text);}
    };
    recognition.onerror = event => {
      if (this.recognition !== recognition) return;
      const code = String(event.error || 'unknown'); this.turnError = code;
      if (code === 'no-speech' || (code === 'aborted' && !this.wanted)) return;
      if (code === 'network' && this.wanted && ++this.failures <= 3) {this.onWarning?.('Chrome ses bağlantısı yenileniyor. Son taslak korundu; bağlantı gelince konuşmaya devam et.'); return;}
      const message = ['not-allowed', 'service-not-allowed'].includes(code) ? 'Chrome ses tanımaya izin vermedi. Mikrofon iznini ve Chrome / Workspace politikasını kontrol et.' : code === 'audio-capture' ? 'Chrome mikrofon sesini alamadı. Seçili mikrofonu kontrol et.' : code === 'language-not-supported' ? 'Chrome Türkçe ses tanımayı bu ortamda açamadı.' : code === 'network' ? 'Chrome / Google ses servisine bağlanılamadı. Mevcut taslak korundu; bağlantını kontrol et veya ayarlardan Groq seç.' : `Chrome ses tanıma hatası: ${code}. Mevcut metni kontrol et.`;
      this.fatal(new Error(message));
    };
    recognition.onend = () => {
      if (this.recognition !== recognition) return;
      this.committed = [this.committed, ...this.results].filter(Boolean).join(' '); this.results = [];
      this.ready = false; this.recognition = null; this.onState?.(false);
      if (!this.wanted) {this.finishResolve?.(); return;}
      const quick = Date.now() - this.turnStarted < 1000;
      this.quickEnds = quick ? Math.min(5, (this.quickEnds || 0) + 1) : 0;
      const delay = this.turnError === 'network' ? [300, 1000, 3000][this.failures - 1] : this.quickEnds > 2 ? 1000 : 150;
      this.restartTimer = setTimeout(() => this.open(), delay);
    };
    try {recognition.start(this.track);} catch (error) {this.fatal(new Error(`Chrome ses tanıma başlatılamadı: ${error.message}`));}
  }
  fatal(error) {this.cancel(); this.onError?.(error);}
  async finish(timeout = 5000) {
    this.wanted = false; clearTimeout(this.restartTimer);
    if (!this.recognition) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => {this.onWarning?.('Chrome son ses sonucunu zamanında tamamlamadı. Son görünen taslak korundu; göndermeden önce oku.'); this.cancel(); resolve();}, timeout);
      this.finishResolve = () => {clearTimeout(timer); this.finishResolve = null; resolve();};
      try {this.recognition.stop();} catch {this.cancel();}
    });
  }
  cancel() {
    this.wanted = false; this.ready = false; clearTimeout(this.restartTimer);
    const recognition = this.recognition; this.recognition = null;
    if (recognition) {
      recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null;
      try {recognition.abort();} catch { /* Already disconnected. */ }
    }
    this.finishResolve?.();
  }
}

// Delay six VAD frames so a newly detected syllable keeps its leading sound.
// Feed only this processed track to Chrome, never a second default microphone.
export class SpeechPlayout {
  constructor(context, config, destination) {Object.assign(this, {context, config, destination}); this.frames = []; this.nodes = new Set(); this.cursor = context.currentTime + 0.16;}
  push({frame, speech}) {
    this.frames.push({frame, speech: speech !== false});
    if (speech) for (const item of this.frames) item.speech = true;
    if (this.frames.length > 6) this.schedule(this.frames.shift());
  }
  schedule({frame, speech}) {
    const start = Math.max(this.cursor, this.context.currentTime + 0.02);
    if (start - this.context.currentTime > 2) throw new Error('Chrome ses aktarımı yetişemedi. Son taslak korundu; Workspace bağlantısını kontrol et.');
    const buffer = this.context.createBuffer(1, frame.length, this.context.sampleRate);
    if (speech) buffer.copyToChannel(Float32Array.from(frame, value => boostSample(value, this.config.micGain)), 0);
    const source = this.context.createBufferSource(); source.buffer = buffer; source.connect(this.destination); this.nodes.add(source);
    source.onended = () => {source.disconnect(); this.nodes.delete(source);};
    source.start(start); this.cursor = start + frame.length / this.context.sampleRate;
  }
  flush() {for (const frame of this.frames.splice(0)) this.schedule(frame);}
  async drain() {const ms = Math.min(2200, Math.max(0, (this.cursor - this.context.currentTime) * 1000) + 40); if (ms) await new Promise(resolve => setTimeout(resolve, ms));}
  destroy() {this.frames = []; for (const source of this.nodes) {try {source.stop();} catch { /* Already ended. */ } source.disconnect();} this.nodes.clear();}
}
