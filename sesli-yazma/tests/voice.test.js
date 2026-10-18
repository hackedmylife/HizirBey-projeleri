import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSpeechFilter, microphoneConstraints, openMicrophone, backgroundLevel} from '../extension/lib/voice.js';
import {Segmenter} from '../extension/lib/audio.js';
import {cleanSettings} from '../extension/lib/core.js';
import {speechFixture, musicSignal} from './fixtures.mjs';
const binary = await readFile(new URL('../extension/vendor/fvad/libfvad.wasm', import.meta.url));
const speech = await speechFixture();
async function run(samples, config = {}, block = 2048) {
  const filter = await createSpeechFilter({sampleRate: 16000, ...config}, binary), segments = [];
  const segmenter = new Segmenter({sampleRate: 16000, onSegment: x => segments.push(x)});
  let voiced = 0, count = 0;
  const consume = frames => {for (const f of frames) {voiced += Number(f.speech); count++; segmenter.push(f.frame, {speech: f.speech});}};
  for (let i = 0; i < samples.length; i += block) consume(filter.push(samples.subarray(i, i + block)));
  consume(filter.push(new Float32Array(16000))); consume(filter.flush()); filter.destroy();
  return {segments, voiced, count};
}
test('music protection defaults preserve existing gain, microphone and explicit opt-out', () => {
  assert.equal(cleanSettings().backgroundGuard, true); assert.equal(cleanSettings().noiseLevel, 0);
  const config = cleanSettings({micGain: 1.6, deviceId: 'saved-mic', noiseLevel: 0.01, noiseDeviceId: 'saved-mic', backgroundGuard: false});
  assert.equal(config.micGain, 1.6); assert.equal(config.deviceId, 'saved-mic'); assert.equal(config.noiseLevel, 0.01); assert.equal(config.noiseDeviceId, 'saved-mic'); assert.equal(config.backgroundGuard, false);
  assert.equal(cleanSettings({noiseLevel: Infinity}).noiseLevel, 0); assert.equal(cleanSettings({noiseLevel: 99}).noiseLevel, 0.2);
});
test('microphone processing does not amplify background automatically; local playback mode is capability checked', async () => {
  assert.equal(microphoneConstraints({}).audio.autoGainControl, false);
  assert.equal(microphoneConstraints({backgroundGuard: false}).audio.autoGainControl, true);
  const applied = [], track = {getCapabilities: () => ({echoCancellation: [true, false, 'all']}), async applyConstraints(value) {applied.push(value);}}, stream = {getTracks: () => [track]};
  const devices = {async getUserMedia(request) {assert.deepEqual(request.audio.deviceId, {exact: 'mic'}); return stream;}};
  assert.equal(await openMicrophone({deviceId: 'mic'}, devices), stream); assert.deepEqual(applied, [{echoCancellation: {exact: 'all'}}]);
  track.applyConstraints = async () => {throw new Error('Unsupported on this device');};
  assert.equal(await openMicrophone({deviceId: 'mic'}, devices), stream, 'Keep ordinary cancellation when optional all-mode fails');
  track.getCapabilities = () => ({echoCancellation: true}); assert.equal(await openMicrophone({deviceId: 'mic'}, devices), stream);
});
test('two-second background estimate rejects bad samples and resists one isolated loud outlier', () => {
  assert.equal(backgroundLevel([...Array(50).fill(0.01), 0.9, NaN, Infinity, -1]), 0.01);
  assert.equal(backgroundLevel(Array(30).fill(0.8)), 0.2);
  assert.throws(() => backgroundLevel(Array(19).fill(0.01)), /tamamlanamadı/);
});
test('real bundled VAD plus tone check emits no speech segment for silence or sustained tones', async () => {
  assert.equal((await run(new Float32Array(16000 * 3))).segments.length, 0);
  for (const hz of [80, 220, 440, 880, 1760]) {
    const input = Float32Array.from({length: 16000 * 3}, (_, i) => 0.06 * Math.sin(2 * Math.PI * hz * i / 16000));
    assert.equal((await run(input)).segments.length, 0, `Tone ${hz} Hz must not be sent to speech recognition`);
  }
});
test('generated instrumental signal and calibrated quiet background speech stay below the gate', async () => {
  assert.equal((await run(musicSignal())).segments.length, 0);
  const music = musicSignal(speech.length / 16000), distant = speech.map((n, i) => n * 0.04 + music[i]);
  assert.equal((await run(distant, {noiseLevel: 0.009})).segments.length, 0, 'This is a level test, not speaker identification');
});
test('public speech and louder speech mixed with generated music still produce complete audio segments', async () => {
  const clean = await run(speech); assert.ok(clean.voiced > 160); assert.ok(clean.segments.length > 0);
  const music = musicSignal(speech.length / 16000), mixed = speech.map((n, i) => n + music[i]);
  const result = await run(mixed, {noiseLevel: 0.007});
  assert.ok(result.voiced > 150); assert.ok(result.segments.length > 0);
  assert.ok(result.segments.reduce((n, x) => n + x.length, 0) > 16000 * 3);
});
test('VAD block boundaries preserve sample order; partial final frames flush once', async () => {
  assert.equal((await run(speech, {}, 137)).voiced, (await run(speech, {}, 2048)).voiced);
  const filter = await createSpeechFilter({sampleRate: 16000}, binary);
  assert.equal(filter.push(new Float32Array(319)).length, 0); assert.equal(filter.flush().length, 1); assert.equal(filter.flush().length, 0);
  filter.destroy(); filter.destroy(); assert.throws(() => filter.push(new Float32Array(320)), /kapalı/);
});
