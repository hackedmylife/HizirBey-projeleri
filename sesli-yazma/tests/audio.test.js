import test from 'node:test';
import assert from 'node:assert/strict';
import {Segmenter, SpeechWindows, wavBlob, boostSample} from '../extension/lib/audio.js';
test('nearby previews share one bounded audio window without duplicating samples', () => {
  const windows = new SpeechWindows(1000);
  const first = windows.append(new Float32Array(600).fill(0.03));
  const next = windows.append(new Float32Array(900).fill(0.04));
  assert.equal(first.windowId, next.windowId); assert.equal(first.samples.length, 600);
  assert.equal(next.samples.length, 1500); assert.equal(next.samples[599], first.samples[599]);
  assert.ok(Math.abs(next.samples[600] - 0.04) < 1e-6);
  windows.boundary(); const afterPause = windows.append(new Float32Array(400));
  assert.notEqual(afterPause.windowId, next.windowId); assert.equal(afterPause.samples.length, 400);
  const full = windows.append(new Float32Array(11500)); assert.equal(full.windowId, afterPause.windowId);
  const rollover = windows.append(new Float32Array(300));
  assert.notEqual(rollover.windowId, full.windowId); assert.equal(rollover.samples.length, 300);
});
test('WAV has correct mono PCM headers and bounded sample values', async () => {
  const blob = wavBlob(new Float32Array([-2, 0, 2]), 16000), buffer = await blob.arrayBuffer(), data = new DataView(buffer);
  assert.equal(new TextDecoder().decode(buffer.slice(0, 4)), 'RIFF'); assert.equal(data.getUint32(24, true), 16000); assert.equal(data.getUint16(22, true), 1); assert.equal(data.getInt16(44, true), -32768); assert.equal(data.getInt16(48, true), 32767);
});
test('silence makes no requests; a pause closes a complete speech segment', () => {
  const segments = [], s = new Segmenter({sampleRate: 1000, threshold: 0.01, pauseMs: 700, onSegment: x => segments.push(x)});
  for (let i = 0; i < 20; i++) s.push(new Float32Array(100));
  assert.equal(segments.length, 0);
  for (let i = 0; i < 5; i++) s.push(new Float32Array(100).fill(0.03));
  for (let i = 0; i < 7; i++) s.push(new Float32Array(100));
  assert.equal(segments.length, 1); assert.ok(segments[0].length >= 650 && segments[0].length < 1200, 'Keep word endings but trim the long trailing pause'); assert.equal(s.length, 0);
});
test('a stop flushes voiced audio once and discards short clicks', () => {
  const segments = [], s = new Segmenter({sampleRate: 1000, onSegment: x => segments.push(x)});
  s.push(new Float32Array(100).fill(0.05)); s.flush(); assert.equal(segments.length, 0);
  s.push(new Float32Array(500).fill(0.05)); s.flush(); s.flush(); assert.equal(segments.length, 1);
});
test('quiet speech is boosted by 35 percent while loud samples retain headroom', async () => {
  assert.ok(Math.abs(boostSample(0.1, 1.35) - 0.135) < 1e-6);
  for (const value of [-2, -1, 1, 2, NaN, Infinity]) assert.ok(Number.isFinite(boostSample(value, 2)) && Math.abs(boostSample(value, 2)) <= 1);
  assert.equal(boostSample(0, 2), 0); assert.equal(boostSample(-0.1, 1.35), -boostSample(0.1, 1.35));
  const raw = new Float32Array([0.1, -0.1, 0.9]);
  const view = new DataView(await wavBlob(raw, 16000, 1.35).arrayBuffer());
  assert.ok(Math.abs(view.getInt16(44, true) / 32767 - 0.135) < 1e-4); assert.ok(view.getInt16(48, true) < 32767);
  assert.ok(Math.abs(raw[0] - 0.1) < 1e-6, 'Original VAD samples remain unchanged');
});
test('new speech threshold detects a quiet voice and ignores low background noise', () => {
  const segments = [], s = new Segmenter({sampleRate: 1000, onSegment: x => segments.push(x)});
  for (let i = 0; i < 30; i++) s.push(new Float32Array(100).fill(0.002));
  s.flush(); assert.equal(segments.length, 0);
  s.push(new Float32Array(400).fill(0.006)); s.flush(); assert.equal(segments.length, 1);
});
test('segment callbacks can safely stop and flush without duplicating audio', () => {
  let calls = 0; const s = new Segmenter({sampleRate: 1000, onSegment() {calls++; s.flush();}});
  s.push(new Float32Array(500).fill(0.04)); s.flush(); assert.equal(calls, 1);
});
test('default half-second pause emits without waiting a full second', () => {
  const segments = [], s = new Segmenter({sampleRate: 1000, onSegment: (samples, meta) => segments.push({samples, meta})});
  s.push(new Float32Array(400).fill(0.03));
  for (let i = 0; i < 4; i++) s.push(new Float32Array(100));
  assert.equal(segments.length, 0);
  s.push(new Float32Array(100));
  assert.equal(segments.length, 1); assert.equal(segments[0].meta.silenceMs, 500); assert.equal(segments[0].samples.length, 650);
});
test('long speech splits at a short natural pause or an eight-second maximum', () => {
  const segments = [], s = new Segmenter({sampleRate: 1000, onSegment: x => segments.push(x)});
  for (let i = 0; i < 40; i++) s.push(new Float32Array(100).fill(0.03));
  assert.equal(segments.length, 0);
  s.push(new Float32Array(250)); assert.equal(segments.length, 1); assert.equal(segments[0].length, 4250);
  for (let i = 0; i < 80; i++) s.push(new Float32Array(100).fill(0.03));
  assert.equal(segments.length, 2); assert.equal(segments[1].length, 8000);
});
test('audio preview boundaries do not finalize punctuation until speech settles', () => {
  let segments = 0, boundaries = 0, starts = 0;
  const s = new Segmenter({sampleRate: 1000, onSegment() {segments++;}, onBoundary() {boundaries++;}, onSpeechStart() {starts++;}});
  for (let i = 0; i < 17; i++) s.push(new Float32Array(1000).fill(0.03));
  assert.equal(segments, 2); assert.equal(boundaries, 0); assert.equal(starts, 1);
  s.push(new Float32Array(500)); assert.equal(segments, 3); assert.equal(boundaries, 0);
  s.push(new Float32Array(500)); assert.equal(boundaries, 1);
  s.push(new Float32Array(3000)); assert.equal(boundaries, 1);
  s.push(new Float32Array(400).fill(0.03)); assert.equal(starts, 2);
});
