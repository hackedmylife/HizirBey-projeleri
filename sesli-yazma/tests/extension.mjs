/* Real MV3 extension, offscreen microphone and mocked Groq integration. */
import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile, cp, appendFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const profile = await mkdtemp(path.join(os.tmpdir(), 'hb-voice-qa-')), extension = path.join(profile, 'test-extension');
await cp(path.join(root, 'extension'), extension, {recursive: true});
// Isolated test copy: the shipped extension contains no mock, test hook or override.
await appendFile(path.join(extension, 'offscreen.js'), `
const qa = {hold: true, quota: false, unsafe: false, transientFailures: 1, requests: [], release: null};
globalThis.fetch = async (url, init) => {
  qa.requests.push(String(url));
  if (qa.quota) return new Response('{}', {status:429, headers:{'retry-after':'1'}});
  if (qa.unsafe && String(url).endsWith('/audio/transcriptions')) return new Response(JSON.stringify({text:'Erişim ve Altyazı M.K. Ses deneme 1-2.',segments:[{avg_logprob:-0.1,no_speech_prob:0.01,compression_ratio:1.1}]}),{status:200,headers:{'Content-Type':'application/json'}});
  if (String(url).endsWith('/audio/transcriptions') && qa.transientFailures > 0) {qa.transientFailures--;return new Response('{}',{status:503});}
  if (String(url).endsWith('/audio/transcriptions') && qa.hold) await new Promise((resolve,reject) => {qa.release=resolve;init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});
  const data = String(url).endsWith('/audio/transcriptions') ? {text:'merhaba çekiminiz henüz onaylanmadı',segments:[{avg_logprob:-0.1,no_speech_prob:0.01,compression_ratio:1.1}]} : {choices:[{message:{content:JSON.stringify({text:'Merhaba. Çekiminiz henüz onaylanmadı.'})}}]};
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
};
chrome.runtime.onMessage.addListener((m,s,r)=>{if(m?.target!=='qa'||s.id!==chrome.runtime.id)return false;if(m.type==='qa:get')r({requests:qa.requests,waiting:Boolean(qa.release)});else if(m.type==='qa:release'){qa.hold=false;qa.release?.();qa.release=null;r(true);}else if(m.type==='qa:unsafe'){qa.unsafe=true;qa.hold=false;qa.transientFailures=0;r(true);}else if(m.type==='qa:quota'){qa.quota=true;qa.hold=false;r(true);}return false;});
`);
const context = await chromium.launchPersistentContext(path.join(profile, 'profile'), {executablePath: process.env.CHROMIUM_PATH, channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-extensions-except=' + extension, '--load-extension=' + extension, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', ...(process.env.TEST_AUDIO ? ['--use-file-for-fake-audio-capture=' + process.env.TEST_AUDIO] : [])]});
let checks = 0;
let worker, page;
const errors = [];
try {
  worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).hostname;
  worker.on('console', msg => {if (msg.type() === 'error') errors.push(msg.text());});
  const options = context.pages().find(x => x.url().includes('options.html')) || await context.newPage();
  await options.goto(`chrome-extension://${id}/options.html`); await options.waitForFunction(() => document.getElementById('shortcutState').textContent.includes('Alt'));
  for (const other of context.pages()) if (other !== options && other.url().includes('options.html')) await other.close();
  await options.bringToFront();
  await options.locator('#apiKey').fill('test-credential-placeholder-000000'); await options.locator('#freeConfirmed').check(); await options.locator('#cloudConsent').check(); await options.locator('#save').click();
  await options.waitForFunction(() => document.getElementById('saveState').textContent.includes('kaydedildi'));
  await options.locator('#testMic').click(); await options.waitForFunction(() => document.getElementById('testMic').textContent.includes('Testi bitir')); await options.locator('#testMic').click(); checks++;
  const key = await worker.evaluate(async () => (await chrome.storage.local.get('hbVoice.credentials.v1'))['hbVoice.credentials.v1'].key);
  assert.equal(key, 'test-credential-placeholder-000000'); checks++;
  const browserSource = await readFile(path.join(root, 'tests/browser.mjs'), 'utf8');
  const fixture = browserSource.match(/const fixture = `([\s\S]*?)`;/)[1];
  await context.route('https://my.livechatinc.com/**', route => route.fulfill({body: fixture, contentType: 'text/html'}));
  const qa = type => worker.evaluate(type => chrome.runtime.sendMessage({target: 'qa', type}), type);
  page = await context.newPage(); await page.goto('https://my.livechatinc.com/chats/DEMOCHAT01');
  await page.bringToFront();
  assert.equal(await page.locator('#hizir-voice-host').isVisible(), false); checks++;
  // Invoke the same privileged request used by the toolbar popup without
  // activating the background options tab (which intentionally cancels capture).
  const toggle = async () => {const reply = await options.evaluate(() => chrome.runtime.sendMessage({type: 'ui:toggle'})); assert.equal(reply.ok, true, reply.error);};
  const listening = () => page.waitForFunction(() => {const host = document.getElementById('hizir-voice-host'); return !host.hidden && host.shadowRoot.getElementById('indicator').dataset.phase === 'listening';}, undefined, {timeout: 15000});
  await toggle(); await listening(); checks++;
  const dotRect = await page.locator('#hizir-voice-host').boundingBox(), viewport = page.viewportSize();
  assert.equal(dotRect.width, 20); assert.equal(dotRect.height, 20);
  assert.ok(Math.abs(dotRect.x + dotRect.width / 2 - viewport.width / 2) < 1);
  assert.ok(Math.abs(dotRect.y + dotRect.height / 2 - viewport.height / 2) < 1); checks++;
  const sessionStore = () => options.evaluate(async () => {const reply = await chrome.runtime.sendMessage({type: 'ui:get'}); const status = reply.data.status; return {status, session: status.sessionId ? {id: status.sessionId} : null};});
  assert.equal((await sessionStore()).status.recording, true);
  let pending;
  const until = Date.now() + 20000; while (Date.now() < until) {pending = await qa('qa:get').catch(() => null); if (pending?.waiting) break; await page.waitForTimeout(200);}
  assert.ok(pending?.waiting, 'Microphone must produce a queued WAV request through the offscreen page'); checks++;
  assert.equal(pending.requests.filter(x => x.endsWith('/audio/transcriptions')).length, 2, 'A temporary 503 is retried once');
  assert.equal((await sessionStore()).status.phase, 'waiting'); checks++;
  // Exceed the previous 25-second timeout in a real offscreen document.
  await page.waitForTimeout(26000);
  assert.equal((await qa('qa:get')).requests.filter(x => x.endsWith('/audio/transcriptions')).length, 2);
  assert.equal((await sessionStore()).status.busy, true); checks++;
  assert.equal(await page.locator('#hizir-voice-host').locator('#indicator').isVisible(), true); checks++;
  await page.locator('#editor').focus(); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => globalThis.sentCount), 0); checks++;
  await qa('qa:release');
  await page.waitForFunction(() => document.getElementById('editor').innerText.includes('henüz onaylanmadı'), {timeout: 15000});
  assert.equal(((await page.locator('#editor').innerText()).match(/henüz onaylanmadı/g) || []).length, 1, 'The retried segment is inserted only once');
  const usage = await worker.evaluate(async () => (await chrome.storage.local.get('hbVoice.usage.v1'))['hbVoice.usage.v1']);
  assert.equal(usage.speech, 2); assert.equal(usage.text, 1); checks++;
  assert.equal(await page.evaluate(() => globalThis.sentCount), 0); checks++;
  const readyUntil = Date.now() + 5000; while ((await sessionStore()).status.busy && Date.now() < readyUntil) await page.waitForTimeout(100);
  const latency = (await sessionStore()).status.lastLatencyMs;
  assert.ok(Number.isFinite(latency) && latency >= 26000, 'Transfer timing includes deliberate network delay'); checks++;
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => globalThis.sentCount), 1); assert.equal((await sessionStore()).session, null); checks++;
  assert.equal(await page.evaluate(() => globalThis.sendClicks), 1); assert.equal(await page.evaluate(() => globalThis.nativeEnterCount), 0); checks++;
  assert.equal(await page.locator('#hizir-voice-host').isVisible(), false); checks++;
  const closedUntil = Date.now() + 2000;
  while (Date.now() < closedUntil && (await worker.evaluate(() => chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']}))).length) await page.waitForTimeout(100);
  assert.equal((await worker.evaluate(() => chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']}))).length, 0, 'Enter closes the offscreen microphone context'); checks++;
  // Stop capture first; Enter still sends the reviewed draft when the host
  // application is configured to insert a newline on Enter.
  await page.locator('#editor').fill(''); await page.evaluate(() => {globalThis.nativeEnterSends = false;});
  await toggle(); await listening(); await qa('qa:release');
  await page.waitForFunction(() => document.getElementById('editor').innerText.includes('henüz onaylanmadı'), undefined, {timeout: 15000});
  await toggle();
  const stoppedUntil = Date.now() + 5000;
  while ((await sessionStore()).session && Date.now() < stoppedUntil) await page.waitForTimeout(100);
  assert.equal((await sessionStore()).session, null); assert.equal(await page.locator('#hizir-voice-host').isVisible(), false); checks++;
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => globalThis.sentCount), 2); assert.equal(await page.evaluate(() => globalThis.sendClicks), 2); checks++;
  await page.evaluate(() => {globalThis.nativeEnterSends = true;});
  // Repeated recordings exercise close/reopen and mic cleanup.
  await page.locator('#editor').fill(''); await page.waitForTimeout(500);
  await toggle(); await listening();
  await page.locator('main').evaluate(x => {x.dataset.chatId = 'DIFFERENTCHAT02';});
  await page.waitForTimeout(700); assert.equal((await sessionStore()).session, null); checks++;
  const before = await page.locator('#editor').innerText(); await page.waitForTimeout(1500); assert.equal(await page.locator('#editor').innerText(), before); checks++;
  // A known subtitle hallucination must never reach the customer's composer.
  await page.locator('#editor').fill('Korunacak mevcut metin.');
  await toggle(); await listening(); await qa('qa:unsafe');
  const unsafeUntil = Date.now() + 20000;
  while (Date.now() < unsafeUntil) {if ((await sessionStore()).status.phase === 'error') break; await page.waitForTimeout(200);}
  const rejected = await sessionStore(); assert.equal(rejected.status.phase, 'error'); assert.match(rejected.status.message, /Şüpheli dikte yazılmadı/); assert.equal(rejected.session, null); checks++;
  assert.equal((await page.locator('#editor').innerText()).trim(), 'Korunacak mevcut metin.'); assert.equal(await page.locator('#hizir-voice-host').isVisible(), false); assert.equal(await page.evaluate(() => globalThis.sentCount), 2); checks++;
  // Fail closed at provider quota, without another provider or upgrade request.
  await toggle(); await listening();
  await qa('qa:quota');
  const failureUntil = Date.now() + 20000;
  while (Date.now() < failureUntil) {const state = await sessionStore(); if (state.status.phase === 'error') break; await page.waitForTimeout(200);}
  const failed = await sessionStore(); assert.equal(failed.status.phase, 'error'); assert.match(failed.status.message, /kota/); assert.equal(failed.session, null); checks++;
  assert.deepEqual(errors, []); checks++;
  console.log(`Real extension + microphone + mocked API checks passed: ${checks}. No real account, key or customer messages used.`);
} catch (error) {
  const state = await worker?.evaluate(async () => (await chrome.storage.session.get('hbVoice.runtime.v1'))['hbVoice.runtime.v1']).catch(() => null);
  console.error('MV3 QA diagnostics:', JSON.stringify({checks, state, errors}));
  if (page) console.error('Indicator:', await page.locator('#hizir-voice-host').evaluate(x => ({hidden: x.hidden, phase: x.shadowRoot.getElementById('indicator').dataset.phase})).catch(() => 'unavailable'));
  console.error('Setup:', await worker?.evaluate(async () => (await chrome.storage.local.get('hbVoice.settings.v1'))['hbVoice.settings.v1']).catch(() => 'unavailable'));
  throw error;
} finally {await context.close(); await rm(profile, {recursive: true, force: true});}
