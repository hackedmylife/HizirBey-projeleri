/* Real Chromium clipboard/paste tests against a synthetic LiveChat page. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const source = await Promise.all(['editor.js', 'content.js'].map(f => readFile(path.join(root, 'livechat-kopru', f), 'utf8')));
const browser = await chromium.launch({headless: true, args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH});
const context = await browser.newContext({permissions: ['clipboard-read', 'clipboard-write']});
const errors = [];
context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
let checks = 0;
const fixture = `<!doctype html><meta charset="utf-8"><style>[contenteditable]{min-height:60px;border:1px solid}textarea{width:400px;height:80px}</style><main data-chat-id="DEMOCHAT01"><div data-testid="chat-feed"><div data-testid="DEMOCHAT01_1-reaction"></div></div><div id="composer"><div id="editor" data-testid="chat-feed-text-area-test-id" contenteditable="true"><p><br></p></div><div id="placeholder">Type your message</div><button id="send">Send</button></div><input id="search" placeholder="Search"></main><script>globalThis.sent=0;document.querySelector('#send').onclick=()=>sent++;document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='editor')sent++;});</script>`;
async function pageFor(html = fixture) {
  const page = await context.newPage();
  await page.route('https://my.livechatinc.com/**', r => r.fulfill({body: html, contentType: 'text/html'}));
  await page.goto('https://my.livechatinc.com/chats/DEMOCHAT01');
  await page.evaluate(() => {
    globalThis.listener = null;
    globalThis.chrome = {runtime: {id: 'bridge-test', onMessage: {addListener: fn => {globalThis.listener = fn;}}}};
    globalThis.prepare = reset => new Promise(resolve => listener({type: reset ? 'hb:reset' : 'hb:prepare'}, {id: 'bridge-test'}, resolve));
  });
  for (const script of source) await page.addScriptTag({content: script});
  return page;
}
async function prepare(page, reset = false) { return page.evaluate(reset => globalThis.prepare(reset), reset); }
async function paste(page, text) {
  await page.evaluate(t => navigator.clipboard.writeText(t), text);
  await page.keyboard.press('Control+V');
  await page.waitForTimeout(130);
}
async function signal(page) { return page.evaluate(() => navigator.clipboard.readText()); }
try {
  const page = await pageFor();
  assert.equal((await prepare(page)).phase, 'prepared'); checks++;
  assert.equal((await page.locator('#editor').innerText()).trim(), ''); checks++;
  assert.match(await signal(page), /^HB-DIKTE-2\|READY\|[a-f0-9]{32}\|prepared$/); checks++;
  const firstId = (await signal(page)).split('|')[2];
  // Simulate a long local dictation: its intermediate text never reaches LiveChat.
  await page.waitForTimeout(50);
  assert.equal((await page.locator('#editor').innerText()).trim(), ''); checks++;
  assert.equal((await prepare(page)).phase, 'armed'); checks++;
  assert.equal((await signal(page)).split('|')[2], firstId); checks++;
  await paste(page, 'İşleminizi kontrol ediyorum.');
  assert.equal((await page.locator('#editor').innerText()).trim(), 'İşleminizi kontrol ediyorum.'); checks++;
  assert.equal(await page.evaluate(() => sent), 0); checks++;
  assert.equal(await signal(page), `HB-DIKTE-2|DONE|${firstId}|inserted`); checks++;
  assert.equal((await prepare(page)).phase, 'prepared'); checks++;
  const nextId = (await signal(page)).split('|')[2];
  assert.notEqual(nextId, firstId); checks++;
  await prepare(page);
  await paste(page, 'Biraz beklemenizi rica edeceğim.');
  assert.equal((await page.locator('#editor').innerText()).trim(), 'İşleminizi kontrol ediyorum. Biraz beklemenizi rica edeceğim.'); checks++;
  assert.equal(await page.evaluate(() => sent), 0); checks++;

  const changed = await pageFor();
  await prepare(changed);
  await changed.locator('main').evaluate(e => {e.dataset.chatId = 'DEMOCHAT02';});
  assert.equal((await prepare(changed)).ok, false); checks++;
  assert.match(await signal(changed), /\|ERROR\|.*\|changed$/); checks++;
  assert.equal((await changed.locator('#editor').innerText()).trim(), ''); checks++;

  const edited = await pageFor();
  await prepare(edited);
  await edited.locator('#editor').fill('Elle yazılmış taslak.');
  assert.equal((await prepare(edited)).ok, false); checks++;
  assert.equal((await edited.locator('#editor').innerText()).trim(), 'Elle yazılmış taslak.'); checks++;

  const note = await pageFor();
  await note.locator('#placeholder').evaluate(e => {e.textContent = "Type an internal note, the customer won't see this message";});
  assert.equal((await prepare(note)).ok, false); checks++;
  assert.match(await signal(note), /\|note$/); checks++;

  const wrongField = await pageFor();
  await prepare(wrongField); await prepare(wrongField);
  await wrongField.locator('#search').focus();
  await paste(wrongField, 'Yalnız mesaj alanına.');
  assert.equal((await wrongField.locator('#editor').innerText()).trim(), 'Yalnız mesaj alanına.'); checks++;
  assert.equal(await wrongField.locator('#search').inputValue(), ''); checks++;
  assert.equal(await wrongField.evaluate(() => sent), 0); checks++;

  const untrusted = await pageFor();
  await prepare(untrusted); await prepare(untrusted);
  await untrusted.evaluate(() => {
    const data = new DataTransfer(); data.setData('text/plain', 'Sayfa tarafından taklit edilen olay.');
    document.dispatchEvent(new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true}));
  });
  assert.equal((await untrusted.locator('#editor').innerText()).trim(), ''); checks++;

  const swapped = await pageFor();
  await prepare(swapped); await prepare(swapped);
  await swapped.locator('main').evaluate(e => {e.dataset.chatId = 'DEMOCHAT02';});
  await paste(swapped, 'Bu metin yanlış sohbete gitmemeli.');
  assert.equal((await swapped.locator('#editor').innerText()).trim(), ''); checks++;
  assert.equal(await swapped.evaluate(() => sent), 0); checks++;
  assert.match(await signal(swapped), /\|ERROR\|/); checks++;

  const textarea = await pageFor(fixture.replace('<div id="editor" data-testid="chat-feed-text-area-test-id" contenteditable="true"><p><br></p></div>', '<textarea id="editor" data-testid="message-input"></textarea>'));
  await textarea.locator('#editor').fill('Önceden yazılmış metin.');
  await prepare(textarea); await prepare(textarea);
  await paste(textarea, '<img src=x onerror=alert(1)>');
  assert.equal(await textarea.locator('#editor').inputValue(), 'Önceden yazılmış metin. <img src=x onerror=alert(1)>'); checks++;
  assert.equal(await textarea.locator('#composer img').count(), 0); checks++;
  assert.equal(await textarea.evaluate(() => sent), 0); checks++;
  assert.deepEqual(errors, []); checks++;
  console.log(`${checks} Chromium bridge checks passed. No message was submitted.`);
} finally { await browser.close(); }
