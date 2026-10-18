/* Standalone Chromium integration/visual QA. No real LiveChat session or API key. */
import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..'), extensionPath = path.join(root, 'extension');
const output = process.env.QA_OUTPUT || path.join(root, '.qa'); await mkdir(output, {recursive: true});
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox']});
const context = await browser.newContext();
let checks = 0;
const errors = [];
context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
const editorSource = await readFile(path.join(extensionPath, 'editor.js'), 'utf8');
const contentSource = await readFile(path.join(extensionPath, 'content.js'), 'utf8');
const fixture = `<!doctype html><html lang="tr"><meta charset="utf-8"><style>body{font:16px system-ui;padding:35px;background:#f5f6f8}main{max-width:850px;margin:auto;background:white;padding:24px}#editor{border:1px solid #888;min-height:100px;padding:15px;margin-top:30px}button{padding:10px}</style><main data-chat-id="DEMOCHAT01"><h1>Kontrollü LiveChat editör testi</h1><div data-testid="chat-feed"><p>Bu sayfa gerçek bir görüşme değildir.</p><div data-testid="DEMOCHAT01_1-reaction"></div></div><div id="composer"><div id="editor" data-testid="chat-feed-text-area-test-id" data-lexical-editor="true" contenteditable="true" role="textbox"><p><br></p></div><div id="placeholder"><p>Type your message</p></div><button data-testid="send-button">Send</button></div><p id="sent">0</p></main><script>window.sentCount=0;window.sendClicks=0;window.nativeEnterCount=0;window.nativeEnterSends=true;const send=()=>{window.sentCount++;document.getElementById('sent').textContent=window.sentCount;};document.querySelector('[data-testid="send-button"]').addEventListener('click',()=>{window.sendClicks++;send();});document.getElementById('editor').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){window.nativeEnterCount++;if(window.nativeEnterSends){e.preventDefault();send();}}});</script></html>`;
const page = await context.newPage();
await page.route('https://my.livechatinc.com/**', route => route.fulfill({body: fixture, contentType: 'text/html'}));
await page.goto('https://my.livechatinc.com/chats/DEMOCHAT01');
await page.evaluate(() => {
  globalThis.__listeners = []; globalThis.__messages = [];
  globalThis.chrome = {runtime: {id: 'test-extension', getURL: p => 'https://example.test/' + p, onMessage: {addListener: callback => globalThis.__listeners.push(callback)}, sendMessage: async message => {globalThis.__messages.push(message); return {ok: true, data: true};}}};
  globalThis.__dispatch = message => new Promise(resolve => {let async = false; for (const listener of globalThis.__listeners) {if (listener(message, {id: 'test-extension'}, resolve)) async = true;} if (!async) queueMicrotask(() => resolve(null));});
});
await page.addScriptTag({content: editorSource}); await page.addScriptTag({content: contentSource});
const dispatch = message => page.evaluate(message => globalThis.__dispatch(message), message);
assert.equal(await page.locator('#hizir-voice-host').isVisible(), false);
assert.equal(await page.locator('#hizir-voice-host').locator('button').count(), 0); checks++;
assert.equal((await dispatch({type: 'voice:bind', sessionId: 's1'})).ok, true); checks++;
await dispatch({type: 'voice:status', sessionId: 's1', data: {sessionId: 's1', busy: true, recording: true, message: 'Hazırlanıyor'}});
const dot = page.locator('#hizir-voice-host').locator('#indicator');
assert.equal(await dot.isVisible(), true);
assert.equal(await dot.evaluate(x => getComputedStyle(x).backgroundColor), 'rgb(239, 68, 68)');
const dotRect = await page.locator('#hizir-voice-host').boundingBox();
assert.equal(dotRect.width, 20); assert.equal(dotRect.height, 20);
assert.ok(Math.abs(dotRect.x + dotRect.width / 2 - page.viewportSize().width / 2) < 1);
assert.ok(Math.abs(dotRect.y + dotRect.height / 2 - page.viewportSize().height / 2) < 1);
assert.equal(await page.locator('#hizir-voice-host').evaluate(x => getComputedStyle(x).pointerEvents), 'none'); checks++;
await page.screenshot({path: path.join(output, 'livechat-indicator.png'), fullPage: true});
await page.setViewportSize({width: 390, height: 844});
const resized = await page.locator('#hizir-voice-host').boundingBox();
assert.ok(Math.abs(resized.x + resized.width / 2 - 195) < 1); assert.ok(Math.abs(resized.y + resized.height / 2 - 422) < 1); checks++;
await page.setViewportSize({width: 1280, height: 720});
await dispatch({type: 'voice:status', sessionId: 's1', data: {sessionId: 's1', busy: true, recording: false, message: 'Metin hazırlanıyor'}});
assert.equal(await dot.isVisible(), true); assert.equal(await dot.getAttribute('data-phase'), 'processing'); checks++;
await page.locator('#editor').focus(); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => globalThis.sentCount), 0); checks++;
assert.equal((await dispatch({type: 'voice:insert', sessionId: 's1', data: {segmentId: 1, text: 'Çekiminiz henüz onaylanmadı.', raw: 'çekiminiz henüz onaylanmadı'}})).ok, true);
assert.equal((await page.locator('#editor').innerText()).trim(), 'Çekiminiz henüz onaylanmadı.'); checks++;
assert.equal((await dispatch({type: 'voice:insert', sessionId: 's1', data: {segmentId: 1, text: 'Çekiminiz henüz onaylanmadı.'}})).ok, true);
assert.equal((await page.locator('#editor').innerText()).trim(), 'Çekiminiz henüz onaylanmadı.'); checks++;
await dispatch({type: 'voice:status', sessionId: 's1', data: {sessionId: 's1', busy: false, recording: true, message: 'Hazır'}});
assert.equal((await dispatch({type: 'voice:undo', sessionId: 's1'})).ok, true);
assert.equal((await page.locator('#editor').innerText()).trim(), '');
assert.equal((await dispatch({type: 'voice:insert', sessionId: 's1', data: {segmentId: 2, text: 'Çekiminiz henüz onaylanmadı.'}})).ok, true); checks++;
// A verified draft is immediately sendable even before a busy status clears.
await dispatch({type: 'voice:status', sessionId: 's1', data: {sessionId: 's1', busy: true, recording: true}});
await page.keyboard.down('Enter'); assert.equal(await page.evaluate(() => globalThis.sentCount), 1);
assert.equal(await page.evaluate(() => globalThis.sendClicks), 1); assert.equal(await page.evaluate(() => globalThis.nativeEnterCount), 0); checks++;
await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
assert.equal(await page.evaluate(() => globalThis.sentCount), 1, 'Holding Enter must not send twice'); checks++;
assert.equal(await dot.isVisible(), false); checks++;
assert.equal((await dispatch({type: 'voice:insert', sessionId: 's1', data: {text: 'Geciken sonuç.'}})).ok, false); checks++;
await page.locator('#editor').fill('Mevcut yazı.'); await dispatch({type: 'voice:bind', sessionId: 's2'});
await page.locator('#editor').fill('Kullanıcının elle yazdığı metin.');
assert.equal((await dispatch({type: 'voice:insert', sessionId: 's2', data: {text: 'Dikte sonucu.'}})).ok, false);
assert.equal((await page.locator('#editor').innerText()).trim(), 'Kullanıcının elle yazdığı metin.'); checks++;
await dispatch({type: 'voice:release', sessionId: 's2'});
await page.locator('#placeholder p').evaluate(x => {x.textContent = "Type an internal note, the customer won't see this message";});
assert.equal((await dispatch({type: 'voice:bind', sessionId: 's3'})).ok, false); checks++;
await page.locator('#placeholder p').evaluate(x => {x.textContent = 'Type your message';});
await dispatch({type: 'voice:bind', sessionId: 's4'});
await page.locator('main').evaluate(x => {x.dataset.chatId = 'DEMOCHAT02';}); await page.waitForTimeout(120);
assert.equal((await dispatch({type: 'voice:insert', sessionId: 's4', data: {text: 'Yanlış görüşmeye gitmemeli.'}})).ok, false); checks++;
await page.screenshot({path: path.join(output, 'livechat-editor.png'), fullPage: true});

