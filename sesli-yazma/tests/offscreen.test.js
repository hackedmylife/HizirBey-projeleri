import test from 'node:test';
import assert from 'node:assert/strict';
const id = 'audio-test', origin = `chrome-extension://${id}/`, events = [], worklets = [], tracks = [], contexts = [];
let listener, waiting = null;
globalThis.chrome = {runtime: {id, getURL: path => origin + path, onMessage: {addListener(fn) {listener = fn;}}, async sendMessage(message) {events.push(message); return {ok: true, data: message.type === 'audio:examples' ? [] : true};}}};
Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {mediaDevices: {async getUserMedia() {const track = {stopped: false, stop() {this.stopped = true;}}; tracks.push(track); return {getTracks: () => [track]};}}}});
globalThis.AudioContext = class {
  constructor() {this.state = 'running'; this.sampleRate = 16000; this.audioWorklet = {async addModule() {}}; this.destination = {}; contexts.push(this);}
  createMediaStreamSource() {return {connect() {}, disconnect() {}};}
  createGain() {return {gain: {}, connect() {}, disconnect() {}};}
  async close() {this.state = 'closed';}
  async resume() {}
};
globalThis.AudioWorkletNode = class {constructor() {this.port = {}; worklets.push(this);} connect() {} disconnect() {}};
globalThis.fetch = async url => {
  if (waiting) await new Promise(resolve => {waiting.resolve = resolve;});
  const data = url.endsWith('/audio/transcriptions') ? {text: 'merhaba çekim henüz onaylanmadı'} : {choices: [{message: {content: '{"text":"Merhaba. Çekim henüz onaylanmadı."}'}}]};
  return new Response(JSON.stringify(data), {status: 200, headers: {'Content-Type': 'application/json'}});
};
await import('../extension/offscreen.js');
const send = (type, sessionId, config) => new Promise(resolve => {listener({target: 'offscreen', type, sessionId, config}, {id, url: origin + 'background.js'}, resolve);});
const config = {key: 'test-only-placeholder', model: 'whisper-large-v3', terms: [], correction: true, sensitivity: 0.008, pauseMs: 750};
const push = (count, level) => {for (let i = 0; i < count; i++) worklets.at(-1).port.onmessage?.({data: new Float32Array(2048).fill(level)});};
async function until(fn) {const deadline = Date.now() + 1000; while (!fn() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5)); assert.ok(fn());}
test('offscreen VAD to transcription and correction produces one ordered result', async () => {
  assert.equal((await send('capture:start', 'one', config)).ok, true);
  push(4, 0.04); push(7, 0);
  await until(() => events.some(x => x.type === 'audio:result' && x.sessionId === 'one'));
  const result = events.find(x => x.type === 'audio:result' && x.sessionId === 'one');
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
  assert.equal(events.filter(x => x.type === 'audio:result' && x.sessionId === 'three').length, 1);
  assert.ok(tracks.at(-1).stopped); assert.equal(contexts.at(-1).state, 'closed');
});
