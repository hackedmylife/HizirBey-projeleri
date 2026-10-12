import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareKnowledge, knowledgeBatch, validateAnalysis, knowledgeProgress} from '../extension/knowledge.js';
const catalog = texts => ({templates:texts.map((text,i)=>({id:`t${i}`,text,label:'Bilgi',shortcut:`bilgi${i}*`}))});
test('persistent knowledge is reused unchanged and only changed records need analysis',async()=>{
  const c=catalog(['SMS aktif bonusumuzdan yalnızca 1 kere yararlanılabilir.','Şifre yenileme için giriş ekranını kullanınız.']);
  const k=await prepareKnowledge(c);k.entries[0].analysis={summary:'SMS koşulu',topics:['sms_bonus'],keywords:[],evidence:[]};k.entries[1].analysis={summary:'Şifre',topics:['password'],keywords:[],evidence:[]};
  assert.equal(await prepareKnowledge(c,k),k);
  const updated=await prepareKnowledge(catalog([c.templates[0].text,'Şifre yenileme için yardım alınız.']),k);
  assert.ok(updated.entries[0].analysis);assert.equal(updated.entries[1].analysis,null);
  assert.equal(knowledgeProgress(updated).done,1);
  assert.equal(knowledgeBatch(updated,catalog([c.templates[0].text,'Şifre yenileme için yardım alınız.'])).length,1);
});
test('preparation sends full source text and skips internal comments',async()=>{
  const text='Açıklama. '.repeat(1000)+'Yalnızca 1 kere kullanılabilir.';
  const c=catalog([text,'// internal kontrol pls']);const k=await prepareKnowledge(c);const batch=knowledgeBatch(k,c);
  assert.equal(batch.length,1);assert.equal(batch[0].text,text);
  assert.equal(knowledgeProgress(k).total,1);
});
test('analysis cannot introduce fabricated evidence, unknown or duplicate records',()=>{
  const batch=[{id:'t0',text:'Yalnızca 1 kere kullanılabilir.'}];
  const entry={id:'t0',summary:'Koşul',topics:['sms_bonus'],keywords:[],evidence:['Yalnızca 1 kere kullanılabilir.']};
  assert.equal(validateAnalysis({entries:[entry]},batch).length,1);
  assert.throws(()=>validateAnalysis({entries:[{...entry,evidence:['İkinci kere kullanılabilir.']}]},batch));
  assert.throws(()=>validateAnalysis({entries:[{...entry,id:'invented'}]},batch));
});