// LiveChat's Enter-is-newline setting must not require changing app settings.
await page.locator('#editor').fill('');
await page.evaluate(() => {globalThis.nativeEnterSends = false;});
await dispatch({type: 'voice:bind', sessionId: 'newline'});
await dispatch({type: 'voice:insert', sessionId: 'newline', data: {segmentId: 1, text: 'Kontrol edilmiş metin.'}});
const sentBefore = await page.evaluate(() => globalThis.sentCount);
await page.evaluate(() => document.getElementById('editor').dispatchEvent(new window.KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})));
assert.equal(await page.evaluate(() => globalThis.sentCount), sentBefore, 'Untrusted keys cannot activate Send'); checks++;
await page.keyboard.press('Shift+Enter');
assert.equal(await page.evaluate(() => globalThis.sentCount), sentBefore); checks++;
await page.keyboard.press('Enter');
assert.equal(await page.evaluate(() => globalThis.sentCount), sentBefore + 1);
assert.equal(await page.locator('#hizir-voice-host').isVisible(), false); checks++;
// A disabled button cannot silently lose or submit the reviewed draft.
await page.locator('#editor').fill(''); await dispatch({type: 'voice:bind', sessionId: 'disabled'});
await dispatch({type: 'voice:insert', sessionId: 'disabled', data: {segmentId: 1, text: 'Korunacak taslak.'}});
await page.locator('[data-testid="send-button"]').evaluate(x => {x.disabled = true;});
await page.keyboard.press('Enter');
assert.equal(await page.evaluate(() => globalThis.sentCount), sentBefore + 1);
assert.equal((await page.locator('#editor').innerText()).trim(), 'Korunacak taslak.');
assert.equal(await page.evaluate(() => globalThis.__messages.some(x => x.type === 'content:cancel' && /hazır değil/.test(x.reason))), true); checks++;
await page.locator('[data-testid="send-button"]').evaluate(x => {x.disabled = false;});
// Normal stop hides the dot but keeps the reviewed draft's Enter shortcut.
await page.locator('#editor').fill(''); await dispatch({type: 'voice:bind', sessionId: 'stopped'});
await dispatch({type: 'voice:insert', sessionId: 'stopped', data: {segmentId: 1, text: 'Dinleme bitti, taslak hazır.'}});
await dispatch({type: 'voice:release', sessionId: 'stopped', keepDraft: true});
assert.equal(await page.locator('#hizir-voice-host').isVisible(), false);
assert.equal((await dispatch({type: 'voice:insert', sessionId: 'stopped', data: {segmentId: 2, text: 'Geç kalan sonuç.'}})).ok, false); checks++;
await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => globalThis.sentCount), sentBefore + 2); checks++;


