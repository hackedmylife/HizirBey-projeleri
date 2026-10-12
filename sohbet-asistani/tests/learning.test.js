import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyMemory, maskPrivate, makeExample, addExamples, removeExample, rejectResponse, selectExamples, cleanContext, MAX_EXAMPLES, MAX_BYTES} from '../extension/learning.js';
const context=[{role:'user',text:'Kuponumun sonucu yanlış görünüyor.'}];
const reply='Yaşadığınız durumu birlikte netleştirelim. İlgili kupon numarasını paylaşır mısınız?';
test('private fields, names, contact details, passwords and values are masked before persistence',()=>{
  const raw='Örnek Bey, Kullanıcı adım: testmember. E-posta test@example.org telefon +90 555 123 45 67. Şifrem: secret123! 500 TL yatırdım. https://private.example.org/abc';
  const safe=maskPrivate(raw);
  for(const value of ['Örnek','testmember','test@example.org','555','secret123','500','private.example'])assert.ok(!safe.includes(value),value);
  assert.ok(!maskPrivate('Şifrem password123').includes('password123'));
  assert.ok(maskPrivate('Şifremi unuttum').includes('unuttum'));
});
test('account results are excluded and company eligibility is reduced to a style placeholder',async()=>{
  const example=await makeExample([{role:'user',text:'İkinci SMS bonusu istiyorum.'}],'SMS bonusu yalnızca bir kere alınabilir. Talebinizi bu koşul doğrultusunda değerlendirebiliriz.');
  assert.ok(example.response.includes('[güncel FastKeys koşulu]'));
  assert.ok(!example.response.includes('bir kere'));
  assert.equal(await makeExample(context,'Bonusunuz hesabınıza tanımlanmıştır.'),null);
  assert.equal(await makeExample(context,'Şifrenizi paylaşır mısınız? Böylece hesabınıza erişebiliriz.'),null);
});
test('duplicates do not reinforce themselves, explicit corrections upgrade automatic samples',async()=>{
  const e=await makeExample(context,reply);
  const first=addExamples(emptyMemory(),[e]);assert.equal(first.examples.length,1);
  const second=addExamples(first,[e]);assert.equal(second.examples.length,1);assert.equal(second.added,0);
  const corrected=addExamples(second,[{...e,origin:'correction'}]);assert.equal(corrected.examples[0].origin,'correction');
});
test('deleting a sample blocks passive recapture and a rejected sample is removed from positive examples',async()=>{
  const e=await makeExample(context,reply);const m=addExamples(emptyMemory(),[e]);
  assert.equal(addExamples(removeExample(m,e.id),[e]).examples.length,0);
  const rejected=await rejectResponse(m,context,reply);
  assert.equal(rejected.examples.length,0);assert.equal(rejected.rejected.length,1);
});
test('example selection favors relevant corrections, avoids duplicate answer text and stays bounded',async()=>{
  const a=await makeExample(context,reply,'automatic',1);
  const b=await makeExample(context,'Kuponla ilgili hangi sonuçta fark gördüğünüzü açıklayabilir misiniz? Birlikte netleştirelim.','correction',2);
  const irrelevant=await makeExample([{role:'user',text:'Şifremi unuttum.'}],'Giriş ekranında aldığınız hata mesajını paylaşabilir misiniz?','correction',3);
  const m=addExamples(emptyMemory(),[a,b,irrelevant,{...a,id:'duplicate'}]);
  const input={request:'Kuponumun sonucu yanlış.',intent:['sports']};const chosen=selectExamples(m,input);
  assert.equal(chosen.examples[0].origin,'correction');assert.equal(chosen.examples.length,2);
  assert.ok(chosen.examples.every(e=>!e.context[0].text.includes('Şifrem')));
  assert.ok(JSON.stringify(chosen.examples).length<=2400);
  assert.equal(selectExamples(m,input,false).examples.length,0);
});
test('retention is capped and corrected samples survive automatic churn',async()=>{
  const e=await makeExample(context,reply,'correction');
  const incoming=Array.from({length:1200},(_,i)=>({...e,id:String(i),origin:'automatic',response:'x'.repeat(1200),updatedAt:i}));
  const m=addExamples(emptyMemory(),[e,...incoming]);
  assert.ok(m.examples.length<=MAX_EXAMPLES);assert.ok(m.examples.some(row=>row.id===e.id));
  assert.ok(new TextEncoder().encode(JSON.stringify(m.examples)).length<=MAX_BYTES);
});
test('step-by-step language remains intact while explicit name labels are masked',()=>{
  assert.equal(maskPrivate('Sorunu adım adım değerlendirelim.'),'Sorunu adım adım değerlendirelim.');
  assert.ok(!maskPrivate('Adım Deneme, kuponumda sorun var.').includes('Deneme'));
  assert.ok(!maskPrivate('Merhaba, adım Deneme.').includes('Deneme'));
});
test('stored and prompted examples retain member intent and representative response through long turns',async()=>{
  const request='İkinci SMS bonusu talep ediyorum.';
  const messages=[{role:'user',text:request},...Array.from({length:7},()=>({role:'agent',text:'Talebin ayrıntılarını birlikte netleştirelim.'})),{role:'user',text:'Bekliyorum.'}];
  const answer='Talebinizi anlıyorum. Uygunluk koşulları üzerinden birlikte ilerleyebiliriz.';
  const sample=await makeExample(messages,answer);
  assert.ok(sample.context.length<=8);
  assert.ok(sample.context.some(m=>m.role==='user'&&m.text===request));
  assert.ok(sample.context.some(m=>m.role==='agent'));
  assert.equal(sample.response,answer); assert.equal(sample.category,'sms_bonus');
  const prompt=selectExamples(addExamples(emptyMemory(),[sample]),{request});
  assert.ok(prompt.examples[0].request.includes('İkinci SMS'));
  assert.ok(prompt.examples[0].context.some(m=>m.role==='user'&&m.text.includes('İkinci SMS')));
  assert.equal(prompt.examples[0].response,answer);
});
test('an identity response is excluded without discarding the following customer issue',()=>{
  const cleaned=cleanContext([{role:'agent',text:'Kullanıcı adınızı paylaşır mısınız?'},{role:'user',text:'privateMemberName'},{role:'user',text:'Kuponumda sorun var.'}]);
  assert.ok(!JSON.stringify(cleaned).includes('privateMemberName'));
  assert.ok(cleaned.some(m=>m.text==='Kuponumda sorun var.'));
});
test('a request starting with a greeting is learned with its member intent intact',async()=>{
  const sample=await makeExample([{role:'user',text:'Merhaba, ikinci SMS bonusu talep ediyorum.'}],'Talebinizi anlıyorum. Güncel kullanım koşulları doğrultusunda birlikte ilerleyebiliriz.');
  assert.ok(sample); assert.equal(sample.category,'sms_bonus');
  assert.match(sample.request,/ikinci SMS/);
});
