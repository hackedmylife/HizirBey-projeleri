import test from 'node:test';
import assert from 'node:assert/strict';
import {ProviderPool, normalizeSettings, mergeSettings, publicSettings, buildRequest, verifyPaidKey} from '../extension/providers.js';
const config = () => normalizeSettings({aiEnabled: true, providers: {groq: {enabled: true, apiKey: 'test-groq'}, gemini: {enabled: true, apiKey: 'test-gemini'}, openrouter: {enabled: true, apiKey: 'test-router'}}});
const success = value => ({ok: true, json: async () => ({choices: [{message: {content: JSON.stringify(value)}}], usage: {total_tokens: 100}})});
test('legacy credentials migrate without exposing key values or deleting untouched providers', () => {
  const legacy = {apiKey:'test-legacy', model:'openai/gpt-oss-120b', aiEnabled:true};
  assert.equal(normalizeSettings(legacy).providers.groq.apiKey,'test-legacy');
  const saved = mergeSettings({...legacy, providers: {...normalizeSettings(legacy).providers, gemini:{apiKey:'test-second', enabled:true, model:'gemini-2.5-flash-lite'}}}, {providers:{groq:{apiKey:'',model:'openai/gpt-oss-20b'}},autoSync:true});
  assert.equal(saved.providers.groq.apiKey,'test-legacy');
  assert.equal(saved.providers.gemini.apiKey,'test-second');
  assert.equal(publicSettings(saved).providers.gemini.apiKey,undefined);
  assert.equal(publicSettings(saved).providers.gemini.hasKey,true);
  assert.equal(mergeSettings(saved,{providers:{gemini:{clearKey:true}}}).providers.gemini.apiKey,undefined);
});
test('fixed endpoints keep keys in headers and never allow paid routing implicitly', () => {
  const c = config();
  for (const id of ['groq','gemini','openrouter']) {
    const request=buildRequest(id,c.providers[id],'style',{conversation:[]},1800);
    assert.ok(!request.url.includes(c.providers[id].apiKey));
    assert.ok(!JSON.stringify(request.body).includes(c.providers[id].apiKey));
  }
  assert.throws(()=>mergeSettings(c,{providers:{openrouter:{model:'company/paid',enabled:true}}}),/Ücretli/);
  assert.throws(()=>mergeSettings(c,{providers:{gemini:{model:'https://example.org'}}}),/model/);
});
test('429 immediately switches to Gemini with the same payload, then skips cooling Groq', async () => {
  let now=100000, calls=[];
  const pool=new ProviderPool({now:()=>now,fetcher:async(url,opts)=>{
    calls.push({url,body:JSON.parse(opts.body)});
    if(url.includes('groq'))return {ok:false,status:429,headers:{get:n=>n==='retry-after'?'20':null},json:async()=>({})};
    return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}],usageMetadata:{totalTokenCount:100}})};
  }});
  const input={conversation:[{role:'user',text:'Yardım istiyorum'}]};
  const first=await pool.run({settings:config(),system:'instructions',input,maxTokens:200});
  assert.equal(first.provider,'gemini'); assert.equal(first.switched,true); assert.equal(calls.length,2);
  assert.deepEqual(JSON.parse(calls[1].body.contents[0].parts[0].text),input);
  now+=4000;
  assert.equal((await pool.run({settings:config(),system:'instructions',input,maxTokens:200})).provider,'gemini');
  assert.equal(calls.length,3);
  const restored=new ProviderPool({now:()=>now}); restored.restore(pool.snapshot());
  assert.equal(restored.controls.groq.waitMs(),17000);
});
test('bad shape and missing Gemini reply advance to OpenRouter',async()=>{
  const calls=[];
  const pool=new ProviderPool({fetcher:async url=>{calls.push(url);return url.includes('groq')?success({bad:true}):url.includes('googleapis')?{ok:true,json:async()=>({candidates:[]})}:success({ok:true});}});
  const result=await pool.run({settings:config(),system:'s',input:{},maxTokens:200,validate:value=>{if(value.ok!==true)throw new Error('invalid');return value;}});
  assert.equal(result.provider,'openrouter'); assert.equal(calls.length,3);
});
test('timeout switches providers and parent cancellation stops the entire chain',async()=>{
  let calls=0;
  const pool=new ProviderPool({timeout:5,fetcher:(url,opts)=>{calls++;if(url.includes('groq'))return new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError'))));return Promise.resolve({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]})});}});
  assert.equal((await pool.run({settings:config(),system:'s',input:{},maxTokens:200})).provider,'gemini');
  const cancelled=new AbortController();cancelled.abort();
  await assert.rejects(pool.run({settings:config(),system:'s',input:{},signal:cancelled.signal}),{name:'AbortError'});
  assert.equal(calls,2);
});
test('all exhausted providers return bounded waiting and never re-fetch during cooldown',async()=>{
  let calls=0;
  const pool=new ProviderPool({now:()=>100000,fetcher:async()=>{calls++;return {ok:false,status:429,json:async()=>({})};}});
  const first=await pool.run({settings:config(),system:'s',input:{},maxTokens:200});
  assert.equal(first.ok,false);assert.equal(first.retryAfterMs,60000);assert.equal(calls,3);
  await pool.run({settings:config(),system:'s',input:{},maxTokens:200});assert.equal(calls,3);
});
test('paid model requires a service-enforced monthly key cap on each use',async()=>{
  const c=config().providers.openrouter;
  const response=data=>async()=>({ok:true,json:async()=>({data})});
  await assert.rejects(verifyPaidKey(c,5,undefined,response({limit:null,limit_remaining:100,limit_reset:'monthly'})),/aylık/);
  await assert.rejects(verifyPaidKey(c,5,undefined,response({limit:10,limit_remaining:8,limit_reset:'monthly'})),/aylık/);
  await assert.rejects(verifyPaidKey(c,5,undefined,response({limit:5,limit_remaining:5,limit_reset:null})),/aylık/);
  await verifyPaidKey(c,5,undefined,response({limit:5,limit_remaining:4,limit_reset:'monthly'}));
});
