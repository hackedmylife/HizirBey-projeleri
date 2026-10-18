import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
const source = await readFile(new URL('../extension/editor.js', import.meta.url), 'utf8');
function fixture({note = false} = {}) {
  const window = new Window({url: 'https://my.livechatinc.com/chats/DEMO01'});
  window.document.body.innerHTML = `<main data-chat-id="DEMO01"><div data-testid="chat-feed"><div data-testid="DEMO01001_1-reaction"></div></div><div id="composer"><div id="editor" data-testid="chat-feed-text-area-test-id" contenteditable="true" data-lexical-editor="true" role="textbox"></div><div><p>${note ? "Type an internal note, the customer won't see this message" : 'Type your message'}</p></div></div></main>`;
  window.HTMLElement.prototype.getClientRects = function () {return this.isConnected ? [{width: 500, height: 100}] : [];};
  window.document.execCommand = (command, _, text) => {if (command !== 'insertText') return false; const editor = window.document.getElementById('editor'), selection = window.getSelection(); const replace = selection.rangeCount && !selection.getRangeAt(0).collapsed; editor.textContent = replace ? text : editor.textContent + text; editor.dispatchEvent(new window.InputEvent('input', {bubbles: true, inputType: 'insertText', data: text})); return true;};
  window.eval(source);
  return window;
}
test('the exact LiveChat Lexical selector appends without replacing existing text', async () => {
  const window = fixture(), editor = window.document.getElementById('editor'); editor.innerText = 'Önceden yazılmış metin.';
  const binding = new window.HizirVoiceEditor.Binding();
  let events = 0; editor.addEventListener('input', () => events++);
  await binding.insert('Yeni dikte.');
  assert.equal(editor.innerText, 'Önceden yazılmış metin. Yeni dikte.'); assert.equal(events, 1); await window.happyDOM.close();
});
test('manual edits cancel insertion and preserve the user’s current words', async () => {
  const window = fixture(), editor = window.document.getElementById('editor'), binding = new window.HizirVoiceEditor.Binding();
  editor.innerText = 'Elle değiştirilmiş.';
  await assert.rejects(binding.insert('Geç gelen dikte.'), /elle değiştirdin/); assert.equal(editor.innerText, 'Elle değiştirilmiş.'); await window.happyDOM.close();
});
test('switching the conversation identity or replacing the editor invalidates the target', async () => {
  const window = fixture(), binding = new window.HizirVoiceEditor.Binding();
  window.document.querySelector('main').dataset.chatId = 'OTHER01';
  assert.equal(binding.valid(), false); await assert.rejects(binding.insert('Yanlış hedef.'), /Görüşme/);
  await window.happyDOM.close();
});
test('internal note mode and multiple visible editors fail closed', async () => {
  const window = fixture({note: true}); assert.throws(() => new window.HizirVoiceEditor.Binding(), /İç not/); await window.happyDOM.close();
  const two = fixture(); const clone = two.document.getElementById('editor').cloneNode(true); two.document.body.append(clone); assert.throws(() => new two.HizirVoiceEditor.Binding(), /Birden fazla/); await two.happyDOM.close();
});
test('a newly selected note mode invalidates an already bound editor', async () => {
  const window = fixture(), binding = new window.HizirVoiceEditor.Binding();
  window.document.querySelector('#composer p').textContent = 'Type an internal note';
  assert.equal(binding.valid(), false); await window.happyDOM.close();
});
test('Enter resolves only the bound composer send button', async () => {
  const window = fixture(), doc = window.document;
  doc.getElementById('composer').insertAdjacentHTML('beforeend', '<button data-testid="send-button" id="correct-send">Send</button>');
  doc.body.insertAdjacentHTML('beforeend', '<section data-chat-id="OTHER01"><button data-testid="send-button" id="other-send">Other</button></section>');
  const binding = new window.HizirVoiceEditor.Binding();
  assert.equal(binding.sendButton().id, 'correct-send');
  doc.getElementById('correct-send').remove();
  assert.throws(() => binding.sendButton(), /bulunamadı/, 'Never use a different conversation send button');
  await window.happyDOM.close();
});
test('disabled or ambiguous Send controls preserve the reviewed draft', async () => {
  for (const buttons of ['<button data-testid="send-button" disabled>Send</button>', '<button data-testid="send-button" aria-disabled="true">Send</button>', '<button data-testid="send-button">One</button><button data-testid="send-button">Two</button>']) {
    const window = fixture(), doc = window.document;
    doc.getElementById('editor').innerText = 'Korunacak taslak.';
    doc.getElementById('composer').insertAdjacentHTML('beforeend', buttons);
    const binding = new window.HizirVoiceEditor.Binding();
    assert.throws(() => binding.sendButton(), /hazır değil|belirsiz/);
    assert.equal(doc.getElementById('editor').innerText, 'Korunacak taslak.');
    await window.happyDOM.close();
  }
});
test('five draft revisions and final punctuation update one dictated span without duplicates', async () => {
  const window = fixture(), editor = window.document.getElementById('editor'); editor.innerText = 'Önceden yazılmış metin.';
  const binding = new window.HizirVoiceEditor.Binding();
  for (const text of ['Merhaba', 'Merhaba talebiniz', 'Merhaba talebiniz henüz', 'Merhaba talebiniz henüz onaylanmadı', 'Merhaba talebiniz henüz onaylanmadı bilgi vereceğiz', 'Merhaba, talebiniz henüz onaylanmadı. Bilgi vereceğiz.']) await binding.insert(text, {replace: true});
  assert.equal(editor.innerText, 'Önceden yazılmış metin. Merhaba, talebiniz henüz onaylanmadı. Bilgi vereceğiz.');
  assert.equal(binding.segments.length, 1);
  await binding.undo(); assert.equal(editor.innerText, 'Önceden yazılmış metin.'); assert.equal(binding.segments.length, 0);
  await window.happyDOM.close();
});
test('late punctuation never overwrites manual edits to a provisional draft', async () => {
  const window = fixture(), editor = window.document.getElementById('editor'), binding = new window.HizirVoiceEditor.Binding();
  await binding.insert('Taslak metin', {replace: true}); editor.innerText = 'Kullanıcının kontrol ettiği metin.';
  await assert.rejects(binding.insert('Taslak metin.', {replace: true}), /elle değiştirdin/);
  assert.equal(editor.innerText, 'Kullanıcının kontrol ettiği metin.'); await window.happyDOM.close();
});
test('explicit rewrite restores a removed dictation and repeat clicks never duplicate it', async () => {
  const window = fixture(), editor = window.document.getElementById('editor'), binding = new window.HizirVoiceEditor.Binding();
  await binding.insert('Son dikte.', {replace: true}); editor.innerText = '';
  const result = await binding.rewrite('Son dikte.');
  assert.equal(result.unchanged, false); assert.equal(editor.innerText, 'Son dikte.');
  let writes = 0; editor.addEventListener('input', () => writes++);
  assert.equal((await result.binding.rewrite('Son dikte.')).unchanged, true);
  assert.equal(editor.innerText, 'Son dikte.'); assert.equal(writes, 0);
  await window.happyDOM.close();
});
test('rewrite preserves a manual draft and never crosses a conversation or note boundary', async () => {
  const window = fixture(), editor = window.document.getElementById('editor'), binding = new window.HizirVoiceEditor.Binding();
  await binding.insert('Dikte sonucu.', {replace: true}); editor.innerText = 'Elle düzelttiğim ayrı metin.';
  await assert.rejects(binding.rewrite('Dikte sonucu.'), /farklı bir metin/);
  assert.equal(editor.innerText, 'Elle düzelttiğim ayrı metin.');
  editor.innerText = ''; window.document.querySelector('main').dataset.chatId = 'OTHER01';
  await assert.rejects(binding.rewrite('Dikte sonucu.'), /Görüşme/); assert.equal(editor.innerText, '');
  await window.happyDOM.close();
});
test('rewrite after undo retains the prefix; clearing everything does not resurrect that prefix', async () => {
  const window = fixture(), editor = window.document.getElementById('editor'); editor.innerText = 'Başlangıç.';
  const binding = new window.HizirVoiceEditor.Binding(); await binding.insert('Son dikte.', {replace: true}); await binding.undo();
  const restored = await binding.rewrite('Son dikte.');
  assert.equal(editor.innerText, 'Başlangıç. Son dikte.');
  editor.innerText = ''; const cleared = await restored.binding.rewrite('Son dikte.');
  assert.equal(editor.innerText, 'Son dikte.'); assert.equal(cleared.binding.initial, '');
  await window.happyDOM.close();
});
