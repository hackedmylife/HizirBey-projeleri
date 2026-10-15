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
  const text = await transcribe(new Blob(['audio']), {...config, terms: ['Hızır Bey']}, undefined, async (url, init) => {assert.equal(init.body.get('language'), 'tr'); assert.equal(init.body.get('model'), 'whisper-large-v3'); assert.ok(init.body.get('prompt').includes('Hızır Bey')); return response({text: 'merhaba'});});
  assert.equal(text, 'merhaba');
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
  await assert.rejects(request('/models', {key: config.key, signal: controller.signal, fetcher: async (_, init) => {assert.equal(init.signal.aborted, true); throw new DOMException('Aborted', 'AbortError');}}), {name: 'AbortError'});
});
