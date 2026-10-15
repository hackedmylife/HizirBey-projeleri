import test from 'node:test';
import assert from 'node:assert/strict';
import {withTimeBudget} from '../extension/lib/timing.js';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
test('optional correction returns a completed result within its budget', async () => {
  assert.equal(await withTimeBudget(async () => 'düzeltilmiş metin', 100), 'düzeltilmiş metin');
});
test('a stalled correction times out even when transport ignores abort', async () => {
  let signal, late = false;
  const result = withTimeBudget(async current => {signal = current; await delay(80); late = true; return 'geç yanıt';}, 15);
  await assert.rejects(result, {name: 'TimeoutError'});
  assert.equal(signal.aborted, true); assert.equal(late, false);
  await delay(90); assert.equal(late, true);
  await assert.rejects(result, {name: 'TimeoutError'});
});
test('canceling the session aborts correction and an already canceled task never starts', async () => {
  const parent = new AbortController(); let signal;
  const result = withTimeBudget(async current => {signal = current; await delay(50);}, 1000, parent.signal);
  parent.abort(); await assert.rejects(result, {name: 'AbortError'}); assert.equal(signal.aborted, true);
  let started = false;
  await assert.rejects(withTimeBudget(() => {started = true;}, 1000, parent.signal), {name: 'AbortError'});
  assert.equal(started, false);
});
