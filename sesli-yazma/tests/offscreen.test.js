import test, {afterEach} from 'node:test';
import assert from 'node:assert/strict';
const id = 'audio-test', origin = `chrome-extension://${id}/`, events = [], worklets = [], tracks = [], contexts = [];
let listener, waiting = null, unsafeSpeech = false, quotaWait = null, correctionWait = null, latestSession, speechTexts = [], correctionOutput = null;
const fetchEvents = [], correctionInputs = [], speechBytes = [];
globalThis.chrome = {runtime: {id, getURL: path => origin + path, onMessage: {addListener(fn) {listener = fn;}}, async sendMessage(message) {
  events.push(message);
  if (message.type === 'audio:reserve' && message.kind === 'speech' && quotaWait?.sessionId === message.sessionId && quotaWait.remaining-- > 0) return {ok: true, data: {waitMs: quotaWait.waitMs}};
  return {ok: true, data: message.type === 'audio:examples' ? [] : true};
}}};
Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {mediaDevices: {async getUserMedia() {const track = {stopped: false, stop() {this.stopped = true;}}; tracks.push(track); return {getTracks: () => [track]};}}}});
globalThis.AudioContext = class {
  constructor() {this.state = 'running'; this.sampleRate = 16000; this.audioWorklet = {async addModule() {}}; this.destination = {}; contexts.push(this);}
  createMediaStreamSource() {return {connect() {}, disconnect() {}};}
  createGain() {return {gain: {}, connect() {}, disconnect() {}};}
  async close() {this.state = 'closed';}
  async resume() {}
};
globalThis.AudioWorkletNode = class {constructor() {this.port = {}; worklets.push(this);} connect() {} disconnect() {}};
globalThis.fetch = async (url, init) => {
  fetchEvents.push(url);
  if (url.endsWith('/audio/transcriptions')) speechBytes.push(init.body.get('file').size);
  if (waiting) await new Promise(resolve => {waiting.resolve = resolve;});
  if (correctionWait && url.endsWith('/chat/completions')) await new Promise(resolve => {correctionWait.resolve = resolve;});
  const raw = url.endsWith('/chat/completions') ? JSON.parse(JSON.parse(init.body).messages[1].content).text : '';
  if (raw) correctionInputs.push(raw);
  const data = url.endsWith('/audio/transcriptions') ? {text: unsafeSpeech ? 'Erişim ve Altyazı M.K.' : speechTexts.shift() || 'merhaba çekim henüz onaylanmadı', segments: [{avg_logprob: -0.1, no_speech_prob: 0.01, compression_ratio: 1.1}]} : {choices: [{message: {content: JSON.stringify({text: correctionOutput ? correctionOutput(raw) : 'Merhaba. Çekim henüz onaylanmadı.'})}}]};
  return new Response(JSON.stringify(data), {status: 200, headers: {'Content-Type': 'application/json'}});
};
await import('../extension/offscreen.js');
const send = (type, sessionId, config) => new Promise(resolve => {if (type === 'capture:start') latestSession = sessionId; listener({target: 'offscreen', type, sessionId, config}, {id, url: origin + 'background.js'}, resolve);});
afterEach(async () => {
  await send('capture:cancel', latestSession);
  const releaseSpeech = waiting?.resolve, releaseCorrection = correctionWait?.resolve;
  waiting = null; correctionWait = null; quotaWait = null; unsafeSpeech = false; speechTexts = []; correctionOutput = null; correctionInputs.length = 0;
  releaseSpeech?.(); releaseCorrection?.();
});
const config = {key: 'test-only-placeholder', model: 'whisper-large-v3', terms: [], correction: true, sensitivity: 0.008, pauseMs: 750, backgroundGuard: false};
const push = (count, level) => {for (let i = 0; i < count; i++) worklets.at(-1).port.onmessage?.({data: new Float32Array(2048).fill(level)});};
async function until(fn, timeout = 1000) {const deadline = Date.now() + timeout; while (!fn() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5)); assert.ok(fn());}
test('offscreen writes an immediate draft then punctuates the complete text', async () => {
  assert.equal((await send('capture:start', 'one', config)).ok, true);
  push(4, 0.04); push(9, 0);
  await until(() => events.some(x => x.type === 'audio:result' && x.sessionId === 'one' && x.final));
  const results = events.filter(x => x.type === 'audio:result' && x.sessionId === 'one');
  assert.equal(results[0].text, 'Merhaba çekim henüz onaylanmadı'); assert.equal(results[0].final, false);
  assert.ok(results.every(x => x.replace));
  const result = results.at(-1);
  assert.equal(result.text, 'Merhaba. Çekim henüz onaylanmadı.');
  await send('capture:cancel', 'one'); assert.ok(tracks.at(-1).stopped); assert.equal(contexts.at(-1).state, 'closed');
});
test('canceling a pending provider response cannot insert stale text', async () => {
  waiting = {};
  await send('capture:start', 'two', config); push(4, 0.04); push(7, 0);
  await until(() => Boolean(waiting.resolve));
  await send('capture:cancel', 'two');
  const release = waiting.resolve; waiting = null; release();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(events.some(x => x.type === 'audio:result' && x.sessionId === 'two'), false);
  assert.ok(tracks.at(-1).stopped); assert.equal(contexts.at(-1).state, 'closed');
});
test('stop flushes the last spoken words and releases microphone resources', async () => {
  await send('capture:start', 'three', config); push(4, 0.04);
  await send('capture:finish', 'three');
  await until(() => events.some(x => x.type === 'audio:done' && x.sessionId === 'three'));
  assert.equal(events.filter(x => x.type === 'audio:result' && x.sessionId === 'three').length, 2);
  assert.equal(events.filter(x => x.type === 'audio:result' && x.sessionId === 'three').at(-1).final, true);
  assert.ok(tracks.at(-1).stopped); assert.equal(contexts.at(-1).state, 'closed');
});
test('silence and elapsed session time never stop capture; explicit finish still flushes the last words', async t => {
  t.mock.timers.enable({apis: ['Date', 'setTimeout']});
  try {
    await send('capture:start', 'space-duration', config);
    t.mock.timers.tick(91000); push(1, 0);
    assert.equal(tracks.at(-1).stopped, false, 'A long silence must not end dictation');
    t.mock.timers.tick(16 * 60 * 1000); push(1, 0);
    assert.equal(tracks.at(-1).stopped, false, 'Elapsed time must not end dictation');
    assert.equal(events.some(x => x.sessionId === 'space-duration' && x.type === 'audio:done'), false);
    speechTexts = ['son kelimeler de yazılsın']; correctionOutput = raw => raw + '.';
    push(4, 0.04); await send('capture:finish', 'space-duration');
    assert.equal(tracks.at(-1).stopped, true);
  } finally {t.mock.timers.reset();}
  await until(() => events.some(x => x.sessionId === 'space-duration' && x.type === 'audio:done'));
  assert.equal(events.filter(x => x.sessionId === 'space-duration' && x.type === 'audio:result').at(-1).text, 'Son kelimeler de yazılsın.');
});
test('one hallucinated segment is blocked while later clean speech continues', async () => {
  unsafeSpeech = true;
  await send('capture:start', 'unsafe', config); push(4, 0.04); push(7, 0);
  await until(() => events.some(x => x.type === 'audio:warning' && x.sessionId === 'unsafe'));
  assert.equal(events.some(x => x.type === 'audio:result' && x.sessionId === 'unsafe'), false);
  assert.equal(tracks.at(-1).stopped, false); unsafeSpeech = false;
  push(4, 0.04); push(9, 0);
  await until(() => events.some(x => x.type === 'audio:result' && x.sessionId === 'unsafe'));
  assert.ok(events.filter(x => x.type === 'audio:result' && x.sessionId === 'unsafe').every(x => !x.text.includes('M.K.')));
});
test('long provider delay buffers past the old four-segment limit and pauses capture safely', async () => {
  waiting = {};
  await send('capture:start', 'backlog', config);
  // Real worklet messages yield between PCM frames; let the capture-stop
  // microtask run instead of synchronously injecting 14 seconds at a time.
  for (let n = 0; n < 990; n++) {push(1, 0.04); await Promise.resolve();}
  await until(() => Boolean(waiting.resolve));
  const paused = events.filter(x => x.type === 'audio:meter' && x.sessionId === 'backlog' && x.pausedForBacklog).at(-1);
  assert.ok(paused); assert.equal(paused.recording, false); assert.ok(paused.pendingSeconds >= 106 && paused.pendingSeconds <= 121);
  assert.equal(events.some(x => x.type === 'audio:error' && x.sessionId === 'backlog'), false);
  assert.equal(events.filter(x => x.type === 'audio:reserve' && x.sessionId === 'backlog').length, 1, 'Only one request is in flight');
  assert.ok(tracks.at(-1).stopped);
  await send('capture:cancel', 'backlog'); const release = waiting.resolve; waiting = null; release();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(events.some(x => x.type === 'audio:result' && x.sessionId === 'backlog'), false);
});
test('consecutive utterances transfer without an artificial 3.5-second request gap', async () => {
  speechTexts = ['merhaba', 'merhaba devam ediyor'];
  await send('capture:start', 'burst', {...config, correction: false, pauseMs: 500});
  const started = Date.now();
  push(4, 0.04); push(4, 0); push(4, 0.04); push(4, 0);
  await until(() => events.filter(x => x.type === 'audio:result' && x.sessionId === 'burst').length === 2);
  const results = events.filter(x => x.type === 'audio:result' && x.sessionId === 'burst');
  assert.deepEqual(results.map(x => x.segmentId), [1, 2]); assert.ok(Date.now() - started < 1000);
  assert.ok(results.every(x => Number.isFinite(x.spokenAt)));
  await send('capture:cancel', 'burst');
});
test('a rolling-minute quota wait resumes the same audio once a slot opens', async () => {
  quotaWait = {sessionId: 'quota-wait', waitMs: 60, remaining: 1};
  const count = fetchEvents.length;
  await send('capture:start', 'quota-wait', {...config, correction: false}); push(4, 0.04); push(7, 0);
  await until(() => events.some(x => x.sessionId === 'quota-wait' && x.waitingForQuota));
  assert.equal(fetchEvents.length, count);
  await until(() => events.some(x => x.type === 'audio:result' && x.sessionId === 'quota-wait'));
  assert.equal(fetchEvents.length, count + 1);
  await send('capture:cancel', 'quota-wait'); quotaWait = null;
});
test('canceling a quota wait sends no provider request or stale text', async () => {
  quotaWait = {sessionId: 'quota-cancel', waitMs: 1000, remaining: 1}; const count = fetchEvents.length;
  await send('capture:start', 'quota-cancel', config); push(4, 0.04); push(7, 0);
  await until(() => events.some(x => x.sessionId === 'quota-cancel' && x.waitingForQuota));
  await send('capture:cancel', 'quota-cancel'); await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(fetchEvents.length, count); assert.equal(events.some(x => x.type === 'audio:result' && x.sessionId === 'quota-cancel'), false);
  quotaWait = null;
});
test('fast mode bounds stalled correction and ignores its late response', async () => {
  correctionWait = {};
  await send('capture:start', 'slow-correction', {...config, fastMode: true}); push(4, 0.04); push(9, 0);
  await until(() => Boolean(correctionWait.resolve)); const started = Date.now();
  await until(() => events.some(x => x.type === 'audio:result' && x.sessionId === 'slow-correction' && x.final), 4500);
  const results = events.filter(x => x.type === 'audio:result' && x.sessionId === 'slow-correction');
  assert.equal(results.length, 2); assert.equal(results.at(-1).text, 'Merhaba çekim henüz onaylanmadı');
  assert.match(results.at(-1).warning, /Noktalama kontrolü yetişmedi/); assert.ok(Date.now() - started < 4000);
  const release = correctionWait.resolve; correctionWait = null; release();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(events.filter(x => x.type === 'audio:result' && x.sessionId === 'slow-correction').length, 2);
  await send('capture:cancel', 'slow-correction');
});
test('five chunks of a long sentence stay continuous and receive one whole-text punctuation pass', async () => {
  speechTexts = ['çekim talebiniz ile ilgili', 'kontrollerimiz sürüyor henüz', 'onaylanmadı bu nedenle', 'bir süre daha beklemenizi', 'rica ediyoruz bilgi vereceğiz'];
  const expected = 'Çekim talebiniz ile ilgili kontrollerimiz sürüyor henüz onaylanmadı bu nedenle bir süre daha beklemenizi rica ediyoruz bilgi vereceğiz';
  correctionOutput = raw => raw + '.';
  await send('capture:start', 'long-sentence', config); push(282, 0.04);
  await until(() => events.filter(x => x.type === 'audio:result' && x.sessionId === 'long-sentence').length === 4);
  assert.equal(correctionInputs.length, 0, 'Audio chunk boundaries must not trigger punctuation');
  assert.equal(tracks.at(-1).stopped, false);
  push(9, 0);
  await until(() => events.some(x => x.type === 'audio:result' && x.sessionId === 'long-sentence' && x.final));
  const results = events.filter(x => x.type === 'audio:result' && x.sessionId === 'long-sentence');
  assert.equal(results.length, 6); assert.equal(results.at(-1).text, expected + '.');
  assert.ok(results.slice(0, -1).every(x => !/[.!?]$/.test(x.text)));
  assert.deepEqual(correctionInputs, [expected]); assert.ok(results.every(x => x.replace));
  assert.equal(tracks.at(-1).stopped, false, 'A final period never stops capture');
});
test('new speech invalidates delayed punctuation without replacing the continuing draft', async () => {
  speechTexts = ['ilk bölüm', 'devam eden cümle']; correctionOutput = raw => raw + '.'; correctionWait = {};
  await send('capture:start', 'resume', config); push(4, 0.04); push(9, 0);
  await until(() => Boolean(correctionWait.resolve)); const release = correctionWait.resolve;
  push(4, 0.04); correctionWait = null; push(9, 0);
  await until(() => events.some(x => x.type === 'audio:result' && x.sessionId === 'resume' && x.final));
  release(); await new Promise(resolve => setTimeout(resolve, 20));
  const results = events.filter(x => x.type === 'audio:result' && x.sessionId === 'resume');
  assert.equal(results.at(-1).text, 'İlk bölüm devam eden cümle.');
  assert.equal(results.filter(x => x.final).length, 1);
});
test('repeated rejected chunks stay blocked without closing the microphone; clean speech still works', async () => {
  unsafeSpeech = true; await send('capture:start', 'repeated-unsafe', config);
  for (let i = 0; i < 4; i++) {
    push(4, 0.04); push(9, 0);
    await until(() => events.filter(x => x.sessionId === 'repeated-unsafe' && x.type === 'audio:warning').length >= i + 1);
  }
  assert.equal(events.some(x => x.sessionId === 'repeated-unsafe' && x.type === 'audio:error'), false);
  assert.equal(events.some(x => x.sessionId === 'repeated-unsafe' && x.type === 'audio:result'), false);
  assert.equal(tracks.at(-1).stopped, false);
  const warning = events.filter(x => x.sessionId === 'repeated-unsafe' && x.type === 'audio:warning').at(-1).warning;
  assert.match(warning, /4 ses bölümü/); assert.match(warning, /Yanlış anlaşılabilecek/); assert.match(warning, /mikrofonu/);
  unsafeSpeech = false; push(4, 0.04); push(9, 0);
  await until(() => events.some(x => x.sessionId === 'repeated-unsafe' && x.type === 'audio:result'));
  assert.equal(tracks.at(-1).stopped, false);
  assert.ok(events.filter(x => x.sessionId === 'repeated-unsafe' && x.type === 'audio:result').every(x => !x.text.includes('M.K.') && x.warning.includes('4 ses bölümü')));
});
test('cumulative recognition replaces its own partial text instead of adding it again', async () => {
  speechTexts = ['Örnek', 'Örnek com', 'Örnek com tr']; correctionOutput = raw => raw;
  await send('capture:start', 'partial-window', {...config, pauseMs: 500});
  for (let i = 0; i < 3; i++) {
    push(4, 0.04); push(4, 0);
    await until(() => events.filter(x => x.sessionId === 'partial-window' && x.type === 'audio:result' && !x.final).length >= i + 1);
  }
  const results = events.filter(x => x.sessionId === 'partial-window' && x.type === 'audio:result');
  assert.deepEqual(results.map(x => x.text), ['Örnek', 'Örnek com', 'Örnek com tr']);
  const bytes = speechBytes.slice(-3); assert.ok(bytes[0] < bytes[1] && bytes[1] < bytes[2], 'The model receives growing audio, not instructions to delete repeated words');
  push(4, 0); await until(() => events.some(x => x.sessionId === 'partial-window' && x.final));
  assert.deepEqual(correctionInputs, ['Örnek com tr']);
});
test('actual spoken repetitions survive and a rejected preview can recover with more audio', async () => {
  unsafeSpeech = true;
  await send('capture:start', 'window-recovery', {...config, pauseMs: 500, correction: false}); push(4, 0.04); push(4, 0);
  await until(() => events.some(x => x.sessionId === 'window-recovery' && x.type === 'audio:warning'));
  unsafeSpeech = false; speechTexts = ['evet evet talebiniz bekliyor'];
  push(4, 0.04); push(4, 0);
  await until(() => events.some(x => x.sessionId === 'window-recovery' && x.type === 'audio:result'));
  const result = events.filter(x => x.sessionId === 'window-recovery' && x.type === 'audio:result').at(-1);
  assert.equal(result.text, 'Evet evet talebiniz bekliyor'); assert.equal(result.warning, ''); assert.equal(tracks.at(-1).stopped, false);
});
test('during a delayed request, obsolete previews are coalesced and quota counts only sent windows', async () => {
  waiting = {}; speechTexts = ['ilk bölüm', 'ilk bölüm ve devamı tamamlandı'];
  await send('capture:start', 'window-coalesce', {...config, pauseMs: 500, correction: false});
  push(4, 0.04); push(4, 0); await until(() => Boolean(waiting.resolve));
  for (let i = 0; i < 3; i++) {push(4, 0.04); push(4, 0);}
  const before = events.filter(x => x.sessionId === 'window-coalesce' && x.type === 'audio:reserve');
  assert.equal(before.length, 1);
  const release = waiting.resolve; waiting = null; release();
  await until(() => events.filter(x => x.sessionId === 'window-coalesce' && x.type === 'audio:result').length === 2);
  const results = events.filter(x => x.sessionId === 'window-coalesce' && x.type === 'audio:result');
  assert.equal(results.at(-1).text, 'İlk bölüm ve devamı tamamlandı');
  assert.equal(events.filter(x => x.sessionId === 'window-coalesce' && x.type === 'audio:reserve').length, 2);
});
test('an unchanged ASR result does not rewrite a reviewed or already punctuated draft', async () => {
  speechTexts = ['evet']; correctionOutput = raw => raw + '.';
  await send('capture:start', 'unchanged-preview', {...config, pauseMs: 500});
  push(4, 0.04); push(4, 0);
  await until(() => events.some(x => x.sessionId === 'unchanged-preview' && x.type === 'audio:result'));
  speechTexts = ['evet']; push(4, 0.04); push(4, 0);
  await until(() => events.filter(x => x.sessionId === 'unchanged-preview' && x.type === 'audio:reserve').length === 2);
  push(4, 0);
  await until(() => events.some(x => x.sessionId === 'unchanged-preview' && x.final));
  const results = events.filter(x => x.sessionId === 'unchanged-preview' && x.type === 'audio:result');
  assert.deepEqual(results.map(x => x.text), ['Evet', 'Evet.']);
});
