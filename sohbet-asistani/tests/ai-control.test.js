import test from 'node:test';
import assert from 'node:assert/strict';
import {AiControl, compactInput, retryDelay, headerWait, resetDuration} from '../extension/ai-control.js';

test('global pacing and cooldown prevent concurrent and early requests', () => {
  let now = 0;
  const ai = new AiControl({now: () => now});
  assert.equal(ai.acquire(), true);
  assert.equal(ai.acquire(), false);
  ai.release();
  now = 7999;
  assert.equal(ai.acquire(), false);
  now = 8000;
  assert.equal(ai.acquire(), true);
  ai.pause(60000); ai.release();
  now = 16000;
  assert.equal(ai.waitMs(), 52000);
  now = 68000;
  assert.equal(ai.acquire(), true);
});
test('cache expires and remains bounded', () => {
  let now = 0;
  const ai = new AiControl({now: () => now});
  ai.put('same', {items: []});
  assert.ok(ai.get('same'));
  now = 300000;
  assert.equal(ai.get('same'), undefined);
  for (let i = 0; i < 120; i++) ai.put(String(i), i);
  assert.equal(ai.cache.size, 100);
});
test('retry-after seconds and dates are respected, missing headers use a pause', () => {
  const response = (value) => ({headers: {get: () => value}});
  assert.equal(retryDelay(response('22')), 23000);
  assert.equal(retryDelay(response('Thu, 01 Jan 1970 00:00:10 GMT'), 0), 11000);
  assert.equal(retryDelay(response(null)), 60000);
  assert.equal(retryDelay(response('bad')), 60000);
});
test('prompt size stays bounded with long conversations and 487 long templates', () => {
  const input = compactInput(Array.from({length: 20}, () => ({role: 'user', text: 'x'.repeat(1800)})), Array.from({length: 487}, (_, i) => ({id: `t${i}`, text: 'y'.repeat(12000)})));
  assert.ok(input.candidates.length <= 12);
  assert.ok(input.conversation.reduce((n, m) => n + m.text.length, 0) <= 3360);
  assert.ok(input.candidates.reduce((n, m) => n + m.text.length, 0) <= 3800);
});
test('rolling text budget stops a burst even when request pacing permits it', () => {
  let now = 0;
  const ai = new AiControl({now: () => now});
  assert.ok(ai.acquire(4500)); ai.release();
  now = 8000;
  assert.equal(ai.acquire(4500), false);
  assert.equal(ai.waitMs(4500), 52000);
  ai.recordActual(2000);
  assert.ok(ai.acquire(4500)); ai.release();
  now = 16000;
  assert.equal(ai.acquire(4500), false);
  now = 68000;
  assert.ok(ai.acquire(4500));
});
test('remaining-token and daily-request response headers drive adaptive waiting', () => {
  assert.equal(resetDuration('2m59.56s'), 180560);
  const values = {'x-ratelimit-remaining-tokens': '500', 'x-ratelimit-reset-tokens': '7.66s'};
  const response = {headers: {get: name => values[name] ?? null}};
  assert.equal(headerWait(response, 1000), 8660);
  assert.equal(headerWait(response, 200), 0);
  values['x-ratelimit-remaining-requests'] = '0';
  values['x-ratelimit-reset-requests'] = '1h';
  assert.equal(headerWait(response, 200), 3601000);
});
