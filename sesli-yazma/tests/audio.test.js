import test from 'node:test';
import assert from 'node:assert/strict';
import {Segmenter, wavBlob, boostSample} from '../extension/lib/audio.js';
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
  assert.equal(segments.length, 1); assert.ok(segments[0].length >= 1200); assert.equal(s.length, 0);
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
