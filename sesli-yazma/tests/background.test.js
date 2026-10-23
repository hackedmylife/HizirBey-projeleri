import test from 'node:test';
import assert from 'node:assert/strict';
import {STORE} from '../extension/lib/core.js';
const id = 'qa-extension', origin = `chrome-extension://${id}/`;
const local = {}, session = {}, messages = [], access = [];
let listener, hasOffscreen = false, activeTab = 42;
const event = () => ({addListener() {}});
const storage = data => ({async get(key) {return {[key]: data[key]};}, async set(value) {Object.assign(data, structuredClone(value));}, async remove(key) {delete data[key];}, async setAccessLevel(value) {access.push(value.accessLevel);}});
globalThis.chrome = {
  runtime: {id, getURL: path => origin + path, async getContexts() {return hasOffscreen ? [{documentUrl: origin + 'offscreen.html'}] : [];}, async sendMessage(message) {messages.push(structuredClone(message)); return {ok: true, data: true};}, async openOptionsPage() {messages.push({openedOptions: true});}, onMessage: {addListener(fn) {listener = fn;}}, onInstalled: event()},
  storage: {local: storage(local), session: storage(session)},
  tabs: {async query() {return [{id: activeTab}];}, async get(tabId) {return {id: tabId, url: 'https://my.livechatinc.com/chats/qa'};}, async sendMessage(tabId, message) {messages.push({toTab: tabId, ...structuredClone(message)}); return {ok: true};}, async create() {}, onActivated: event(), onRemoved: event(), onUpdated: event()},
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
  await send('ui:save', {key, settings: {provider: 'groq', freeConfirmed: true, cloudConsent: true, microphoneReady: true}});
  assert.equal(local[STORE.settings].microphoneReady, false, 'UI cannot fake readiness through the settings object');
  assert.equal((await send('ui:get', {}, content)).ok, false);
  const result = await send('ui:get'); assert.equal(result.data.hasKey, true); assert.equal(JSON.stringify(result).includes(key), false);
});
test('incomplete setup prevents capture and opens setup instead', async () => {
  const result = await send('content:toggle', {}, content);
  assert.equal(result.ok, false); assert.match(result.error, /mikrofon/); assert.ok(messages.some(x => x.openedOptions));
  assert.equal(messages.some(x => x.type === 'capture:start'), false);
});
test('settings navigation fragments retain privileged UI access', async () => {
  const result = await send('ui:get', {}, {id, url: origin + 'options.html#microphone'});
  assert.equal(result.ok, true); assert.equal(result.data.hasKey, true);
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
  assert.equal((await send('audio:result', {sessionId: state.sessionId, segmentId: 1, text: 'Merhaba.', raw: 'merhaba', spokenAt: Date.now() - 1250}, audio)).data, true);
  const latency = (await send('ui:get')).data.status.lastLatencyMs;
  assert.ok(latency >= 1250 && latency < 2250);
  assert.equal(messages.filter(x => x.type === 'voice:insert').length, 1);
  assert.equal((await send('audio:result', {sessionId: state.sessionId, segmentId: 1, text: 'Merhaba.', raw: 'merhaba'}, audio)).data, true);
  assert.equal(messages.filter(x => x.type === 'voice:insert').length, 1, 'Duplicate delivery must not insert twice');
  await send('audio:meter', {sessionId: state.sessionId, recording: true, processing: false, buffered: false}, audio);
  assert.equal((await send('ui:undo', {}, content)).ok, false, 'Page scripts cannot use privileged popup actions');
  assert.equal((await send('ui:undo')).data, true);
  assert.equal(messages.filter(x => x.type === 'voice:undo').length, 1);
  assert.equal((await send('ui:undo')).ok, false, 'The same segment cannot be undone twice');
  await send('content:cancel', {sessionId: state.sessionId, reason: 'Görüşme değişti.'}, content);
  assert.equal((await send('audio:result', {sessionId: state.sessionId, text: 'Geç yanıt.', raw: 'geç yanıt'}, audio)).data, false);
  assert.equal(messages.filter(x => x.type === 'voice:insert').length, 1);
});
test('audio setting upgrades preserve saved credentials and personal dictionary', async () => {
  const key = local[STORE.credentials].key, memory = structuredClone(local[STORE.memory]);
  local[STORE.settings] = {...local[STORE.settings], sensitivity: 0.008}; delete local[STORE.settings].audioRevision;
  local[STORE.settings].pauseMs = 1000; delete local[STORE.settings].latencyRevision;
  const settings = (await send('ui:get')).data.settings;
  assert.equal(settings.sensitivity, 0.005); assert.equal(settings.micGain, 1.35);
  assert.equal(settings.pauseMs, 500); assert.equal(settings.fastMode, true);
  await send('ui:save', {settings});
  assert.equal(local[STORE.credentials].key, key); assert.deepEqual(local[STORE.memory], memory);
});
test('the final editor boundary rejects unsafe output even if an earlier layer is bypassed', async () => {
  await send('content:toggle', {}, content);
  const state = (await send('ui:get')).data.status, count = messages.filter(x => x.type === 'voice:insert').length;
  const reply = await send('audio:result', {sessionId: state.sessionId, segmentId: 1, raw: 'merhaba', text: 'Merhaba. M.K.'}, audio);
  assert.equal(reply.data, false); assert.equal(messages.filter(x => x.type === 'voice:insert').length, count);
  const next = (await send('ui:get')).data.status;
  assert.equal(next.phase, 'error'); assert.equal(next.sessionId, null); assert.equal(next.lastText.includes('M.K.'), false);
});
test('backup import cannot replace credentials or enable a paid provider', async () => {
  const key = local[STORE.credentials].key;
  const data = JSON.stringify({schema: 1, terms: ['Hızır Bey'], pairs: [], credentials: {key: 'other'}, provider: 'paid'});
  assert.equal((await send('ui:import', {data})).ok, true);
  assert.equal(local[STORE.credentials].key, key); assert.equal(local[STORE.memory].credentials, undefined);
  const exported = await send('ui:export'); assert.equal(exported.data.includes(key), false); assert.equal(exported.data.includes('paid'), false);
});
test('minute quota reports a resumable wait without consuming an extra request', async () => {
  const previous = structuredClone(local[STORE.usage]);
  delete local[STORE.usage]; await send('content:toggle', {}, content);
  const sessionId = (await send('ui:get')).data.status.sessionId;
  for (let i = 0; i < 18; i++) assert.equal((await send('audio:reserve', {sessionId, kind: 'speech', seconds: 1}, audio)).data, true);
  const reply = await send('audio:reserve', {sessionId, kind: 'speech', seconds: 1}, audio);
  assert.equal(reply.ok, true); assert.ok(reply.data.waitMs > 58000 && reply.data.waitMs <= 60050);
  assert.equal(local[STORE.usage].speech, 18); assert.equal(local[STORE.usage].audio, 18);
  await send('content:cancel', {sessionId}, content);
  if (previous) local[STORE.usage] = previous; else delete local[STORE.usage];
});
test('Space finish is bound to the current tab and session, idempotent, and drains late results before review', async () => {
  await send('content:toggle', {}, content);
  const sessionId = (await send('ui:get')).data.status.sessionId;
  await send('audio:meter', {sessionId, recording: true, processing: false}, audio);
  assert.equal((await send('content:finish', {sessionId: 'stale'}, content)).data, false);
  assert.equal((await send('content:finish', {sessionId}, {...content, tab: {id: 99}})).data, false);
  assert.equal((await send('content:finish', {sessionId}, {...content, frameId: 1})).ok, false);
  const before = messages.filter(x => x.type === 'capture:finish').length;
  await Promise.all([send('content:finish', {sessionId}, content), send('content:finish', {sessionId}, content)]);
  assert.equal(messages.filter(x => x.type === 'capture:finish').length, before + 1);
  await send('audio:meter', {sessionId, recording: true, processing: false}, audio);
  const finishing = (await send('ui:get')).data.status;
  assert.equal(finishing.phase, 'finishing'); assert.equal(finishing.recording, false); assert.equal(finishing.busy, true);
  await send('content:finish', {sessionId}, content);
  assert.equal(messages.filter(x => x.type === 'capture:finish').length, before + 1);
  assert.equal((await send('audio:result', {sessionId, segmentId: 1, text: 'Son kelimeler.', raw: 'son kelimeler'}, audio)).data, true);
  await send('audio:done', {sessionId}, audio);
  const state = (await send('ui:get')).data.status;
  assert.equal(state.sessionId, null); assert.equal(state.lastText, 'Son kelimeler.'); assert.equal(state.canRewrite, true);
  assert.equal((await send('content:finish', {sessionId}, content)).data, false);
});
test('normal capture completion preserves only the reviewed draft shortcut', async () => {
  await send('content:toggle', {}, content);
  const sessionId = (await send('ui:get')).data.status.sessionId;
  await send('audio:done', {sessionId}, audio);
  const release = messages.filter(x => x.type === 'voice:release' && x.sessionId === sessionId).at(-1);
  assert.equal(release.keepDraft, true); assert.equal((await send('ui:get')).data.status.sessionId, null);
  assert.ok(messages.some(x => x.type === 'capture:cancel' && x.sessionId === sessionId));
});
test('without explicit Free and cloud consent no new capture starts', async () => {
  await send('ui:save', {settings: {freeConfirmed: false, cloudConsent: false}});
  assert.equal((await send('content:toggle', {}, content)).ok, false);
  assert.equal((await send('ui:get')).data.status.sessionId, null);
});
test('explicit rewrite stops capture and uses the saved text, without another speech request or late insertion', async () => {
  await send('ui:save', {settings: {freeConfirmed: true, cloudConsent: true}});
  assert.equal((await send('ui:rewrite')).ok, false);
  await send('content:toggle', {}, content);
  const sessionId = (await send('ui:get')).data.status.sessionId;
  await send('audio:result', {sessionId, segmentId: 1, text: 'Son dikte.', raw: 'son dikte'}, audio);
  await send('audio:meter', {sessionId, recording: true, processing: true}, audio);
  assert.equal((await send('ui:get')).data.status.canRewrite, false); assert.equal((await send('ui:rewrite')).ok, false);
  await send('audio:meter', {sessionId, recording: true, processing: false}, audio);
  assert.equal((await send('ui:get')).data.status.canRewrite, true);
  assert.equal((await send('ui:rewrite', {}, content)).ok, false);
  activeTab = 99; assert.equal((await send('ui:rewrite')).ok, false); activeTab = 42;
  const count = messages.filter(x => x.type === 'capture:start').length;
  assert.equal((await send('ui:rewrite')).ok, true);
  const state = (await send('ui:get')).data.status;
  assert.equal(state.sessionId, null); assert.equal(state.recording, false); assert.equal(state.canRewrite, true);
  const rewrite = messages.filter(x => x.type === 'voice:rewrite').at(-1);
  assert.equal(rewrite.text, 'Son dikte.'); assert.equal(rewrite.sessionId, sessionId); assert.equal(rewrite.toTab, 42);
  assert.equal(messages.filter(x => x.type === 'capture:start').length, count);
  assert.equal((await send('audio:result', {sessionId, segmentId: 2, text: 'Geç gelen.', raw: 'geç gelen'}, audio)).data, false);
  await send('content:sent', {sessionId}, content);
  assert.equal((await send('ui:get')).data.status.canRewrite, false); assert.equal((await send('ui:rewrite')).ok, false);
});
test('normal completion and service-worker restart retain recovery; a conversation change invalidates it', async () => {
  await send('content:toggle', {}, content);
  const sessionId = (await send('ui:get')).data.status.sessionId;
  await send('audio:result', {sessionId, segmentId: 1, text: 'Kurtarılacak dikte.', raw: 'kurtarılacak dikte'}, audio);
  await send('audio:done', {sessionId}, audio);
  assert.equal((await send('ui:get')).data.status.canRewrite, true);
  hasOffscreen = false;
  await import('../extension/background.js?worker-restart');
  assert.equal((await send('ui:get')).data.status.canRewrite, true);
  assert.equal((await send('ui:rewrite')).ok, true);
  assert.ok(messages.some(x => x.type === 'voice:release' && x.sessionId === sessionId && x.keepRewrite));
  await send('content:cancel', {sessionId, reason: 'Görüşme değişti.'}, content);
  assert.equal((await send('ui:get')).data.status.canRewrite, false);
  assert.equal((await send('ui:get')).data.status.lastText, 'Kurtarılacak dikte.', 'The copyable recovery text survives without an editor target');
});
test('Google requires separate consent, preserves the Groq key, and sends no unauthorized text-service credentials', async () => {
  const key = local[STORE.credentials].key;
  await send('ui:save', {settings: {provider: 'browser', browserConsent: false}});
  assert.equal((await send('content:toggle', {}, content)).ok, false);
  await send('ui:save', {settings: {provider: 'browser', browserConsent: true, cloudConsent: false}});
  assert.equal((await send('content:toggle', {}, content)).ok, true);
  const start = messages.filter(x => x.type === 'capture:start').at(-1);
  assert.equal(start.config.provider, 'browser'); assert.equal(start.config.key, ''); assert.equal(start.config.correction, false); assert.equal(start.config.punctuationUnavailable, true);
  assert.equal(local[STORE.credentials].key, key);
  const sessionId = (await send('ui:get')).data.status.sessionId;
  await send('content:cancel', {sessionId}, content);
});
