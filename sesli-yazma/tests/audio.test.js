import test from 'node:test';
import assert from 'node:assert/strict';
import {Segmenter, wavBlob} from '../extension/lib/audio.js';
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
