import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const content = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
const capture = await readFile(new URL('../extension/capture.js', import.meta.url), 'utf8');
class Element {
  constructor() {this.style = {}; this.dataset = {}; this.children = []; this.attributes = {}; this.hidden = false; this.value = '';}
  append(...children) {this.children.push(...children);}
  replaceChildren(...children) {this.children = children;}
  setAttribute(name, value) {this.attributes[name] = value;}
  focus() {this.focused = true;}
  querySelector() {return null;}
}
async function fixture({storage = new Map(), pending = false} = {}) {
  const nodes = new Map(), calls = [], timers = new Map(), events = new Map();
  let now = 0, nextId = 1, finish;
  const shadow = {set innerHTML(html) {for (const match of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(match[1], new Element());}, getElementById: id => nodes.get(id), querySelectorAll: () => [], addEventListener: (name, callback) => events.set(name, callback)};
  const host = new Element(); host.attachShadow = () => shadow;
  let hostCreated = false;
  const nativeSearch = {text: 'Search Ctrl K', hidden: false}, editor = {text: 'Gönderilmemiş mevcut yanıt', editable: true};
  const view = {found: true, conversationId: 'customer-one', messages: [{id: 'u1', role: 'user', text: 'Kuponumun sonucu yanlış görünüyor.'}]};
  let learning = {enabled: true, epoch: 0, count: 0};
  const setTimeout = (callback, delay) => {const id = nextId++; timers.set(id, {callback, at: now + delay}); return id;};
  const context = vm.createContext({
    document: {hidden: false, body: {}, getElementById: () => null, createElement: () => {if (!hostCreated) {hostCreated = true; return host;} return new Element();}, createTextNode: text => text, documentElement: {append() {}}, addEventListener() {}},
    MutationObserver: class {constructor(callback) {events.set('mutation', callback);} observe() {}},
    sessionStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
    location: {pathname: '/chats/customer-one'}, navigator: {}, setTimeout, clearTimeout: id => timers.delete(id), setInterval() {},
    HizirDock: {Dock: class {update() {}}}, HizirReader: {read: () => view, readAll: () => [view]},
    chrome: {runtime: {getURL: path => path, sendMessage: async message => {
      calls.push(message);
      if (message.type === 'status') return {ok: true, data: {count: 10, revision: 0, aiEnabled: true, autoSync: false, learning}};
      if (message.type === 'observeLearning') {learning = {...learning, count: learning.count + message.records.length}; return {ok: true, data: {learning}};}
      if (message.type === 'setLearning') {learning = {...learning, enabled: message.enabled, epoch: learning.epoch + 1}; return {ok: true, data: learning};}
      if (message.type === 'suggest') {
        const result = {ok: true, data: {mode: 'ai', items: [1, 2, 3].map(i => ({text: `Üye talebine uygun tamamlanmış yanıt ${i}.`, guarded: false}))}};
        if (pending) return new Promise(resolve => {finish = () => {pending = false; resolve(result);};});
        return result;
      }
      return {ok: true, data: {}};
    }}}
  });
  vm.runInContext(capture, context); vm.runInContext(content, context);
  const flush = async () => {for (let i = 0; i < 15; i++) await Promise.resolve();};
  const tick = async ms => {
    const end = now + ms; await flush();
    for (;;) {
      const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at; timers.delete(due[0]); due[1].callback(); await flush();
    }
    now = end; await flush();
  };
  await flush();
  return {nodes, calls, editor, nativeSearch, view, storage, tick, flush, events, finish: () => finish(), mutate: () => events.get('mutation')([{target: {nodeType: 1, closest: () => ({})}, addedNodes: []}])};
}
test('closing cancels only suggestions; member/representative capture and the editor continue', async () => {
  const f = await fixture({pending: true}); await f.tick(650);
  assert.equal(f.calls.filter(m => m.type === 'suggest').length, 1);
  f.nodes.get('close').onclick();
  assert.equal(f.nodes.get('panel').hidden, true);
  assert.equal(f.nodes.get('launcher').attributes['aria-expanded'], 'false');
  assert.ok(f.calls.some(m => m.type === 'cancel'));
  assert.equal(f.calls.filter(m => m.type === 'setLearning').length, 0);
  f.view.messages.push({id: 'a1', role: 'agent', text: 'Yaşadığınız sorunu birlikte netleştirelim. Hangi sonucu bekliyordunuz?'});
  f.mutate(); await f.tick(650);
  const record = f.calls.find(m => m.type === 'observeLearning').records[0];
  assert.ok(record.context.some(m => m.role === 'user'));
  assert.equal(record.response, f.view.messages.at(-1).text);
  f.finish(); await f.flush();
  assert.equal(f.nodes.get('cards').children.length, 0);
  assert.equal(f.calls.filter(m => m.type === 'suggest').length, 1);
  assert.equal(f.editor.text, 'Gönderilmemiş mevcut yanıt'); assert.equal(f.editor.editable, true);
  assert.equal(f.nativeSearch.text, 'Search Ctrl K'); assert.equal(f.nativeSearch.hidden, false);
  f.nodes.get('dockLearning').onclick(); await f.flush();
  assert.equal(f.calls.find(m => m.type === 'setLearning').enabled, false);
  assert.equal(f.nodes.get('panel').hidden, true);
});
test('closed state survives refresh and opening prepares suggestions for the current member message', async () => {
  const storage = new Map([['hizir.assistant.panel.open', 'false']]);
  const f = await fixture({storage}); await f.tick(1000);
  assert.equal(f.nodes.get('panel').hidden, true);
  assert.equal(f.calls.filter(m => m.type === 'suggest').length, 0);
  f.nodes.get('launcher').onclick(); await f.tick(650);
  assert.equal(f.nodes.get('panel').hidden, false);
  assert.equal(f.nodes.get('cards').children.length, 3);
  assert.equal(f.calls.filter(m => m.type === 'suggest').length, 1);
  assert.equal(storage.get('hizir.assistant.panel.open'), 'true');
});
test('Escape closes only the assistant and native Ctrl+K can still reach LiveChat', async () => {
  const f = await fixture(); let stopped = 0, prevented = 0;
  const handle = f.events.get('keydown');
  handle({key: 'k', ctrlKey: true, preventDefault() {prevented++;}, stopPropagation() {stopped++;}});
  assert.equal(stopped, 0); assert.equal(prevented, 0);
  handle({key: 'Escape', preventDefault() {prevented++;}, stopPropagation() {stopped++;}});
  assert.equal(f.nodes.get('panel').hidden, true);
  assert.equal(stopped, 1); assert.equal(prevented, 1);
  assert.equal(f.nativeSearch.hidden, false); assert.equal(f.editor.editable, true);
});
