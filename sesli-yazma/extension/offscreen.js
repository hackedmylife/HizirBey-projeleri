import {Segmenter, wavBlob} from './lib/audio.js';
import {transcribe, correct, abortableDelay} from './lib/groq.js';
import {basicText} from './lib/core.js';
import {withTimeBudget} from './lib/timing.js';

let active = null;
// Includes the in-flight request. Stop capturing before the next 8-second segment
// would exceed roughly two minutes in RAM; drain everything already captured.
const PAUSE_PENDING_SECONDS = 106;
async function ask(session, type, data = {}) {
  const response = await chrome.runtime.sendMessage({type, sessionId: session.id, ...data});
  if (!response?.ok) throw new Error(response?.error || 'Dikte bağlantısı kesildi.');
  return response.data;
}
async function cleanup(s) {
  s.recording = false;
  clearTimeout(s.limitTimer);
  if (s.worklet) {s.worklet.port.onmessage = null; s.worklet.disconnect();}
  s.source?.disconnect(); s.sink?.disconnect();
  for (const track of s.stream?.getTracks() || []) track.stop();
  if (s.context?.state !== 'closed') await s.context?.close().catch(() => {});
}
async function fail(s, error) {
  if (active !== s) return;
  active = null; s.controller.abort(); s.queue.length = 0; s.segmenter?.clear(); await cleanup(s);
  if (error.name !== 'AbortError') await ask(s, 'audio:error', {error: error.message || 'Ses işlenemedi.'}).catch(() => {});
}
function meter(s, force = false) {
  if (active !== s || (!force && Date.now() - s.lastMeter < 350)) return;
  s.lastMeter = Date.now();
  ask(s, 'audio:meter', {level: Math.min(1, (s.rms || 0) * (s.config.micGain || 1.35) * 12), seconds: Math.floor((Date.now() - s.startedAt) / 1000), buffered: Boolean(s.segmenter?.length), processing: s.processing || s.queue.length > 0, recording: s.recording, waiting: Boolean(s.requestState?.waiting), waitingForQuota: s.requestState?.quota === true, attempt: s.requestState?.attempt || 1, pendingSeconds: Math.ceil(s.pendingSeconds), pausedForBacklog: s.pausedForBacklog}).catch(error => fail(s, error));
}
function connection(s, kind, seconds = 0, signal = s.controller.signal) {
  return {
    async onAttempt({attempt, maxAttempts}) {
      while (true) {
        if (active !== s || signal.aborted) throw new DOMException('İptal edildi.', 'AbortError');
        const reserved = await ask(s, 'audio:reserve', {kind, seconds});
        if (!reserved?.waitMs) break;
        s.requestState = {attempt, maxAttempts, waiting: true, quota: true}; meter(s, true);
        await abortableDelay(reserved.waitMs, signal);
      }
      if (active !== s || signal.aborted) throw new DOMException('İptal edildi.', 'AbortError');
      s.requestState = {attempt, maxAttempts, waiting: attempt > 1}; meter(s, true);
    },
    onRetry({attempt, maxAttempts}) {s.requestState = {attempt, maxAttempts, waiting: true}; meter(s, true);},
    onSlow() {if (active === s) {s.requestState = {...s.requestState, waiting: true}; meter(s, true);}}
  };
}
async function drain(s) {
  if (s.processing || active !== s) return;
  s.processing = true; meter(s, true);
  try {
    while (s.queue.length && active === s) {
      const {samples, spokenAt} = s.queue.shift();
      const duration = samples.length / s.sampleRate;
      const raw = await transcribe(wavBlob(samples, s.sampleRate, s.config.micGain), {...s.config, connection: connection(s, 'speech', duration)}, s.controller.signal);
      if (active !== s) return;
      s.requestState = null;
      if (!raw) {s.pendingSeconds = Math.max(0, s.pendingSeconds - duration); continue;}
      let result = {text: basicText(raw, s.config.terms), corrected: false, warning: ''}, stopForQuota = false;
      if (s.config.correction) {
        try {
          result = await withTimeBudget(async signal => {
            const examples = await ask(s, 'audio:examples', {text: raw});
            return correct(raw, {...s.config, pairs: examples, connection: {...connection(s, 'text', 0, signal), retryDelays: []}}, signal);
          }, s.config.fastMode !== false ? 2500 : 10000, s.controller.signal);
        } catch (error) {
          if (s.controller.signal.aborted || active !== s) return;
          result.warning = error.name === 'TimeoutError' ? 'Hız için temiz temel metin aktarıldı; dil düzeltmesi yetişmedi. Metni kontrol et.' : 'Dil düzeltmesi tamamlanamadı; temel metni kontrol et.';
          stopForQuota = error.status === 429 || /kota|sınır/.test(error.message);
        }
      }
      if (active !== s) return;
      s.requestState = null;
      const inserted = await ask(s, 'audio:result', {segmentId: s.nextResult++, spokenAt, raw, ...result});
      if (!inserted || active !== s) return;
      s.pendingSeconds = Math.max(0, s.pendingSeconds - duration);
      if (stopForQuota) {await fail(s, new Error('Ücretsiz düzeltme kotası doldu. Temel metin korundu; dikte durduruldu.')); return;}
    }
  } catch (error) {await fail(s, error);}
  finally {
    s.processing = false;
    if (active === s) {
      meter(s, true);
      if (!s.recording && !s.queue.length) {active = null; await ask(s, 'audio:done', {reason: s.pausedForBacklog ? 'Bekleyen metin tamamlandı. Oku, Enter ile gönder; yeni dikte için Alt + H.' : undefined}).catch(() => {});}
    }
  }
}
async function start(id, config) {
  if (active) {const old = active; active = null; old.controller.abort(); await cleanup(old);}
  const s = {id, config, queue: [], pendingSeconds: 0, nextResult: 1, pausedForBacklog: false, controller: new AbortController(), recording: true, processing: false, startedAt: Date.now(), lastMeter: 0, lastVoice: Date.now()};
  active = s;
  try {
    s.stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(config.deviceId ? {deviceId: {exact: config.deviceId}} : {})}});
    if (active !== s) {await cleanup(s); throw new Error('Kayıt iptal edildi.');}
    s.context = new AudioContext({sampleRate: 16000}); s.sampleRate = s.context.sampleRate;
    await s.context.audioWorklet.addModule(chrome.runtime.getURL('worklet.js'));
    if (active !== s) {await cleanup(s); throw new Error('Kayıt iptal edildi.');}
    s.segmenter = new Segmenter({sampleRate: s.sampleRate, threshold: config.sensitivity, pauseMs: config.pauseMs, onSegment(samples, {silenceMs} = {}) {
      if (active !== s) return;
      s.pendingSeconds += samples.length / s.sampleRate;
      s.queue.push({samples, spokenAt: Date.now() - (silenceMs || 0)}); void drain(s);
      if (s.pendingSeconds >= PAUSE_PENDING_SECONDS && s.recording) {
        s.pausedForBacklog = true;
        queueMicrotask(() => {if (active === s) void finish(id);});
      }
    }});
    s.source = s.context.createMediaStreamSource(s.stream);
    s.worklet = new AudioWorkletNode(s.context, 'hizir-pcm');
    s.sink = s.context.createGain(); s.sink.gain.value = 0;
    s.source.connect(s.worklet); s.worklet.connect(s.sink); s.sink.connect(s.context.destination);
    s.worklet.port.onmessage = event => {
      if (active !== s || !s.recording) return;
      const v = s.segmenter.push(event.data); s.rms = v.rms;
      if (v.rms >= config.sensitivity) s.lastVoice = Date.now();
      meter(s);
      if (Date.now() - s.lastVoice > 90000) void finish(id);
    };
    for (const track of s.stream.getTracks()) track.onended = () => {if (s.recording && active === s) void fail(s, new Error('Mikrofon bağlantısı kesildi.'));};
    await s.context.resume();
    s.limitTimer = setTimeout(() => void finish(id), 15 * 60 * 1000);
    meter(s, true); return true;
  } catch (error) {
    if (active === s) active = null;
    await cleanup(s);
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') throw new Error('Mikrofon izni gerekli. Eklenti ayarlarında “Mikrofonu dene” düğmesini kullan.');
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') throw new Error('Seçili mikrofon bulunamadı. Ayarlardan sistem mikrofonunu seç.');
    throw new Error(error.message || 'Mikrofon başlatılamadı.');
  }
}
async function finish(id) {
  const s = active; if (!s || s.id !== id || !s.recording) return;
  s.recording = false; s.segmenter.flush(); await cleanup(s);
  if (!s.processing && !s.queue.length && active === s) {active = null; await ask(s, 'audio:done').catch(() => {});}
  else meter(s, true);
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.target !== 'offscreen' || sender.id !== chrome.runtime.id || sender.tab || (sender.url && sender.url !== chrome.runtime.getURL('background.js'))) return false;
  (async () => {
    if (message.type === 'capture:start') return start(message.sessionId, message.config);
    if (message.type === 'capture:finish') return finish(message.sessionId);
    if (message.type === 'capture:cancel') {const s = active; if (s?.id === message.sessionId) {active = null; s.controller.abort(); s.queue.length = 0; s.segmenter?.clear(); await cleanup(s);} return true;}
    throw new Error('Geçersiz mikrofon işlemi.');
  })().then(data => respond({ok: true, data}), error => respond({ok: false, error: error.message}));
  return true;
});
