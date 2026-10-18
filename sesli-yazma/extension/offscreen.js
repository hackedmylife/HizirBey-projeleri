import {Segmenter, SpeechWindows, wavBlob} from './lib/audio.js';
import {transcribe, correct, abortableDelay, RejectedTranscriptionError} from './lib/groq.js';
import {draftText} from './lib/core.js';
import {withTimeBudget} from './lib/timing.js';
import {openMicrophone, createSpeechFilter} from './lib/voice.js';

let active = null;
// Includes the in-flight request and cumulative window snapshots, including
// their repeated context. Limit RAM and drain everything already captured.
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
  s.filter?.destroy();
  s.source?.disconnect(); s.sink?.disconnect();
  for (const track of s.stream?.getTracks() || []) track.stop();
  if (s.context?.state !== 'closed') await s.context?.close().catch(() => {});
}
async function fail(s, error) {
  if (active !== s) return;
  active = null; s.controller.abort(); s.queue.length = 0; s.segmenter?.clear(); s.windows?.boundary(); await cleanup(s);
  if (error.name !== 'AbortError') await ask(s, 'audio:error', {error: error.message || 'Ses işlenemedi.'}).catch(() => {});
}
function rejectionWarning(s) {
  if (!s.gaps.size) return '';
  const latest = [...s.gaps.values()].at(-1);
  return `${s.gaps.size} ses bölümü net anlaşılamadığı için tam yazılamadı. ${latest} Taslağı kontrol et; eksik bölümü kısa bir duraktan sonra tekrar söyle. Dinleme sürüyor.${s.rejected >= 3 ? ' Sorun sürüyorsa mikrofonu ve ortam gürültüsünü kontrol et.' : ''}`;
}
function queueSpeech(s, samples, spokenAt) {
  const window = s.windows.append(samples), job = {kind: 'speech', ...window, spokenAt};
  // Keep only the newest queued preview of this same audio window. Never
  // cancel or repeat an in-flight request merely because new speech arrived.
  const index = s.queue.findIndex(x => x.kind === 'speech' && x.windowId === job.windowId);
  if (index < 0) s.queue.push(job);
  else {s.pendingSeconds -= s.queue[index].samples.length / s.sampleRate; s.queue[index] = job;}
  s.pendingSeconds += job.samples.length / s.sampleRate;
  void drain(s);
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
      const {samples, spokenAt, windowId} = job;
      const duration = samples.length / s.sampleRate;
      let raw;
      try {raw = await transcribe(wavBlob(samples, s.sampleRate, s.config.micGain), {...s.config, connection: connection(s, 'speech', duration)}, s.controller.signal);}
      catch (error) {
        if (!(error instanceof RejectedTranscriptionError)) throw error;
        if (active !== s) return;
        s.pendingSeconds = Math.max(0, s.pendingSeconds - duration); s.requestState = null;
        s.rejected++;
        s.gaps.set(windowId, error.reason);
        s.warning = rejectionWarning(s);
        await ask(s, 'audio:warning', {warning: s.warning}); continue;
      }
      if (active !== s) return;
      s.requestState = null;
      if (!raw) {s.pendingSeconds = Math.max(0, s.pendingSeconds - duration); continue;}
      s.rejected = 0;
      const pieces = new Map(s.pieces); pieces.set(windowId, raw);
      const next = draftText([...pieces].sort(([a], [b]) => a - b).map(([, text]) => text).join(' '), s.config.terms);
      if (next.length > 8000) throw new Error('Taslak uzunluk sınırına ulaştı. Mevcut metni kontrol edip gönder; yeni dikte başlat.');
      const previousWarning = s.warning;
      s.pieces = pieces; s.gaps.delete(windowId); s.warning = rejectionWarning(s);
      s.lastSpokenAt = spokenAt;
      if (next !== s.raw) {s.raw = next; s.rawVersion++; await deliver(s, next);}
      else if (previousWarning !== s.warning) await ask(s, 'audio:warning', {warning: s.warning});
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
  const s = {id, config, queue: [], pieces: new Map(), gaps: new Map(), raw: '', rawVersion: 0, finalizedVersion: -1, utterance: 0, rejected: 0, warning: '', pendingSeconds: 0, nextResult: 1, pausedForBacklog: false, controller: new AbortController(), recording: true, processing: false, startedAt: Date.now(), lastMeter: 0, lastVoice: Date.now()};
  active = s;
  try {
    s.stream = await openMicrophone(config);
    if (active !== s) {await cleanup(s); throw new Error('Kayıt iptal edildi.');}
    s.context = new AudioContext({sampleRate: 16000}); s.sampleRate = s.context.sampleRate;
    if (config.backgroundGuard !== false) {
      const track = s.stream.getAudioTracks?.()[0] || s.stream.getTracks()[0];
      const matches = !config.noiseDeviceId || track.getSettings?.().deviceId === config.noiseDeviceId;
      s.filter = await createSpeechFilter({...config, noiseLevel: matches ? config.noiseLevel : 0, sampleRate: s.sampleRate});
      if (!matches) await ask(s, 'audio:warning', {warning: 'Mikrofon değişti. Arka planı ayarlardan yeniden ölç; eski seviye bu mikrofona uygulanmadı.'});
    }
    await s.context.audioWorklet.addModule(chrome.runtime.getURL('worklet.js'));
    if (active !== s) {await cleanup(s); throw new Error('Kayıt iptal edildi.');}
    s.windows = new SpeechWindows(s.sampleRate);
    s.segmenter = new Segmenter({sampleRate: s.sampleRate, threshold: config.sensitivity, pauseMs: config.pauseMs,
      onSpeechStart() {s.utterance++; s.correction?.abort();},
      onBoundary() {s.windows.boundary(); queueFinal(s);},
      onSegment(samples, {silenceMs} = {}) {
      if (active !== s) return;
      queueSpeech(s, samples, Date.now() - (silenceMs || 0));
      if (s.pendingSeconds >= PAUSE_PENDING_SECONDS && s.recording) {
        s.pausedForBacklog = true;
        queueMicrotask(() => {if (active === s) void finish(id);});
      }
    }});
    s.source = s.context.createMediaStreamSource(s.stream);
    s.worklet = new AudioWorkletNode(s.context, 'hizir-pcm');
    s.sink = s.context.createGain(); s.sink.gain.value = 0;
    s.source.connect(s.worklet); s.worklet.connect(s.sink); s.sink.connect(s.context.destination);
    s.consume = ({frame, speech}) => {
      const v = s.segmenter.push(frame, {speech}); s.rms = v.rms;
      if (v.speaking) s.lastVoice = Date.now();
    };
    s.accept = input => {
      if (active !== s || !s.recording) return;
      try {if (s.filter) {for (const frame of s.filter.push(input)) s.consume(frame);} else s.consume({frame: input});}
      catch (error) {void fail(s, error); return;}
      meter(s);
      if (Date.now() - s.lastVoice > 90000) void finish(id);
    };
    s.worklet.port.onmessage = event => s.accept(event.data);
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
  s.recording = false;
  for (const frame of s.filter?.flush() || []) s.consume(frame);
  s.segmenter.flush(); queueFinal(s, true); await cleanup(s);
  meter(s, true);
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.target !== 'offscreen' || sender.id !== chrome.runtime.id || sender.tab || (sender.url && sender.url !== chrome.runtime.getURL('background.js'))) return false;
  (async () => {
    if (message.type === 'capture:start') return start(message.sessionId, message.config);
    if (message.type === 'capture:finish') return finish(message.sessionId);
    if (message.type === 'capture:cancel') {const s = active; if (s?.id === message.sessionId) {active = null; s.controller.abort(); s.queue.length = 0; s.segmenter?.clear(); s.windows?.boundary(); await cleanup(s);} return true;}
    throw new Error('Geçersiz mikrofon işlemi.');
  })().then(data => respond({ok: true, data}), error => respond({ok: false, error: error.message}));
  return true;
});
