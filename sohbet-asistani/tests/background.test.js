import test from 'node:test';
import assert from 'node:assert/strict';
const data={}, session={};
let clock=1000000, listener, onChanged;
Date.now=()=>clock;
const get=async(store,keys)=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,store[key]]));
globalThis.chrome={
  storage:{session:{get:keys=>get(session,keys),set:async value=>Object.assign(session,value)},local:{setAccessLevel:async()=>{},get:keys=>get(data,keys),set:async value=>{const changes=Object.fromEntries(Object.entries(value).map(([key,newValue])=>[key,{oldValue:data[key],newValue}]));Object.assign(data,value);onChanged?.(changes,'local');},remove:async key=>{delete data[key];}},onChanged:{addListener:fn=>{onChanged=fn;}}},
  action:{onClicked:{addListener:()=>{}}},runtime:{id:'a'.repeat(32),getURL:p=>`chrome-extension://${'a'.repeat(32)}/${p}`,openOptionsPage:async()=>{},onMessage:{addListener:fn=>{listener=fn;}}}
};
const background=await import('../extension/background.js');
const options={id:chrome.runtime.id,url:chrome.runtime.getURL('options.html')};
const live={id:chrome.runtime.id,url:'https://my.livechatinc.com/chats/example/thread',frameId:0,tab:{id:1}};
const send=(m,s=options)=>new Promise(resolve=>{const accepted=listener(m,s,resolve);if(!accepted)resolve(null);});
const response=text=>({ok:true,json:async()=>({usage:{total_tokens:100},choices:[{message:{content:JSON.stringify(text)}}]})});
const generated=()=>({replies:[{style:'concise',text:'Kupon numarasını paylaşır mısınız? Böylece hangi işlemde sorun yaşadığınızı netleştirebiliriz.',sourceIds:[],requiresVerification:false},{style:'balanced',text:'Yaşadığınız kupon sorununu netleştirelim. İlgili işlem bilgisini paylaşabilir misiniz?',sourceIds:[],requiresVerification:false},{style:'empathetic',text:'Yaşadığınız durumun sizin için önemini anlıyorum. İlgili kupon bilgisini paylaşırsanız somut işlem üzerinden ilerleyebiliriz.',sourceIds:[],requiresVerification:false}]});
const payload={type:'suggest',messages:[{role:'user',text:'Spor kuponumda sorun var'}],conversationId:'first'};
test('untrusted origins cannot reach credentials and options return only key presence',async()=>{
  assert.equal(await send({type:'getSettings'},{url:'https://example.org'}),null);
  assert.equal((await send({type:'getSettings'},live)).ok,false);
});
test('legacy key works for generated replies; no template-ID-only selection or blank matching gate',async()=>{
  await send({type:'import',name:'test.fdb',text:'1•kupon*•Kupon bilgisi•Send•♥Spor kupon numarasını iletir misiniz?•2•\n∟'});
  await send({type:'saveSettings',settings:{aiEnabled:true,model:'openai/gpt-oss-20b',apiKey:'test-only'}});
  let sent;
  globalThis.fetch=async(_,opts)=>{sent=JSON.parse(opts.body);return response(generated());};
  const result=await send(payload,live);
  assert.equal(result.ok,true);assert.equal(result.data.items.length,3);assert.equal(result.data.mode,'ai');
  assert.notEqual(result.data.items[0].text,data.catalog.templates[0].text);
  assert.match(sent.messages[0].content,/üç profesyonel/);
  assert.equal((await send({type:'getSettings'})).data.settings.providers.groq.apiKey,undefined);
  assert.equal((await send({type:'getSettings'})).data.settings.providers.groq.hasKey,true);
});
test('identical conversations use cache and system events do not invalidate the result',async()=>{
  let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('unexpected');};
  assert.equal((await send(payload,live)).data.cached,true);
  assert.equal((await send({...payload,messages:[...payload.messages,{role:'system',text:'timer'}]},live)).data.cached,true);
  assert.equal(calls,0);
});
test('failed import preserves the prior catalog and knowledge; manual search returns original text',async()=>{
  const before=data.catalog,k=data.knowledge;
  assert.equal((await send({type:'import',text:'not a file'})).ok,false);
  assert.equal(data.catalog,before);assert.equal(data.knowledge,k);
  const result=await send({...payload,query:'kupon'},live);
  assert.equal(result.data.mode,'search');assert.equal(result.data.items[0].text,before.templates[0].text);
});
test('missing matching sources still calls AI and produces complete original replies',async()=>{
  clock+=60000;let calls=0;
  const value=generated();value.replies[0].text='İsteğinizi değerlendirebilmem için hangi konuda desteğe ihtiyaç duyduğunuzu paylaşır mısınız?';
  globalThis.fetch=async(_,opts)=>{calls++;const input=JSON.parse(JSON.parse(opts.body).messages[1].content);assert.equal(input.sources.length,0);return response(value);};
  const result=await send({...payload,conversationId:'new',messages:[{role:'user',text:'Bambaşka bir konu hakkında konuşmak istiyorum'}]},live);
  assert.equal(result.data.items.length,3);assert.equal(result.data.mode,'ai');assert.equal(calls,1);
});
test('429 switches to Gemini without displaying an intermediate quota error',async()=>{
  clock+=60000;
  await send({type:'saveSettings',settings:{providers:{gemini:{enabled:true,apiKey:'test-gemini',model:'gemini-2.5-flash-lite'}}}});
  let calls=0;
  globalThis.fetch=async url=>{calls++;return url.includes('groq')?{ok:false,status:429,headers:{get:n=>n==='retry-after'?'20':null},json:async()=>({})}:{ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(generated())}]}}],usageMetadata:{totalTokenCount:100}})};};
  const result=await send({...payload,conversationId:'fallback'},live);
  assert.equal(result.data.mode,'ai');assert.equal(result.data.provider,'Gemini');assert.equal(calls,2);assert.doesNotMatch(result.data.notice,/limit|sınır|429/);
  assert.equal(session.providerRate.groq.cooldownAt,clock+21000);
});
test('all providers exhausted keep three clearly labeled prepared replies',async()=>{
  clock+=60000;globalThis.fetch=async()=>({ok:false,status:429,json:async()=>({})});
  const result=await send({...payload,conversationId:'exhausted'},live);
  assert.equal(result.data.mode,'prepared');assert.equal(result.data.items.length,3);assert.ok(result.data.retryAfterMs>0);
  assert.ok(result.data.items.every(t=>t.kind==='prepared'));
});
test('simultaneous identical requests share one generation request',async()=>{
  clock+=60000;let calls=0,finish,started;
  const ready=new Promise(resolve=>{started=resolve;});
  globalThis.fetch=async()=>{calls++;started();return new Promise(resolve=>{finish=resolve;});};
  const p={...payload,conversationId:'parallel'};
  const first=send(p,live);await ready;const second=send(p,live);finish(response(generated()));
  assert.ok((await Promise.all([first,second])).every(r=>r.ok&&r.data.items.length===3));assert.equal(calls,1);
});
test('new conversation cancels old request before fallback and stale result cannot cache',async()=>{
  clock+=60000;let started;
  const ready=new Promise(resolve=>{started=resolve;});
  globalThis.fetch=async(_,opts)=>{started();return new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('abort','AbortError'))));};
  const old=send({...payload,conversationId:'old-cancel'},live);await ready;
  await send({type:'cancel'},live);assert.equal((await old).ok,false);
});
test('background archive analysis persists completion and does not reread an unchanged import',async()=>{
  clock+=60000;
  const source='1•policy*•SMS bonusu•Send•♥SMS aktif bonusumuzdan yalnızca 1 kere yararlanılabilir.•2•\n∟';
  await send({type:'import',name:'test.fdb',text:source});
  let calls=0;
  globalThis.fetch=async(_,opts)=>{calls++;const input=JSON.parse(JSON.parse(opts.body).messages[1].content);return response({entries:input.entries.map(t=>({id:t.id,summary:'SMS tek kullanım koşulu',topics:['sms_bonus'],keywords:['aktivasyon'],evidence:[t.text]}))});};
  await background.prepareOne();
  assert.equal(data.knowledge.entries[0].analysis.summary,'SMS tek kullanım koşulu');
  assert.equal((await send({type:'status'},live)).data.knowledge.done,1);
  clock+=60000;
  await send({type:'import',name:'test.fdb',text:source});await background.prepareOne();assert.equal(calls,1);
});
test('SMS second-use requests now produce three polite original replies with source policy',async()=>{
  clock+=60000;
  const texts=['SMS bonusundan yalnızca bir kez yararlanılabilir. Talebinizi bu koşula göre değerlendirebiliriz.','SMS bonusunun kullanım hakkı tek seferle sınırlıdır. Daha önce yararlandıysanız aynı bonus yeniden kullanılamaz.','Talebinizi anlıyorum. SMS bonusundan yalnızca bir kez yararlanılabildiği için uygunluğunuzun bu şart doğrultusunda değerlendirilmesi gerekir.'];
  globalThis.fetch=async()=>response({replies:texts.map((text,i)=>({style:['concise','balanced','empathetic'][i],text,sourceIds:['t0'],requiresVerification:false}))});
  const result=await send({...payload,conversationId:'sms',messages:[{role:'user',text:'İkinci kez SMS bonusu istiyorum'}]},live);
  assert.equal(result.data.mode,'ai');assert.equal(result.data.items.length,3);
  assert.ok(result.data.items.every(item=>/bir kez|tek sefer/.test(item.text)));
  assert.ok(result.data.items.every(item=>!item.text.includes('görmekteyim')));
});
test('replacing a catalog cancels in-flight analysis and cannot persist stale knowledge',async()=>{
  clock+=60000;
  await send({type:'import',text:'1•password*•Şifre•Send•♥Şifre yenileme için giriş ekranını kullanınız.•2•\n∟'});
  let started;
  const ready=new Promise(resolve=>{started=resolve;});
  globalThis.fetch=async(_,opts)=>{started();return new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('abort','AbortError'))));};
  const old=background.prepareOne();await ready;
  await send({type:'import',text:'1•new*•Yeni bilgi•Send•♥Yeni konu için yardım isteyebilirsiniz.•2•\n∟'});
  await assert.rejects(old,{name:'AbortError'});
  assert.equal(data.knowledge.entries[0].analysis,null);
  assert.equal(data.catalog.templates[0].shortcut,'new*');
});
