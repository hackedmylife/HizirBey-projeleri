/* Real MV3 extension, offscreen microphone and mocked Groq integration. */
import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile, cp, appendFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {speechFixture, musicSignal} from './fixtures.mjs';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const profile = await mkdtemp(path.join(os.tmpdir(), 'hb-voice-qa-')), extension = path.join(profile, 'test-extension');
await cp(path.join(root, 'extension'), extension, {recursive: true});
// Isolated test copy: the shipped extension contains no mock, test hook or override.
await appendFile(path.join(extension, 'offscreen.js'), `
const qa = {hold: true, quota: false, unsafe: false, transientFailures: 1, requests: [], release: null, fragments: [], long: false};
const qaNativeFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith('https://api.groq.com/openai/v1/')) return qaNativeFetch(url, init);
  qa.requests.push(String(url));
  if (qa.quota) return new Response('{}', {status:429, headers:{'retry-after':'1'}});
  if (qa.unsafe && String(url).endsWith('/audio/transcriptions')) return new Response(JSON.stringify({text:'Erişim ve Altyazı M.K. Ses deneme 1-2.',segments:[{avg_logprob:-0.1,no_speech_prob:0.01,compression_ratio:1.1}]}),{status:200,headers:{'Content-Type':'application/json'}});
  if (String(url).endsWith('/audio/transcriptions') && qa.transientFailures > 0) {qa.transientFailures--;return new Response('{}',{status:503});}
  if (String(url).endsWith('/audio/transcriptions') && qa.hold) await new Promise((resolve,reject) => {qa.release=resolve;init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});
  const data = String(url).endsWith('/audio/transcriptions') ? {text:qa.fragments.shift()||'merhaba çekiminiz henüz onaylanmadı',segments:[{avg_logprob:-0.1,no_speech_prob:0.01,compression_ratio:1.1}]} : {choices:[{message:{content:JSON.stringify({text:qa.long?JSON.parse(JSON.parse(init.body).messages[1].content).text+'.':'Merhaba. Çekiminiz henüz onaylanmadı.'})}}]};
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
};
chrome.runtime.onMessage.addListener((m,s,r)=>{if(m?.target!=='qa'||s.id!==chrome.runtime.id)return false;if(m.type==='qa:get')r({requests:qa.requests,waiting:Boolean(qa.release)});else if(m.type==='qa:release'){qa.hold=false;qa.release?.();qa.release=null;r(true);}else if(m.type==='qa:unsafe'){qa.unsafe=true;qa.hold=false;qa.transientFailures=0;r(true);}else if(m.type==='qa:long'){qa.requests=[];qa.long=true;qa.hold=false;qa.transientFailures=0;qa.fragments=['çekim talebiniz ile ilgili','kontrollerimiz sürüyor henüz','onaylanmadı bu nedenle','bir süre daha beklemenizi','rica ediyoruz bilgi vereceğiz'];active.worklet.port.onmessage=null;for(let i=0;i<282;i++)active.segmenter.push(new Float32Array(Math.round(active.sampleRate*.128)).fill(.04));for(let i=0;i<9;i++)active.segmenter.push(new Float32Array(Math.round(active.sampleRate*.128)));r(true);}else if(m.type==='qa:window'){qa.requests=[];qa.long=true;qa.hold=false;qa.transientFailures=0;active.worklet.port.onmessage=null;r(true);}else if(m.type==='qa:preview'||m.type==='qa:reject'){active.worklet.port.onmessage=null;if(m.type==='qa:preview')qa.fragments=[m.text];for(let i=0;i<4;i++)active.segmenter.push(new Float32Array(Math.round(active.sampleRate*.128)).fill(.04));for(let i=0;i<(m.type==='qa:reject'?9:4);i++)active.segmenter.push(new Float32Array(Math.round(active.sampleRate*.128)));r(true);}else if(m.type==='qa:settle'){for(let i=0;i<4;i++)active.segmenter.push(new Float32Array(Math.round(active.sampleRate*.128)));r(true);}else if(m.type==='qa:quota'){qa.quota=true;qa.hold=false;r(true);} return false;});
chrome.runtime.onMessage.addListener((m,s,r)=>{
  if(m?.target!=='qa'||s.id!==chrome.runtime.id)return false;
  if(m.type==='qa:guard') {qa.requests=[];qa.long=true;qa.hold=false;qa.unsafe=false;qa.transientFailures=0;active.worklet.port.onmessage=null;r({filter:!!active.filter,rate:active.sampleRate});}
  else if(m.type==='qa:pcm') {const data=Float32Array.from(m.samples);for(let i=0;i<data.length;i+=2048)active.accept(data.subarray(i,i+2048));for(let i=0;i<12;i++)active.accept(new Float32Array(2048));r(true);}
  return false;
});
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
  assert.equal(await options.locator('#backgroundGuard').isChecked(), true); checks++;
  await options.locator('#measureNoise').click();
  assert.equal(await options.locator('#deviceId').isDisabled(), true); checks++;
  await options.waitForFunction(() => document.getElementById('noiseState').textContent.includes('ölçümü kayıtlı'));
  const measured = await worker.evaluate(async () => (await chrome.storage.local.get('hbVoice.settings.v1'))['hbVoice.settings.v1']);
  assert.equal(measured.backgroundGuard, true); assert.ok(Number.isFinite(measured.noiseLevel)); assert.ok(measured.noiseDeviceId.length > 0); checks++;
  await options.locator('#clearNoise').click(); await options.waitForFunction(() => document.getElementById('clearNoise').disabled); checks++;
  const key = await worker.evaluate(async () => (await chrome.storage.local.get('hbVoice.credentials.v1'))['hbVoice.credentials.v1'].key);
  assert.equal(key, 'test-credential-placeholder-000000'); checks++;
  const browserSource = await readFile(path.join(root, 'tests/browser.mjs'), 'utf8');
  const fixture = browserSource.match(/const fixture = `([\s\S]*?)`;/)[1];
  await context.route('https://my.livechatinc.com/**', route => route.fulfill({body: fixture, contentType: 'text/html'}));
  const qa = (type, data = {}) => worker.evaluate(message => chrome.runtime.sendMessage({target: 'qa', ...message}), {type, ...data});
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
  await page.waitForFunction(() => document.getElementById('editor').innerText.includes('Merhaba. Çekiminiz henüz onaylanmadı.'), undefined, {timeout: 15000});
  assert.equal(((await page.locator('#editor').innerText()).match(/henüz onaylanmadı/g) || []).length, 1, 'The retried segment is inserted only once');
  const usage = await worker.evaluate(async () => (await chrome.storage.local.get('hbVoice.usage.v1'))['hbVoice.usage.v1']);
  assert.equal(usage.speech, 2); assert.equal(usage.text, 1); checks++;
  assert.equal(await page.evaluate(() => globalThis.sentCount), 0); checks++;
  const readyUntil = Date.now() + 5000; while ((await sessionStore()).status.busy && Date.now() < readyUntil) await page.waitForTimeout(100);
  const latency = (await sessionStore()).status.lastLatencyMs;
  assert.ok(Number.isFinite(latency) && latency >= 26000, 'Transfer timing includes deliberate network delay'); checks++;
  // The same privileged RPC used by the popup restores the last transcript
  // without a microphone/API call, and keeps the real Enter path working.
  const rewrite = async () => options.evaluate(() => chrome.runtime.sendMessage({type: 'ui:rewrite'}));
  assert.equal((await sessionStore()).status.canRewrite, true); checks++;
  const beforeRewrite = (await page.locator('#editor').innerText()).trim();
  assert.equal((await rewrite()).ok, true);
  assert.equal((await page.locator('#editor').innerText()).trim(), beforeRewrite);
  assert.equal((await sessionStore()).status.recording, false); checks++;
  await page.locator('#editor').fill('');
  assert.equal((await rewrite()).ok, true);
  assert.equal((await page.locator('#editor').innerText()).trim(), beforeRewrite); checks++;
  const repeatedRewrite = await rewrite();
  assert.equal(repeatedRewrite.ok, true); assert.match(repeatedRewrite.data.message, /zaten/);
  assert.equal((await page.locator('#editor').innerText()).trim(), beforeRewrite); checks++;
  const afterRewriteUsage = await worker.evaluate(async () => (await chrome.storage.local.get('hbVoice.usage.v1'))['hbVoice.usage.v1']);
  assert.deepEqual(afterRewriteUsage, usage); assert.equal(await page.evaluate(() => globalThis.sentCount), 0); checks++;
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => globalThis.sentCount), 1); assert.equal((await sessionStore()).session, null); checks++;
  assert.equal(await page.evaluate(() => globalThis.sendClicks), 1); assert.equal(await page.evaluate(() => globalThis.nativeEnterCount), 0); checks++;
  assert.equal(await page.locator('#hizir-voice-host').isVisible(), false); checks++;
  assert.equal((await sessionStore()).status.canRewrite, false); assert.equal((await rewrite()).ok, false); checks++;
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
  // Feed 36 seconds of deterministic PCM into the isolated test copy's
  // segmenter; real Worklet capture was exercised above. No hook is shipped.
  await page.locator('#editor').fill('Önceden yazılmış metin.');
  await toggle(); await listening(); await qa('qa:long');
  const longDraft = 'Çekim talebiniz ile ilgili kontrollerimiz sürüyor henüz onaylanmadı bu nedenle bir süre daha beklemenizi rica ediyoruz bilgi vereceğiz.';
  await page.waitForFunction(text => document.getElementById('editor').innerText.trim() === 'Önceden yazılmış metin. ' + text, longDraft, {timeout: 15000});
  assert.equal((await sessionStore()).status.recording, true);
  assert.equal(((await page.locator('#editor').innerText()).match(/çekim talebiniz/gi) || []).length, 1); checks++;
  const longRequests = (await qa('qa:get')).requests;
  assert.equal(longRequests.filter(x => x.endsWith('/audio/transcriptions')).length, 5); assert.equal(longRequests.filter(x => x.endsWith('/chat/completions')).length, 1); checks++;
  const longReadyUntil = Date.now() + 5000;
  while ((await sessionStore()).status.busy && Date.now() < longReadyUntil) await page.waitForTimeout(100);
  assert.equal((await sessionStore()).status.busy, false);
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => globalThis.sentCount), 3); assert.equal((await sessionStore()).session, null); checks++;
  // Successive ASR previews describe the same growing audio window. They
  // must update one span, not produce "örnek örnek com örnek com tr".
  await page.locator('#editor').fill('Korunan başlangıç.');
  await toggle(); await listening(); await qa('qa:window');
  for (const text of ['örnek', 'örnek com', 'örnek com tr']) {
    await qa('qa:preview', {text});
    await page.waitForFunction(text => document.getElementById('editor').innerText.trim() === 'Korunan başlangıç. ' + text, text[0].toLocaleUpperCase('tr-TR') + text.slice(1));
    checks++;
  }
  await qa('qa:settle');
  await page.waitForFunction(() => document.getElementById('editor').innerText.trim() === 'Korunan başlangıç. Örnek com tr.');
  const previewRequests = (await qa('qa:get')).requests;
  assert.equal(previewRequests.filter(x => x.endsWith('/audio/transcriptions')).length, 3);
  assert.equal(previewRequests.filter(x => x.endsWith('/chat/completions')).length, 1); checks++;
  const previewReadyUntil = Date.now() + 5000;
  while ((await sessionStore()).status.busy && Date.now() < previewReadyUntil) await page.waitForTimeout(100);
  assert.equal((await sessionStore()).status.recording, true);
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => globalThis.sentCount), 4); assert.equal((await sessionStore()).session, null); checks++;
  // Exercise the shipped WASM filter through the production PCM entry point.
  await options.evaluate(noiseDeviceId => chrome.runtime.sendMessage({type: 'ui:save', settings: {backgroundGuard: true, noiseLevel: 0.009, noiseDeviceId}}), measured.noiseDeviceId);
  await page.locator('#editor').fill('Korunan başlangıç.'); await toggle(); await listening();
  assert.deepEqual(await qa('qa:guard'), {filter: true, rate: 16000}); checks++;
  await qa('qa:pcm', {samples: Array.from(musicSignal(6))}); await page.waitForTimeout(300);
  assert.equal((await qa('qa:get')).requests.length, 0);
  assert.equal((await page.locator('#editor').innerText()).trim(), 'Korunan başlangıç.'); assert.equal((await sessionStore()).status.recording, true); checks++;
  const publicSpeech = await speechFixture(), music = musicSignal(publicSpeech.length / 16000);
  await qa('qa:pcm', {samples: Array.from(publicSpeech.map((n, i) => n + music[i]))});
  await page.waitForFunction(() => document.getElementById('editor').innerText.includes('henüz onaylanmadı'));
  assert.ok((await qa('qa:get')).requests.some(x => x.endsWith('/audio/transcriptions'))); checks++;
  await toggle(); const guardStopUntil = Date.now() + 10000;
  while ((await sessionStore()).session && Date.now() < guardStopUntil) await page.waitForTimeout(100);
  assert.equal((await sessionStore()).session, null); assert.equal(await page.evaluate(() => globalThis.sentCount), 4); checks++;
  await options.evaluate(() => chrome.runtime.sendMessage({type: 'ui:save', settings: {noiseLevel: 0, noiseDeviceId: ''}}));
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
  while (Date.now() < unsafeUntil) {if ((await sessionStore()).status.warning.includes('net anlaşılamadığı')) break; await page.waitForTimeout(200);}
  const rejected = await sessionStore(); assert.notEqual(rejected.status.phase, 'error'); assert.match(rejected.status.warning, /net anlaşılamadığı/); assert.ok(rejected.session); assert.equal(rejected.status.recording, true); checks++;
  assert.equal((await page.locator('#editor').innerText()).trim(), 'Korunacak mevcut metin.'); assert.equal(await page.locator('#hizir-voice-host').isVisible(), true); assert.equal(await page.evaluate(() => globalThis.sentCount), 4); checks++;
  await qa('qa:settle');
  for (let count = 2; count <= 4; count++) {
    await qa('qa:reject');
    const rejectedUntil = Date.now() + 5000;
    while (!(await sessionStore()).status.warning.includes(count + ' ses bölümü') && Date.now() < rejectedUntil) await page.waitForTimeout(100);
    const state = await sessionStore();
    assert.equal(state.status.recording, true); assert.ok(state.session); assert.match(state.status.warning, new RegExp(count + ' ses bölümü'));
    assert.match(state.status.warning, /Yanlış anlaşılabilecek/); checks++;
  }
  assert.equal((await page.locator('#editor').innerText()).trim(), 'Korunacak mevcut metin.'); checks++;
  await toggle();
  const cleanStopUntil = Date.now() + 5000;
  while ((await sessionStore()).session && Date.now() < cleanStopUntil) await page.waitForTimeout(100);
  await page.waitForTimeout(500);
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
