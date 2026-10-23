import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('stopping flushes the real worklet partial frame exactly once before acknowledgement', () => {
  const messages = []; let Processor;
  runInNewContext(readFileSync(new URL('../extension/worklet.js', import.meta.url), 'utf8'), {
    Float32Array, AudioWorkletProcessor: class {constructor() {this.port = {postMessage(data) {messages.push(data);}};}},
    registerProcessor(_name, value) {Processor = value;}
  });
  const processor = new Processor();
  for (let i = 0; i < 17; i++) processor.process([[new Float32Array(128).fill(i + 1)]]);
  assert.equal(messages.length, 1); assert.equal(messages[0].length, 2048);
  processor.port.onmessage({data: {type: 'flush'}});
  assert.equal(messages[1].length, 128); assert.ok(messages[1].every(value => value === 17)); assert.equal(messages[2].type, 'flushed');
  processor.port.onmessage({data: {type: 'flush'}});
  assert.equal(messages.length, 4); assert.equal(messages[3].type, 'flushed');
});
