import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserSpeech, SpeechPlayout} from '../extension/lib/browser-speech.js';

function fixture() {
  const turns = [], texts = [], warnings = [], errors = [], states = [], track = {kind: 'audio', readyState: 'live'};
  class Recognition {
    constructor() {this.unspokenPunctuation = true; this.processLocally = true; turns.push(this);}
    start(input) {this.track = input; this.onstart?.();}
    stop() {this.stopped = true; this.onend?.();}
    abort() {this.aborted = true;}
    emit(...texts) {this.onresult?.({results: texts.map(transcript => Object.assign([{transcript}], {isFinal: true}))});}
  }
  const speech = new BrowserSpeech({Recognition, track, onText: text => texts.push(text), onWarning: text => warnings.push(text), onError: error => errors.push(error), onState: ready => states.push(ready)});
  return {speech, turns, texts, warnings, errors, states, track};
}
test('Chrome receives the selected processed track, Turkish continuous results, and no automatic punctuation', () => {
  const f = fixture(); f.speech.start(); const turn = f.turns[0];
  assert.equal(turn.track, f.track); assert.equal(turn.lang, 'tr-TR'); assert.equal(turn.continuous, true); assert.equal(turn.interimResults, true); assert.equal(turn.unspokenPunctuation, false);
  turn.emit('mer'); turn.emit('merhaba'); turn.emit('merhaba', 'devam ediyor');
  assert.deepEqual(f.texts, ['mer', 'merhaba', 'merhaba devam ediyor']);
  f.speech.cancel();
});
test('a browser turn ending during a pause restarts while preserving actual repeated words', async t => {
  t.mock.timers.enable({apis: ['Date', 'setTimeout']});
  const f = fixture();
  try {
    f.speech.start(); f.turns[0].emit('evet evet'); f.turns[0].onend();
    t.mock.timers.tick(151); assert.equal(f.turns.length, 2);
    f.turns[1].emit('evet talebiniz bekliyor');
    assert.equal(f.texts.at(-1), 'evet evet evet talebiniz bekliyor');
    await f.speech.finish(); t.mock.timers.tick(60000);
    assert.equal(f.turns.length, 2); assert.equal(f.turns[1].stopped, true); assert.deepEqual(f.errors, []);
  } finally {f.speech.cancel(); t.mock.timers.reset();}
});
test('no-speech is a resumable pause, but repeated network failures stop without another provider', t => {
  t.mock.timers.enable({apis: ['setTimeout']}); const f = fixture();
  try {
    f.speech.start(); f.turns[0].onerror({error: 'no-speech'}); f.turns[0].onend();
    t.mock.timers.tick(151); assert.equal(f.turns.length, 2); assert.deepEqual(f.errors, []);
    for (let i = 0; i < 4; i++) {const turn = f.turns.at(-1); turn.onerror({error: 'network'}); turn.onend?.(); t.mock.timers.tick(5000);}
    assert.equal(f.errors.length, 1); assert.match(f.errors[0].message, /bağlanılamadı/); assert.equal(f.speech.wanted, false);
  } finally {f.speech.cancel(); t.mock.timers.reset();}
});
test('cancel blocks scheduled reconnects and callbacks from the previous recognition instance', t => {
  t.mock.timers.enable({apis: ['setTimeout']}); const f = fixture();
  try {
    f.speech.start(); const staleResult = f.turns[0].onresult; f.turns[0].onend(); f.speech.cancel();
    t.mock.timers.tick(60000); staleResult({results: [[{transcript: 'geç sonuç'}]]});
    assert.equal(f.turns.length, 1); assert.deepEqual(f.texts, []);
  } finally {t.mock.timers.reset();}
});
test('explicit stop accepts the last result and timeout preserves the visible draft', async t => {
  t.mock.timers.enable({apis: ['setTimeout']}); const f = fixture();
  try {
    f.speech.start(); f.turns[0].emit('son görünen taslak'); f.turns[0].stop = () => {};
    const pending = f.speech.finish(5000); t.mock.timers.tick(5001); await pending;
    assert.equal(f.turns[0].aborted, true); assert.equal(f.texts.at(-1), 'son görünen taslak'); assert.match(f.warnings.at(-1), /zamanında/);
  } finally {f.speech.cancel(); t.mock.timers.reset();}
});
test('unsafe recognition is blocked; microphone denial is final and does not reconnect', t => {
  t.mock.timers.enable({apis: ['setTimeout']}); const f = fixture();
  try {
    f.speech.start(); f.turns[0].emit('M.K.'); assert.deepEqual(f.texts, []); assert.equal(f.warnings.length, 1);
    f.turns[0].emit('merhaba'); assert.deepEqual(f.texts, ['merhaba']);
    f.turns[0].onerror({error: 'not-allowed'}); t.mock.timers.tick(60000);
    assert.equal(f.errors.length, 1); assert.equal(f.turns.length, 1); assert.equal(f.turns[0].aborted, true);
  } finally {f.speech.cancel(); t.mock.timers.reset();}
});
test('filtered playout silences rejected background and retains the beginning of newly detected speech', () => {
  const nodes = [], buffers = [], destination = {}, context = {currentTime: 0, sampleRate: 16000,
    createBuffer(_channels, size) {const buffer = {samples: new Float32Array(size), copyToChannel(data) {this.samples.set(data);}}; buffers.push(buffer); return buffer;},
    createBufferSource() {const node = {connect(target) {assert.equal(target, destination);}, start(at) {this.at = at;}, disconnect() {this.disconnected = true;}, stop() {this.stopped = true;}}; nodes.push(node); return node;}
  };
  const playout = new SpeechPlayout(context, {micGain: 1.35}, destination);
  for (let i = 0; i < 12; i++) {context.currentTime += 0.02; playout.push({frame: new Float32Array(320).fill(0.02), speech: false});}
  assert.ok(buffers.every(x => x.samples.every(n => n === 0)));
  context.currentTime += 0.02; playout.push({frame: new Float32Array(320).fill(0.04), speech: true}); playout.flush();
  assert.equal(buffers.length, 13); assert.ok(Math.abs(buffers[6].samples[0] - 0.027) < 1e-6); assert.ok(Math.abs(buffers.at(-1).samples[0] - 0.054) < 1e-6);
  assert.ok(nodes.every((node, i) => !i || node.at > nodes[i - 1].at)); playout.destroy(); assert.ok(nodes.every(x => x.stopped && x.disconnected));
});
