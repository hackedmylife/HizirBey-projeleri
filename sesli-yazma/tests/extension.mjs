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
const qa = {hold: true, quota: false, requests: [], release: null};
globalThis.fetch = async (url, init) => {
  qa.requests.push(String(url));
  if (qa.quota) return new Response('{}', {status:429, headers:{'retry-after':'1'}});
  if (String(url).endsWith('/audio/transcriptions') && qa.hold) await new Promise((resolve,reject) => {qa.release=resolve;init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});
  const data = String(url).endsWith('/audio/transcriptions') ? {text:'merhaba çekiminiz henüz onaylanmadı',segments:[{no_speech_prob:0.01}]} : {choices:[{message:{content:JSON.stringify({text:'Merhaba. Çekiminiz henüz onaylanmadı.'})}}]};
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
};
chrome.runtime.onMessage.addListener((m,s,r)=>{if(m?.target!=='qa'||s.id!==chrome.runtime.id)return false;if(m.type==='qa:get')r({requests:qa.requests,waiting:Boolean(qa.release)});else if(m.type==='qa:release'){qa.hold=false;qa.release?.();qa.release=null;r(true);}else if(m.type==='qa:quota'){qa.quota=true;qa.hold=false;r(true);}return false;});
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
  await page.locator('#hizir-voice-host').getByRole('button', {name: 'Başlat', exact: true}).click();
  await page.waitForFunction(() => {const root = document.querySelector('#hizir-voice-host').shadowRoot; if(root.getElementById('bar').dataset.error === 'true') throw new Error(root.getElementById('message').textContent); return root.getElementById('bar').dataset.live === 'true';}, undefined, {timeout: 15000}); checks++;
  const sessionStore = () => options.evaluate(async () => {const reply = await chrome.runtime.sendMessage({type: 'ui:get'}); const status = reply.data.status; return {status, session: status.sessionId ? {id: status.sessionId} : null};});
  assert.equal((await sessionStore()).status.recording, true);
  let pending;
  const until = Date.now() + 20000; while (Date.now() < until) {pending = await qa('qa:get').catch(() => null); if (pending?.waiting) break; await page.waitForTimeout(200);}
  assert.ok(pending?.waiting, 'Microphone must produce a queued WAV request through the offscreen page'); checks++;
  await page.locator('#editor').focus(); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => globalThis.sentCount), 0); checks++;
  await qa('qa:release');
  await page.waitForFunction(() => document.getElementById('editor').innerText.includes('henüz onaylanmadı'), {timeout: 15000});
  assert.equal(await page.evaluate(() => globalThis.sentCount), 0); checks++;
  const readyUntil = Date.now() + 5000; while ((await sessionStore()).status.busy && Date.now() < readyUntil) await page.waitForTimeout(100);
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => globalThis.sentCount), 1); assert.equal((await sessionStore()).session, null); checks++;
  // Repeated recordings exercise close/reopen and mic cleanup.
  await page.locator('#editor').fill(''); await page.waitForTimeout(500);
  await page.locator('#hizir-voice-host').getByRole('button', {name: 'Başlat', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('#hizir-voice-host').shadowRoot.getElementById('bar').dataset.live === 'true', {timeout: 10000});
  await page.locator('main').evaluate(x => {x.dataset.chatId = 'DIFFERENTCHAT02';});
  await page.waitForTimeout(700); assert.equal((await sessionStore()).session, null); checks++;
  const before = await page.locator('#editor').innerText(); await page.waitForTimeout(1500); assert.equal(await page.locator('#editor').innerText(), before); checks++;
  // Fail closed at provider quota, without another provider or upgrade request.
  await page.locator('#hizir-voice-host').getByRole('button', {name: 'Başlat', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('#hizir-voice-host').shadowRoot.getElementById('bar').dataset.live === 'true');
  await qa('qa:quota');
  const failureUntil = Date.now() + 20000;
  while (Date.now() < failureUntil) {const state = await sessionStore(); if (state.status.phase === 'error') break; await page.waitForTimeout(200);}
  const failed = await sessionStore(); assert.equal(failed.status.phase, 'error'); assert.match(failed.status.message, /kota/); assert.equal(failed.session, null); checks++;
  assert.deepEqual(errors, []); checks++;
  console.log(`Real extension + microphone + mocked API checks passed: ${checks}. No real account, key or customer messages used.`);
} catch (error) {
  const state = await worker?.evaluate(async () => (await chrome.storage.session.get('hbVoice.runtime.v1'))['hbVoice.runtime.v1']).catch(() => null);
  console.error('MV3 QA diagnostics:', JSON.stringify({checks, state, errors}));
  if (page) console.error('Toolbar:', await page.locator('#hizir-voice-host').evaluate(x => x.shadowRoot.getElementById('message').textContent).catch(() => 'unavailable'));
  console.error('Setup:', await worker?.evaluate(async () => (await chrome.storage.local.get('hbVoice.settings.v1'))['hbVoice.settings.v1']).catch(() => 'unavailable'));
  throw error;
} finally {await context.close(); await rm(profile, {recursive: true, force: true});}
