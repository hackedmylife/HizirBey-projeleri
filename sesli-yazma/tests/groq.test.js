import test from 'node:test';
import assert from 'node:assert/strict';
import {request, correct, transcribe} from '../extension/lib/groq.js';
const config = {key: 'unit-test-placeholder', model: 'whisper-large-v3', terms: [], correction: true};
const response = data => new Response(JSON.stringify(data), {status: 200, headers: {'Content-Type': 'application/json'}});
test('quota errors never retry, change provider or call a billing API', async () => {
  let calls = 0;
  await assert.rejects(request('/audio/transcriptions', {key: config.key, fetcher: async url => {calls++; assert.equal(url, 'https://api.groq.com/openai/v1/audio/transcriptions'); return new Response('{}', {status: 429, headers: {'retry-after': '3'}});}}), error => error.status === 429 && error.retryAfter === 3 && /Ücretli kullanıma geçilmedi/.test(error.message));
  assert.equal(calls, 1); await assert.rejects(request('/billing', {key: config.key}), /İzin verilmeyen/);
});
test('transcription uses Turkish, fixed model and short vocabulary; not chat history', async () => {
  const text = await transcribe(new Blob(['audio']), {...config, terms: ['Hızır Bey']}, undefined, async (url, init) => {assert.equal(init.body.get('language'), 'tr'); assert.equal(init.body.get('model'), 'whisper-large-v3'); assert.equal(init.body.get('timestamp_granularities[]'), 'segment'); assert.ok(init.body.get('prompt').includes('Hızır Bey')); return response({text: 'merhaba', segments: [{avg_logprob: -0.1, no_speech_prob: 0.01, compression_ratio: 1.1}]});});
  assert.equal(text, 'merhaba');
});
test('an unsafe ASR result is rejected without retries or any text correction call', async () => {
  let calls = 0;
  await assert.rejects(transcribe(new Blob(['audio']), config, undefined, async () => {calls++; return response({text: 'Erişim ve Altyazı M.K. Ses deneme 1-2.', segments: [{avg_logprob: -0.1, no_speech_prob: 0.01, compression_ratio: 1.1}]});}), /Şüpheli dikte yazılmadı/);
  assert.equal(calls, 1);
});
test('unsafe correction is discarded while a clean original stays intact', async () => {
  const result = await correct('merhaba iyi günler', config, undefined, async () => response({choices: [{message: {content: JSON.stringify({text: 'M.K. Merhaba, iyi günler.'})}}]}));
  assert.equal(result.text, 'Merhaba iyi günler.'); assert.equal(result.corrected, false); assert.match(result.warning, /Şüpheli/);
  let calls = 0;
  await assert.rejects(correct('Altyazı M.K.', config, undefined, async () => {calls++;}), /Şüpheli dikte/); assert.equal(calls, 0);
});
test('unsafe LLM correction is replaced with the original meaning', async () => {
  const result = await correct('Çekim henüz onaylanmadı', config, undefined, async () => response({choices: [{message: {content: JSON.stringify({text: 'Çekim onaylandı.'})}}]}));
  assert.equal(result.text, 'Çekim henüz onaylanmadı.'); assert.ok(result.warning); assert.equal(result.corrected, false);
});
test('normal Turkish correction and no-correction mode work independently', async () => {
  const result = await correct('merhaba iyi günler', config, undefined, async () => response({choices: [{message: {content: '{"text":"Merhaba, iyi günler."}'}}]}));
  assert.equal(result.text, 'Merhaba, iyi günler.'); assert.equal(result.corrected, true);
  assert.equal((await correct('merhaba', {...config, correction: false}, undefined, () => {throw new Error('Must not call API');})).text, 'Merhaba.');
});
test('canceled audio cannot produce a later API result', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(request('/models', {key: config.key, signal: controller.signal, fetcher: async () => {assert.fail('A canceled request must never reach fetch');}}), {name: 'AbortError'});
});
test('temporary service failures retry the same request and reserve each attempt', async () => {
  let calls = 0; const attempts = [], retries = [], body = new FormData(); body.set('file', 'same-audio');
  const result = await request('/audio/transcriptions', {key: config.key, body, retryDelays: [0, 0], onAttempt: x => attempts.push(x.attempt), onRetry: x => retries.push(x.attempt), fetcher: async (_url, init) => {assert.equal(init.body, body); calls++; return calls < 3 ? new Response('{}', {status: calls === 1 ? 503 : 502}) : response({text: 'tek sonuç'});}});
  assert.deepEqual(result, {text: 'tek sonuç'}); assert.equal(calls, 3); assert.deepEqual(attempts, [1, 2, 3]); assert.deepEqual(retries, [2, 3]);
});
test('cancel during retry backoff makes no later request', async () => {
  const controller = new AbortController(); let calls = 0;
  const pending = request('/models', {key: config.key, signal: controller.signal, onRetry() {queueMicrotask(() => controller.abort());}, fetcher: async () => {calls++; throw new TypeError('Network disconnected');}});
  await assert.rejects(pending, {name: 'AbortError'}); assert.equal(calls, 1);
});
test('timeout aborts one attempt before a successful retry; ordinary delay does not duplicate', async () => {
  let calls = 0, aborted = false;
  const result = await request('/models', {key: config.key, timeout: 15, retryDelays: [0], fetcher: async (_url, init) => {calls++; if (calls === 1) return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => {aborted = true; reject(new DOMException('Timeout', 'AbortError'));}, {once: true})); return response({data: []});}});
  assert.deepEqual(result, {data: []}); assert.equal(aborted, true); assert.equal(calls, 2);
  calls = 0;
  await request('/models', {key: config.key, timeout: 80, fetcher: async () => {calls++; await new Promise(resolve => setTimeout(resolve, 25)); return response({data: []});}});
  assert.equal(calls, 1);
});
test('exhausted network retries, client errors and quota guards have finite limits', async () => {
  let calls = 0;
  await assert.rejects(request('/models', {key: config.key, retryDelays: [0, 0], fetcher: async () => {calls++; throw new TypeError('offline');}}), /bağlantısı/);
  assert.equal(calls, 3);
  for (const status of [400, 401, 403, 429]) {
    calls = 0;
    await assert.rejects(request('/models', {key: config.key, fetcher: async () => {calls++; return new Response('{}', {status});}}), error => error.status === status);
    assert.equal(calls, 1);
  }
  calls = 0;
  await assert.rejects(request('/models', {key: config.key, retryDelays: [0, 0], onAttempt({attempt}) {if (attempt === 2) throw new Error('Yerel ücretsiz kota doldu.');}, fetcher: async () => {calls++; return new Response('{}', {status: 503});}}), /Yerel ücretsiz kota/);
  assert.equal(calls, 1);
});
