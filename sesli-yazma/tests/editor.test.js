import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
const source = await readFile(new URL('../extension/editor.js', import.meta.url), 'utf8');
function fixture({note = false} = {}) {
  const window = new Window({url: 'https://my.livechatinc.com/chats/DEMO01'});
  window.document.body.innerHTML = `<main data-chat-id="DEMO01"><div data-testid="chat-feed"><div data-testid="DEMO01001_1-reaction"></div></div><div id="composer"><div id="editor" data-testid="chat-feed-text-area-test-id" contenteditable="true" data-lexical-editor="true" role="textbox"></div><div><p>${note ? "Type an internal note, the customer won't see this message" : 'Type your message'}</p></div></div></main>`;
  window.HTMLElement.prototype.getClientRects = function () {return this.isConnected ? [{width: 500, height: 100}] : [];};
  window.document.execCommand = (command, _, text) => {if (command !== 'insertText') return false; const editor = window.document.getElementById('editor'); editor.textContent += text; editor.dispatchEvent(new window.InputEvent('input', {bubbles: true, inputType: 'insertText', data: text})); return true;};
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