// Five preview updates plus final punctuation replace one draft and retain
// the text that was already in the editor when dictation started.
await page.locator('#editor').fill('Önceden yazılmış metin.');
await dispatch({type: 'voice:bind', sessionId: 'draft-flow'});
const fragments = ['merhaba', 'talebiniz', 'henüz', 'onaylanmadı', 'bilgi vereceğiz'];
for (let i = 0; i < fragments.length; i++) {
  const text = fragments.slice(0, i + 1).join(' ');
  assert.equal((await dispatch({type: 'voice:insert', sessionId: 'draft-flow', data: {segmentId: i + 1, text, replace: true, final: false}})).ok, true);
}
const finalDraft = 'Merhaba, talebiniz henüz onaylanmadı. Bilgi vereceğiz.';
assert.equal((await dispatch({type: 'voice:insert', sessionId: 'draft-flow', data: {segmentId: 6, text: finalDraft, replace: true, final: true}})).ok, true);
assert.equal((await page.locator('#editor').innerText()).trim(), 'Önceden yazılmış metin. ' + finalDraft); checks++;
await page.keyboard.press('Enter');
assert.equal(await page.locator('#hizir-voice-host').isVisible(), false); checks++;

// Render actual packaged UI with a local fake extension transport.
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png'};
const server = createServer(async (req, res) => {try {const file = path.resolve(extensionPath, '.' + new URL(req.url, 'http://localhost').pathname); if (!file.startsWith(extensionPath + path.sep)) throw new Error('bad path'); const bytes = await readFile(file); res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}); res.end(bytes);} catch {res.writeHead(404); res.end();}});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await context.addInitScript(() => {
  if (!location.hostname.includes('127.0.0.1')) return;
  const data = {settings: {model: 'whisper-large-v3', correction: true, fastMode: true, freeConfirmed: false, cloudConsent: false, microphoneReady: false, deviceId: '', sensitivity: 0.005, micGain: 1.35, pauseMs: 500, learn: false}, hasKey: false, terms: ['Hızır Bey', 'LiveChat', 'EveryMatrix', 'FastKeys'], memory: {count: 0, bytes: 120, maxBytes: 10000000}, usage: {}, shortcut: 'Alt+H', status: {phase: 'idle', message: 'LiveChat görüşmesinde Alt + H ile başlat.', busy: false, recording: false}};
  globalThis.__uiListeners = []; globalThis.__uiMessages = [];
  globalThis.chrome = {runtime: {sendMessage: async message => {globalThis.__uiMessages.push(message); if (message.type === 'ui:get') return {ok: true, data}; if (message.type === 'ui:save') {data.settings = {...data.settings, ...message.settings}; data.hasKey = Boolean(message.key) || data.hasKey;} return {ok: true, data: true};}, onMessage: {addListener(fn) {globalThis.__uiListeners.push(fn);}}}, storage: {onChanged: {addListener() {}}}};
});
const options = await context.newPage(); await options.setViewportSize({width: 1440, height: 1080});
await options.goto(`http://127.0.0.1:${port}/options.html`); await options.waitForFunction(() => document.getElementById('shortcutState').textContent.includes('Alt+H'));
assert.equal(await options.locator('img').first().evaluate(x => x.complete && x.naturalWidth > 0), true); checks++;
assert.equal(await options.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); checks++;
assert.equal(await options.locator('#micGain').inputValue(), '1.35'); assert.equal(await options.locator('#micGainValue').textContent(), '%135'); assert.equal(await options.locator('#sensitivity').inputValue(), '0.005'); checks++;
assert.equal(await options.locator('#pauseMs').inputValue(), '500'); assert.equal(await options.locator('#fastMode').isChecked(), true); checks++;
await options.screenshot({path: path.join(output, 'settings-desktop.png'), fullPage: true});
await options.locator('#apiKey').fill('test-credential-placeholder-000000'); await options.locator('#freeConfirmed').check(); await options.locator('#cloudConsent').check(); await options.locator('#save').click(); await options.waitForFunction(() => document.getElementById('saveState').textContent.includes('kaydedildi'));
assert.equal(await options.locator('#apiKey').inputValue(), ''); checks++;
await options.setViewportSize({width: 390, height: 844}); assert.equal(await options.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); checks++;
await options.screenshot({path: path.join(output, 'settings-mobile.png'), fullPage: true});
const popup = await context.newPage(); await popup.setViewportSize({width: 550, height: 260}); await popup.goto(`http://127.0.0.1:${port}/popup.html`); await popup.waitForFunction(() => document.getElementById('setup').textContent.includes('Ayarları'));
assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
assert.equal(await popup.locator('.panel-logo').evaluate(x => x.complete && x.naturalWidth > 0), true); checks++;
await popup.screenshot({path: path.join(output, 'popup.png')});
await popup.locator('#toggle').click(); assert.equal(await popup.evaluate(() => globalThis.__uiMessages.some(x => x.type === 'ui:toggle')), true); checks++;
await popup.evaluate(() => globalThis.__uiListeners.forEach(fn => fn({type: 'voice:status', target: 'ui', data: {sessionId: 'qa', phase: 'finishing', busy: true, recording: false, seconds: 20, level: 0.4, message: 'Son cümle hazırlanıyor…', canUndo: true, lastText: 'Merhaba.', lastLatencyMs: 1250}})));
assert.equal(await popup.locator('#toggle').textContent(), 'İptal'); assert.equal(await popup.locator('#undo').isDisabled(), true); assert.equal(await popup.locator('#timer').textContent(), '00:20'); checks++;
assert.equal(await popup.locator('#latency').textContent(), 'Son aktarım: 1,3 sn'); assert.equal(await popup.locator('#latency').isVisible(), true); checks++;
await popup.screenshot({path: path.join(output, 'popup-active.png')});
await popup.evaluate(() => globalThis.__uiListeners.forEach(fn => fn({type: 'voice:status', target: 'ui', data: {phase: 'error', busy: false, recording: false, warning: 'Önceki düzeltme uyarısı.', message: 'Şüpheli dikte yazılmadı; mikrofon kapatıldı.'}})));
assert.equal(await popup.locator('#status').textContent(), 'Şüpheli dikte yazılmadı; mikrofon kapatıldı.'); checks++;
assert.deepEqual(errors, []); checks++;
await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve));
console.log(`Browser/editor/UI checks passed: ${checks}. Screenshots: ${output}`);
