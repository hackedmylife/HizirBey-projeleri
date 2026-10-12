import test from 'node:test';
import assert from 'node:assert/strict';
import {supportIntent,requestContext} from '../extension/core.js';
import {composeInput,localReplies,validateReplies,STYLES} from '../extension/composer.js';
import {buildIndex} from '../extension/retrieval.js';
import {makeExample,emptyMemory,addExamples,selectExamples} from '../extension/learning.js';
import {normalizeSettings} from '../extension/providers.js';
const input = text => composeInput(buildIndex([]),undefined,[{role:'user',text}],{useFastKeys:false});
const generated = texts => ({replies:texts.map((text,i)=>({style:STYLES[i],text,sourceIds:[],requiresVerification:false}))});
test('closure, quitting and personal loss are distinct from coupon grading and account access',()=>{
  for(const text of ['Hesabımı kapatın.','Hesap kapatma istiyorum.','Üyeliğimi silin.','Kapatın artık bu hesabı.']) assert.equal(supportIntent(text),'close_account',text);
  for(const text of ['Bırakıyorum kumarı.','Kumarı bırakmak istiyorum.','Oynamak istemiyorum.']) assert.equal(supportIntent(text),'gambling_break',text);
  assert.equal(supportIntent('Sürekli kaybediyorum.'),'gambling_distress');
  for(const text of ['Hesabım kapandı, giriş yapamıyorum.','Hesabımı kapatmayın.','Hesabımdaki bonus silinmiş.','Kuponum kaybetti fakat sonuç yanlış.','Kayıp bonusu istiyorum.']) assert.equal(supportIntent(text),null,text);
});
test('closure replaces an earlier bonus and survives emotional or waiting follow-ups',()=>{
  const messages=['SMS bonusu istiyorum.','Hesabımı kapatın.','Sürekli kaybediyorum.','Lanet gelsin.','Bekliyorum.'].map(text=>({role:'user',text}));
  assert.match(requestContext(messages),/^Hesabımı kapatın/);
  assert.deepEqual(composeInput(buildIndex([]),undefined,messages,{useFastKeys:false}).intent,['close_account']);
  const long=[{role:'user',text:'Hesabımı kapatın.'},...Array.from({length:6},()=>({role:'user',text:'Bu durum beni çok üzüyor. '+ 'Ayrıntı. '.repeat(130)}))];
  assert.match(input(requestContext(long)).request,/Hesabımı kapatın/);
  const quitting=['Kumarı bırakıyorum.','Sürekli kaybediyorum.','Çok üzülüyorum.'].map(text=>({role:'user',text}));
  assert.match(requestContext(quitting),/^Kumarı bırakıyorum/);
  messages.push({role:'user',text:'Şifremi unuttum.'});assert.equal(requestContext(messages),'Şifremi unuttum.');
});
test('prepared support replies acknowledge the known problem and never offer retention bonuses',()=>{
  for(const text of ['Hesabımı kapatın.','Bırakıyorum kumarı.','Sürekli kaybediyorum.']) {
    const data=input(text),items=localReplies(data);
    assert.equal(items.length,3);assert.equal(validateReplies(generated(items.map(e=>e.text)),data).length,3);
    assert.ok(items.every(e=>!e.text.includes('hangi işlem veya konuda')));
    assert.ok(items.every(e=>!/bonus|promosyon|numarasını paylaş/i.test(e.text)));
  }
});
test('AI replies that ignore a closure request or redirect distress to bonuses fail validation',()=>{
  const generic=['Hangi konuda yardım istediğinizi paylaşır mısınız?','Talebinizi netleştirebilmem için biraz daha bilgi paylaşır mısınız?','Sorunun hangi adımda olduğunu açıklayabilir misiniz?'];
  assert.throws(()=>validateReplies(generated(generic),input('Hesabımı kapatın.')),/closure-ignored/);
  const unsafe=localReplies(input('Sürekli kaybediyorum.')).map(e=>e.text);unsafe[0]='Kayıplarınızı bonus ile telafi edebilirsiniz. Yeniden deneyelim.';
  assert.throws(()=>validateReplies(generated(unsafe),input('Sürekli kaybediyorum.')),/unsafe-retention/);
});
test('FastKeys is off by default and disabled sources cannot enter a generation payload',()=>{
  assert.equal(normalizeSettings({apiKey:'existing-test-key'}).useFastKeys,false);
  const index=buildIndex([{id:'t0',shortcut:'sms*',label:'SMS bonusu',text:'SMS bonusu yalnızca bir kere alınabilir.'}]);
  const disabled=composeInput(index,undefined,[{role:'user',text:'İkinci SMS bonusu istiyorum.'}],{useFastKeys:false});
  assert.deepEqual(disabled.sources,[]);assert.equal(disabled.sourceMode,'learned_examples_only');
  assert.equal(composeInput(index,undefined,[{role:'user',text:'SMS bonusu istiyorum.'}],{useFastKeys:true}).sources.length,1);
});
test('irrelevant learned templates are excluded, including older examples that had a general category',async()=>{
  const closure=await makeExample([{role:'user',text:'Hesabımı kapatın.'}],'Hesabınızı kapatma talebinizi anlıyorum. Kararınız doğrultusunda ilerleyelim.','correction');
  const generic=await makeExample([{role:'user',text:'Merak ettiğim başka bir konu var.'}],'Hangi işlem konusunda yardım istediğinizi paylaşabilir misiniz?','correction');
  const memory=addExamples(emptyMemory(),[{...closure,category:'general'},generic]);
  const selected=selectExamples(memory,input('Hesabımı kapatmak istiyorum.'));
  assert.equal(selected.examples.length,1);assert.equal(selected.examples[0].response,closure.response);
});
