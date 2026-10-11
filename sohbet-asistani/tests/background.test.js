import test from 'node:test';
import assert from 'node:assert/strict';
const data = {};
const session = {};
let clock = Date.now();
Date.now = () => clock;
let listener, onChanged;
globalThis.chrome = {
  storage: {session: {get: async key => ({[key]: session[key]}), set: async value => {Object.assign(session, value);}}, local: {setAccessLevel: async () => {}, get: async (key) => ({[key]:data[key]}), set: async (value) => {Object.assign(data,value); onChanged?.(Object.fromEntries(Object.entries(value).map(([k,v])=>[k,{newValue:v}])));}, remove: async key => {delete data[key];}}, onChanged: {addListener: fn => {onChanged=fn;}}},
  action: {onClicked:{addListener:()=>{}}},
  runtime: {id:'a'.repeat(32), getURL:p=>`chrome-extension://${'a'.repeat(32)}/${p}`, openOptionsPage:async()=>{}, onMessage:{addListener:fn=>{listener=fn;}}}
};
await import('../extension/background.js');
const options={id:chrome.runtime.id,url:chrome.runtime.getURL('options.html')};
const live={id:chrome.runtime.id,url:'https://my.livechatinc.com/chats/example/thread',frameId:0,tab:{id:1}};
const send=(m,s=options)=>new Promise(resolve=>{const accepted=listener(m,s,resolve);if(!accepted)resolve(null);});
test('untrusted origins cannot reach the message handler or stored API key',async()=>{
  assert.equal(await send({type:'getSettings'},{url:'https://example.org'}),null);
  assert.equal((await send({type:'getSettings'},live)).ok,false);
});
test('AI returns exact catalog text and discards invented IDs',async()=>{
  await send({type:'import',name:'test.fdb',text:'1•kupon*•Spor kupon numarası•Send•♥Spor bahsi kupon numarasını iletir misiniz?•2•\n∟'});
  await send({type:'saveSettings',settings:{aiEnabled:true,model:'openai/gpt-oss-20b',apiKey:'test-only'}});
  let sent;
  globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:'{"ids":["invented","t0"],"notice":"Kupon bilgisi gerekli."}'}}]})};};
  const result=await send({type:'suggest',messages:[{role:'user',text:'Spor kuponumda sorun var'}]},live);
  assert.equal(result.ok,true);assert.equal(result.data.items.length,1);
  assert.equal(result.data.items[0].text,'Spor bahsi kupon numarasını iletir misiniz?');
  assert.equal(sent.messages.length,2);
  assert.equal((await send({type:'status'},live)).data.apiKey,undefined);
});
test('failed import preserves the prior catalog',async()=>{
  const before=data.catalog;
  assert.equal((await send({type:'import',text:'bad file'})).ok,false);
  assert.equal(data.catalog,before);
});
test('repeat review uses cache without another API call and system messages do not invalidate it', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('should not fetch cached result'); };
  const payload = {type: 'suggest', messages: [{role: 'user', text: 'Spor kuponumda sorun var'}]};
  assert.equal((await send(payload, live)).data.cached, true);
  assert.equal((await send({...payload, messages: [...payload.messages, {role: 'system', text: 'Changed timer'}]}, live)).data.cached, true);
  assert.equal(calls, 0);
});
test('429 falls back automatically and blocks retries from all tabs until retry-after', async () => {
  clock += 8000;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return {ok: false, status: 429, headers: {get: name => name === 'retry-after' ? '20' : null}}; };
  const payload = {type: 'suggest', messages: [{role: 'user', text: 'Spor kuponumda yeni sorun var'}]};
  const first = await send(payload, live);
  assert.equal(first.ok, true);
  assert.equal(first.data.mode, 'local');
  assert.equal(first.data.items[0].id, 't0');
  assert.match(first.data.notice, /HTTP 429/);
  assert.equal(first.data.retryAfterMs, 21000);
  await send(payload, live);
  await send(payload, {...live, tab: {id: 2}});
  assert.equal(calls, 1);
  assert.equal(session.aiRate.cooldownAt, clock + 21000);
  clock += 21000;
  globalThis.fetch = async () => { calls++; return {ok: true, json: async () => ({choices: [{message: {content: '{"ids":["t0"]}'}}]})}; };
  assert.equal((await send(payload, live)).data.mode, 'ai');
  assert.equal(calls, 2);
});
test('authentication failure is not mislabeled as quota exhaustion and retains local candidates', async () => {
  clock += 8000;
  globalThis.fetch = async () => ({ok: false, status: 401});
  const result = await send({type: 'suggest', messages: [{role: 'user', text: 'Spor kupon numarası için yardım'}]}, live);
  assert.equal(result.ok, true);
  assert.equal(result.data.mode, 'local');
  assert.match(result.data.notice, /HTTP 401/);
  assert.doesNotMatch(result.data.notice, /sınır/);
  assert.equal(result.data.items.length, 1);
});
test('simultaneous identical requests share a single fetch', async () => {
  clock += 8000;
  let calls = 0, finish, started;
  const ready = new Promise(resolve => { started = resolve; });
  globalThis.fetch = async () => { calls++; started(); return new Promise(resolve => { finish = resolve; }); };
  const payload = {type: 'suggest', messages: [{role: 'user', text: 'Spor kuponum düzeltildi mi'}]};
  const first = send(payload, live);
  await ready;
  const second = send(payload, live);
  finish({ok: true, json: async () => ({choices: [{message: {content: '{"ids":["t0"]}'}}]})});
  const results = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.ok(results.every(result => result.ok && result.data.items[0].id === 't0'));
});
test('SMS policy matching uses the imported catalog without AI and marks previous-use text for confirmation', async () => {
  const lines = [
    '1•return*•Geri dönüş bonusu•Send•♥Geri dönüş bonusu için SMS doğrulamanızı açınız.•2•',
    '1•policy*•SMS bonusu koşulları•Send•♥SMS Aktif Bonusumuzdan yalnızca 1 (bir) kere yararlanılabilir.•2•',
    '1•repeat*•SMS bonusu tekrar•Send•♥SMS aktif bonusu daha önce almış olduğunuzu görmekteyim, bonus yalnızca 1 defa alınabilmektedir.•2•'
  ];
  await send({type: 'import', text: lines.join('\n') + '\n∟'});
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('SMS policy must not need a remote call'); };
  const second = await send({type: 'suggest', messages: [{role: 'user', text: '2. sms bonusu alabilir miyim?'}, {role: 'user', text: 'kullanıcı adım test'}, {role: 'user', text: 'merhaba'}]}, live);
  assert.equal(second.ok, true);
  assert.deepEqual(second.data.items.map(t => t.shortcut), ['repeat*', 'policy*']);
  assert.equal(second.data.items[0].guarded, true);
  const first = await send({type: 'suggest', messages: [{role: 'user', text: 'sms doğrulama bonusu istiyorum'}]}, live);
  assert.deepEqual(first.data.items.map(t => t.shortcut), ['policy*']);
  assert.equal(first.data.items[0].text, data.catalog.templates[1].text);
  assert.equal(calls, 0);
});
