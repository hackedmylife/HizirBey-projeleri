import {Segmenter, wavBlob} from './lib/audio.js';
import {transcribe, correct, abortableDelay, RejectedTranscriptionError} from './lib/groq.js';
import {draftText} from './lib/core.js';
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
function queueFinal(s, force = false) {
  if (active !== s) return;
  s.queue.push({kind: 'final', utterance: s.utterance, force}); void drain(s);
}
async function deliver(s, text, warning = '', final = false) {
  if (active !== s || !text) return;
  const inserted = await ask(s, 'audio:result', {segmentId: s.nextResult++, spokenAt: s.lastSpokenAt, raw: s.raw, text, replace: true, final, warning: [s.warning, warning].filter(Boolean).join(' ')});
  if (!inserted && active === s) throw new Error('Taslak yazı alanına aktarılamadı. Mevcut metni kontrol et.');
}
async function finalize(s, job) {
  if (!s.raw || s.finalizedVersion === s.rawVersion || (!job.force && job.utterance !== s.utterance)) return;
  const revision = s.rawVersion;
  const controller = new AbortController(), abort = () => controller.abort();
  s.correction = controller; s.controller.signal.addEventListener('abort', abort, {once: true});
  let result = {text: draftText(s.raw, s.config.terms), warning: ''}, stopForQuota = false;
  try {
    if (s.config.correction) {
      result = await withTimeBudget(async signal => {
        const pairs = s.config.learn ? await ask(s, 'audio:examples', {text: s.raw}) : [];
        return correct(s.raw, {...s.config, pairs, punctuationOnly: true, connection: {...connection(s, 'text', 0, signal), retryDelays: []}}, signal);
      }, s.config.fastMode !== false ? 2500 : 10000, controller.signal);
    }
  } catch (error) {
    if (active !== s || s.controller.signal.aborted || controller.signal.aborted) return;
    result.warning = error.name === 'TimeoutError' ? 'Noktalama kontrolü yetişmedi; metne zorla nokta eklenmedi. Göndermeden önce oku.' : 'Noktalama kontrolü tamamlanamadı; metni kontrol et.';
    stopForQuota = error.status === 429 || /kota|sınır/.test(error.message);
  } finally {
    s.controller.signal.removeEventListener('abort', abort);
    if (s.correction === controller) s.correction = null;
  }
  if (active !== s || controller.signal.aborted || revision !== s.rawVersion || job.utterance !== s.utterance) return;
  await deliver(s, result.text, result.warning, true);
  s.finalizedVersion = revision;
  if (stopForQuota) await fail(s, new Error('Ücretsiz noktalama kotası doldu. Taslak korundu; dikte durduruldu.'));
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
    onSlow() {if (active === s && !signal.aborted) {s.requestState = {...s.requestState, waiting: true}; meter(s, true);}}
  };
}
async function drain(s) {
  if (s.processing || active !== s) return;
  s.processing = true; meter(s, true);
  try {
    while (s.queue.length && active === s) {
      const job = s.queue.shift();
      if (job.kind === 'final') {await finalize(s, job); s.requestState = null; continue;}
      const {samples, spokenAt} = job;
      const duration = samples.length / s.sampleRate;
      let raw;
      try {raw = await transcribe(wavBlob(samples, s.sampleRate, s.config.micGain), {...s.config, connection: connection(s, 'speech', duration)}, s.controller.signal);}
      catch (error) {
        if (!(error instanceof RejectedTranscriptionError)) throw error;
        s.pendingSeconds = Math.max(0, s.pendingSeconds - duration); s.requestState = null;
        s.rejected++;
        if (s.rejected >= 3) throw new Error('Art arda üç ses parçası net anlaşılamadı. Şüpheli metin yazılmadı; mevcut taslağı kontrol edip mikrofonu yeniden başlat.');
        s.warning = 'Bir ses parçası net anlaşılamadığı için yazılmadı. Bu bölümü tekrar söyle; dinleme sürüyor.';
        await ask(s, 'audio:warning', {warning: s.warning}); continue;
      }
      if (active !== s) return;
      s.requestState = null;
      if (!raw) {s.pendingSeconds = Math.max(0, s.pendingSeconds - duration); continue;}
      s.rejected = 0;
      const next = draftText(`${s.raw} ${raw}`, s.config.terms);
      if (next.length > 8000) throw new Error('Taslak uzunluk sınırına ulaştı. Mevcut metni kontrol edip gönder; yeni dikte başlat.');
      s.raw = next; s.rawVersion++; s.lastSpokenAt = spokenAt;
      await deliver(s, next);
      s.pendingSeconds = Math.max(0, s.pendingSeconds - duration);
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
  const s = {id, config, queue: [], raw: '', rawVersion: 0, finalizedVersion: -1, utterance: 0, rejected: 0, warning: '', pendingSeconds: 0, nextResult: 1, pausedForBacklog: false, controller: new AbortController(), recording: true, processing: false, startedAt: Date.now(), lastMeter: 0, lastVoice: Date.now()};
  active = s;
  try {
    s.stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(config.deviceId ? {deviceId: {exact: config.deviceId}} : {})}});
    if (active !== s) {await cleanup(s); throw new Error('Kayıt iptal edildi.');}
    s.context = new AudioContext({sampleRate: 16000}); s.sampleRate = s.context.sampleRate;
    await s.context.audioWorklet.addModule(chrome.runtime.getURL('worklet.js'));
    if (active !== s) {await cleanup(s); throw new Error('Kayıt iptal edildi.');}
    s.segmenter = new Segmenter({sampleRate: s.sampleRate, threshold: config.sensitivity, pauseMs: config.pauseMs,
      onSpeechStart() {s.utterance++; s.correction?.abort();},
      onBoundary() {queueFinal(s);},
      onSegment(samples, {silenceMs} = {}) {
      if (active !== s) return;
      s.pendingSeconds += samples.length / s.sampleRate;
      s.queue.push({kind: 'speech', samples, spokenAt: Date.now() - (silenceMs || 0)}); void drain(s);
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
  s.recording = false; s.segmenter.flush(); queueFinal(s, true); await cleanup(s);
  meter(s, true);
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
