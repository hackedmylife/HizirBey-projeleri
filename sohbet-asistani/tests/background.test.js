import test, {mock} from 'node:test';
mock.timers.enable({apis: ['setTimeout']});
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
  await send({type:'saveSettings',settings:{aiEnabled:true,useFastKeys:true,model:'openai/gpt-oss-20b',apiKey:'test-only'}});
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
const learningContext=[{role:'user',text:'Kuponumun sonucu yanlış görünüyor.'}];
const humanReply='Yaşadığınız kupon sorununu birlikte netleştirelim. Sonuçta hangi farklılığı gördüğünüzü paylaşabilir misiniz?';
const observe=async(text=humanReply,sender=live,conversationId='learning-one',epoch)=>send({type:'observeLearning',records:[{context:learningContext,response:text}],epoch:epoch??(await send({type:'status'},sender)).data.learning.epoch,conversationId},sender);
test('automatic learning applies to all LiveChat tabs, deduplicates and persists sanitized examples',async()=>{
  await send({type:'clearLearning'});
  const one=await observe();assert.equal(one.data.added,1);
  assert.equal((await observe()).data.added,0);
  const two=await observe('Kupon bilgisini paylaşmanız durumunda işlemin hangi aşamasında sorun yaşadığınızı birlikte netleştirebiliriz.',{...live,tab:{id:2}},'learning-two');
  assert.equal(two.data.learning.count,2);
  const memory=(await send({type:'getLearning'})).data.examples;
  assert.equal(memory.length,2);assert.ok(memory.every(e=>e.origin==='automatic'));
  assert.equal((await send({type:'getLearning'},live)).ok,false);
});
test('global pause rejects capture from other tabs and stale requests after resume',async()=>{
  const before=(await send({type:'status'},live)).data.learning;
  const paused=(await send({type:'setLearning',enabled:false},live)).data;
  assert.equal(paused.enabled,false);assert.ok(paused.epoch>before.epoch);
  const blocked=await observe('Farklı bir yanıtla durumu birlikte değerlendirebiliriz. Ayrıntıları paylaşır mısınız?',{...live,tab:{id:2}},'paused',before.epoch);
  assert.equal(blocked.data.added,0);assert.equal(blocked.data.learning.count,before.count);
  const resumed=(await send({type:'setLearning',enabled:true},live)).data;
  const stale=await observe('Yeni bir örnek hazırlamak için ayrıntıları paylaşabilir misiniz?',{...live,tab:{id:2}},'paused',before.epoch);
  assert.equal(stale.data.resetBaseline,true);assert.equal(stale.data.added,0);
  assert.equal((await observe('Sorunu adım adım değerlendirebilmek için gördüğünüz sonucu açıklayabilir misiniz?',live,'resumed',resumed.epoch)).data.added,1);
});
test('unchanged AI suggestions never feed themselves back into automatic learning',async()=>{
  clock+=60000;globalThis.fetch=async()=>response(generated());
  const p={...payload,conversationId:'self-feedback'};
  const result=await send(p,live);
  assert.equal(result.data.mode,'ai');
  const epoch=(await send({type:'status'},live)).data.learning.epoch;
  const captured=await send({type:'observeLearning',epoch,conversationId:p.conversationId,records:[{context:p.messages,response:result.data.items[0].text}]},live);
  assert.equal(captured.data.added,0);
});
test('manual correction and rejection influence the next generation but never become company sources',async()=>{
  const correction='Kupon talebinizi adım adım netleştirelim. Sonuçta hangi farklılığı gördüğünüzü açıklayabilir misiniz?';
  const taught=await send({type:'teachReply',messages:learningContext,text:correction,origin:'correction'},live);
  assert.equal(taught.ok,true);assert.equal(taught.data.learning.corrected,1);
  await send({type:'rejectReply',messages:learningContext,text:humanReply},live);
  clock+=60000;let input;
  globalThis.fetch=async(_,opts)=>{input=JSON.parse(JSON.parse(opts.body).messages[1].content);return response(generated());};
  await send({...payload,conversationId:'learned-generation',messages:learningContext},live);
  assert.ok(input.examples.some(e=>e.origin==='correction'&&e.response===correction));
  const learned=input.examples.find(e=>e.origin==='correction');
  assert.equal(learned.request,learningContext[0].text);
  assert.ok(learned.context.some(m=>m.role==='user'&&m.text===learningContext[0].text));
  assert.equal(input.unwantedExamples.length,1);
  assert.ok(!input.sources.some(s=>s.text===correction));
});
test('deleted samples cannot be recaptured and learned examples can be disabled independently',async()=>{
  const rows=(await send({type:'getLearning'})).data.examples;
  const sample=rows.find(e=>e.origin==='automatic');
  assert.ok(sample);
  await send({type:'deleteExample',id:sample.id});
  const captured=await send({type:'observeLearning',epoch:(await send({type:'status'},live)).data.learning.epoch,conversationId:'deleted',records:[{context:sample.context,response:sample.response}]},live);
  assert.equal(captured.data.added,0);
  await send({type:'saveSettings',settings:{useExamples:false}});
  clock+=60000;let input;
  globalThis.fetch=async(_,opts)=>{input=JSON.parse(JSON.parse(opts.body).messages[1].content);return response(generated());};
  await send({...payload,conversationId:'examples-disabled',messages:learningContext},live);
  assert.deepEqual(input.examples,[]);assert.deepEqual(input.unwantedExamples,[]);
  assert.equal((await send({type:'status'},live)).data.learning.enabled,true);
  await send({type:'saveSettings',settings:{useExamples:true}});
});
test('pausing collection does not cancel an in-flight customer reply',async()=>{
  clock+=60000;let started,finish,signal;
  const ready=new Promise(resolve=>{started=resolve;});
  globalThis.fetch=async(_,opts)=>{signal=opts.signal;started();return new Promise(resolve=>{finish=resolve;});};
  const pendingReply=send({...payload,conversationId:'pause-during-reply'},live);await ready;
  await send({type:'setLearning',enabled:false},live);
  assert.equal(signal.aborted,false);finish(response(generated()));
  assert.equal((await pendingReply).data.mode,'ai');
});
test('clearing learned samples preserves provider keys and FastKeys catalog',async()=>{
  const key=data.settings.providers.groq.apiKey,catalog=data.catalog;
  const cleared=await send({type:'clearLearning'});
  assert.equal(cleared.data.learning.count,0);assert.equal(cleared.data.learning.rejected,0);
  assert.equal(data.settings.providers.groq.apiKey,key);assert.equal(data.catalog,catalog);
});
test('learning-only mode sends no FastKeys source and makes no catalog analysis request',async()=>{
  const key=data.settings.providers.groq.apiKey;
  await send({type:'saveSettings',settings:{useFastKeys:false}});
  await send({type:'import',text:'1•sms*•SMS bonusu•Send•♥SMS bonusu yalnızca bir kere alınabilir.•2•\n∟'});
  clock+=60000;let calls=0,input;
  const texts=['SMS bonusu talebinizi anlıyorum. İsteğiniz üzerinden birlikte ilerleyebiliriz.','SMS bonusuyla ilgili talebiniz açık. İhtiyacınız olan desteği birlikte değerlendirebiliriz.','SMS bonusu isteğinizi anlıyorum. Talebiniz doğrultusunda size yardımcı olmak isterim.'];
  globalThis.fetch=async(_,opts)=>{calls++;input=JSON.parse(JSON.parse(opts.body).messages[1].content);return response({replies:texts.map((text,i)=>({style:['concise','balanced','empathetic'][i],text,sourceIds:[],requiresVerification:false}))});};
  await background.prepareOne();assert.equal(calls,0);
  const result=await send({...payload,conversationId:'learning-only',messages:[{role:'user',text:'İkinci SMS bonusu istiyorum.'}]},live);
  assert.equal(result.data.mode,'ai');assert.deepEqual(input.sources,[]);assert.equal(input.sourceMode,'learned_examples_only');
  assert.equal(calls,1);assert.equal(data.settings.providers.groq.apiKey,key);assert.equal(data.catalog.templates.length,1);
});
test('credential failure identifies the connection and gives topical closure replies',async()=>{
  await send({type:'saveSettings',settings:{providers:{gemini:{enabled:false},openrouter:{enabled:false}}}});
  clock+=60000;globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({})});
  const result=await send({...payload,conversationId:'closure-no-api',messages:[{role:'user',text:'Hesabımı kapatın.'}]},live);
  assert.equal(result.data.mode,'prepared');assert.ok(result.data.items.every(e=>/kapat/.test(e.text)));
  assert.match(result.data.notice,/Groq: API anahtarını kontrol et/);assert.ok(!result.data.notice.includes('test-only'));
});
test('backup endpoints require options and merging preserves credentials, archive and collection preference',async()=>{
  await send({type:'teachReply',messages:learningContext,text:humanReply,origin:'correction'},live);
  assert.equal((await send({type:'exportLearning'},live)).ok,false);
  assert.equal((await send({type:'importLearning',text:'{}'},live)).ok,false);
  const exported=(await send({type:'exportLearning'})).data;
  const text=JSON.stringify(exported.backup),before=data.learningMemory;
  assert.ok(!text.includes('test-only'));assert.equal(exported.learning.count,1);
  const broken=structuredClone(exported.backup);broken.memory.examples[0].context[0].role='system';
  assert.equal((await send({type:'importLearning',text:JSON.stringify(broken)})).ok,false);assert.equal(data.learningMemory,before);
  const savedSettings=data.settings,savedCatalog=data.catalog;
  const result=await send({type:'importLearning',text});assert.equal(result.ok,true);assert.equal(result.data.added,0);assert.equal(result.data.learning.count,1);
  assert.equal(data.settings,savedSettings);assert.equal(data.catalog,savedCatalog);assert.equal(result.data.learning.enabled,false);
});
test('a saved legacy 1000-example profile retains its data and can capture the next example',async()=>{
  const base=data.learningMemory.examples[0],examples=Array.from({length:1000},(_,i)=>({...base,id:i.toString(16).padStart(64,'0'),origin:'automatic'}));
  await chrome.storage.local.set({learningMemory:{version:1,examples,rejected:[],blocked:[],updatedAt:clock}});
  await send({type:'setLearning',enabled:true},live);
  const keys=JSON.stringify(data.settings.providers),archive=data.catalog;
  const state=(await send({type:'status'},live)).data.learning;
  assert.equal(state.count,1000);assert.equal(state.maxBytes,10000000);assert.equal(state.maxExamples,20000);
  const result=await observe('Kupon sonucundaki farkı birlikte değerlendirelim. Beklediğiniz sonucu açıklayabilir misiniz?',live,'after-capacity-update',state.epoch);
  assert.equal(result.data.learning.count,1001);assert.equal(result.data.added,1);
  assert.ok(examples.every(e=>data.learningMemory.examples.some(row=>row.id===e.id)));
  assert.equal(JSON.stringify(data.settings.providers),keys);assert.equal(data.catalog,archive);
});
