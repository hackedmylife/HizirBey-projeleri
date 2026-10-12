import test from 'node:test';
import assert from 'node:assert/strict';
import {composeInput, validateReplies, localReplies, STYLES} from '../extension/composer.js';
import {buildIndex} from '../extension/retrieval.js';
const replies=text=>({replies:STYLES.map((style,i)=>({style,text:[text,'Talebinizi netleştirebilmem için biraz daha bilgi paylaşır mısınız?','Yaşadığınız durumu birlikte değerlendirelim. Sorunun hangi adımda oluştuğunu paylaşır mısınız?'][i],sourceIds:[],requiresVerification:false,verificationNote:''}))});
const input={conversation:[{role:'user',text:'Yeni bir konuda yardım lazım'}],request:'Yeni bir konuda yardım lazım',sources:[],intent:[],stage:'general'};
test('unknown topics still support three original complete replies without a matching template',()=>{
  const output=validateReplies(replies('Size yardımcı olabilmem için hangi konuda desteğe ihtiyaç duyduğunuzu paylaşır mısınız?'),input);
  assert.equal(output.length,3);assert.ok(output.every(item=>item.kind==='generated'));
  assert.equal(localReplies(input).length,3);
});
test('invented amounts, URLs, sources and account outcomes fail validation',()=>{
  for(const text of ['Bonusunuz hesabınıza tanımlanmıştır. Kullanabilirsiniz.','Hesabınızı kontrol ettim, sorun çözüldü.','Bonus için 500 TL yatırım yapabilirsiniz.','Lütfen https://invented.example.com sayfasını kullanınız.']) assert.throws(()=>validateReplies(replies(text),input));
  const value=replies('Talebinizi birlikte netleştirebiliriz. Ayrıntıları paylaşır mısınız?');value.replies[0].sourceIds=['fake'];assert.throws(()=>validateReplies(value,input));
});
test('second SMS bonus requests must retain single-use policy without alleging prior account use',()=>{
  const sms={...input,conversation:[{role:'user',text:'İkinci kez SMS bonusu istiyorum'}],request:'İkinci kez SMS bonusu istiyorum',sources:[{id:'t0',text:'SMS bonusundan yalnızca 1 kere yararlanılabilir.',conditions:[],singleUse:true}],intent:['sms_bonus']};
  const valid={replies:localReplies(sms).map((t,i)=>({style:STYLES[i],text:t.text,sourceIds:['t0'],requiresVerification:false}))};
  assert.equal(validateReplies(valid,sms).length,3);
  valid.replies[0].text='Tabii ki tekrar bonus alabilirsiniz. Talebinizi paylaşınız.';assert.throws(()=>validateReplies(valid,sms));
});
test('coupon ID already given is not requested again',()=>{
  const value=replies('Kupon numarasını paylaşır mısınız? Böylece sorunu anlayabiliriz.');
  assert.throws(()=>validateReplies(value,{...input,conversation:[{role:'user',text:'Kuponum yanlış. ID 123456789'}]}));
  const locals=localReplies({...input,intent:['sports'],conversation:[{role:'user',text:'Kuponum yanlış. [numara]'}]});
  assert.ok(locals.every(t=>!t.text.includes('numarasını paylaş')));
});
test('conversation and sources are bounded but late conditions remain available',()=>{
  const templates=[{id:'t0',shortcut:'smsiçerik*',label:'SMS bonusu',text:'SMS aktif bonusumuz hakkında bilgi. '+ 'Açıklama. '.repeat(300)+'Yalnızca 1 kere kullanılabilir.'}];
  const data=composeInput(buildIndex(templates),undefined,[{role:'user',text:'İkinci kez SMS bonusu istiyorum'}]);
  assert.ok(data.sources[0].conditions.some(s=>s.includes('1 kere')));
  assert.ok(data.sources[0].text.length<=1300);
});
test('quantity units cannot be repurposed and a generic bonus cannot infer an SMS promotion',()=>{
  const value=replies('İşleminiz 20 dakika içinde tamamlanacaktır. Bekleyiniz.');
  value.replies[0].sourceIds=['t0'];
  assert.throws(()=>validateReplies(value,{...input,sources:[{id:'t0',text:'20 freespin kazanabilirsiniz.',conditions:[]}]}));
  assert.throws(()=>validateReplies(replies('SMS bonusuyla ilgili talebinizi birlikte değerlendirebiliriz. Bilgi paylaşır mısınız?'),input));
});
test('safe password privacy guidance is permitted while requesting a password is rejected',()=>{
  assert.equal(validateReplies(replies('Şifrenizi paylaşmanıza gerek yok. Ekranda görünen hata mesajını iletebilir misiniz?'),input).length,3);
  assert.throws(()=>validateReplies(replies('Şifrenizi paylaşır mısınız? Böylece hesabınızı kontrol edebiliriz.'),input));
});
test('redacted learning placeholders can never leak into a customer-facing reply',()=>{
  assert.throws(()=>validateReplies(replies('SMS bonusu [güncel FastKeys koşulu] doğrultusunda kullanılabilir.'),{...input,intent:['sms_bonus']}));
});
