import test from 'node:test';
import assert from 'node:assert/strict';
import {STORE} from '../extension/lib/core.js';
const id = 'qa-extension', origin = `chrome-extension://${id}/`;
const local = {}, session = {}, messages = [], access = [];
let listener, hasOffscreen = false;
const event = () => ({addListener() {}});
const storage = data => ({async get(key) {return {[key]: data[key]};}, async set(value) {Object.assign(data, structuredClone(value));}, async remove(key) {delete data[key];}, async setAccessLevel(value) {access.push(value.accessLevel);}});
globalThis.chrome = {
  runtime: {id, getURL: path => origin + path, async getContexts() {return hasOffscreen ? [{documentUrl: origin + 'offscreen.html'}] : [];}, async sendMessage(message) {messages.push(structuredClone(message)); return {ok: true, data: true};}, async openOptionsPage() {messages.push({openedOptions: true});}, onMessage: {addListener(fn) {listener = fn;}}, onInstalled: event()},
  storage: {local: storage(local), session: storage(session)},
  tabs: {async query() {return [{id: 42}];}, async get(tabId) {return {id: tabId, url: 'https://my.livechatinc.com/chats/qa'};}, async sendMessage(tabId, message) {messages.push({toTab: tabId, ...structuredClone(message)}); return {ok: true};}, async create() {}, onActivated: event(), onRemoved: event(), onUpdated: event()},
  action: {async setBadgeText() {}, async setBadgeBackgroundColor() {}},
  offscreen: {async createDocument() {hasOffscreen = true;}, async closeDocument() {hasOffscreen = false;}},
  commands: {async getAll() {return [{name: 'toggle-dictation', shortcut: 'Alt+H'}];}, onCommand: event()}
};
await import('../extension/background.js');
const ui = {id, url: origin + 'options.html'}, content = {id, url: 'https://my.livechatinc.com/chats/qa', frameId: 0, tab: {id: 42}}, audio = {id, url: origin + 'offscreen.html'};
const send = (type, body = {}, sender = ui) => new Promise(resolve => {listener({type, ...body}, sender, resolve);});
test('trusted-context storage and UI never disclose the saved key to a content script', async () => {
  await send('ui:get'); assert.deepEqual(access, ['TRUSTED_CONTEXTS', 'TRUSTED_CONTEXTS']);
  const key = 'unit-test-credential-placeholder';
  await send('ui:save', {key, settings: {freeConfirmed: true, cloudConsent: true, microphoneReady: true}});
  assert.equal(local[STORE.settings].microphoneReady, false, 'UI cannot fake readiness through the settings object');
  assert.equal((await send('ui:get', {}, content)).ok, false);
  const result = await send('ui:get'); assert.equal(result.data.hasKey, true); assert.equal(JSON.stringify(result).includes(key), false);
});
test('incomplete setup prevents capture and opens setup instead', async () => {
  const result = await send('content:toggle', {}, content);
  assert.equal(result.ok, false); assert.match(result.error, /mikrofon/); assert.ok(messages.some(x => x.openedOptions));
  assert.equal(messages.some(x => x.type === 'capture:start'), false);
});
test('actual capture configuration stays inside privileged extension contexts', async () => {
  await send('ui:microphone'); await send('content:toggle', {}, content);
  const state = (await send('ui:get')).data.status;
  assert.ok(state.sessionId);
  const start = messages.find(x => x.type === 'capture:start'); assert.equal(start.config.key, local[STORE.credentials].key);
  for (const message of messages.filter(x => x.toTab)) assert.equal(JSON.stringify(message).includes(local[STORE.credentials].key), false);
});
test('only current-session offscreen results can reach the editor', async () => {
  const state = (await send('ui:get')).data.status;
  assert.equal((await send('audio:result', {sessionId: state.sessionId, text: 'bad', raw: 'bad'}, content)).ok, true);
  assert.equal(messages.filter(x => x.type === 'voice:insert').length, 0);
  assert.equal((await send('audio:result', {sessionId: state.sessionId, text: 'Merhaba.', raw: 'merhaba'}, audio)).data, true);
  assert.equal(messages.filter(x => x.type === 'voice:insert').length, 1);
  await send('content:cancel', {sessionId: state.sessionId, reason: 'Görüşme değişti.'}, content);
  assert.equal((await send('audio:result', {sessionId: state.sessionId, text: 'Geç yanıt.', raw: 'geç yanıt'}, audio)).data, false);
  assert.equal(messages.filter(x => x.type === 'voice:insert').length, 1);
});
test('backup import cannot replace credentials or enable a paid provider', async () => {
  const key = local[STORE.credentials].key;
  const data = JSON.stringify({schema: 1, terms: ['Hızır Bey'], pairs: [], credentials: {key: 'other'}, provider: 'paid'});
  assert.equal((await send('ui:import', {data})).ok, true);
  assert.equal(local[STORE.credentials].key, key); assert.equal(local[STORE.memory].credentials, undefined);
  const exported = await send('ui:export'); assert.equal(exported.data.includes(key), false); assert.equal(exported.data.includes('paid'), false);
});
test('without explicit Free and cloud consent no new capture starts', async () => {
  await send('ui:save', {settings: {freeConfirmed: false, cloudConsent: false}});
  assert.equal((await send('content:toggle', {}, content)).ok, false);
  assert.equal((await send('ui:get')).data.status.sessionId, null);
});
