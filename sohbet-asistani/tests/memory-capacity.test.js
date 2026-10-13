import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emptyMemory,makeExample,addExamples,removeExample,selectExamples,memoryStats,exampleBytes,MAX_BYTES,MAX_EXAMPLES} from '../extension/learning.js';
import {exportMemory,parseBackup,mergeBackup,MAX_BACKUP_BYTES} from '../extension/backup.js';
const seed = await makeExample([{role:'user',text:'Kuponumun sonucu yanlış görünüyor.'}],'Yaşadığınız sonucu birlikte netleştirelim. Hangi farklılığı gördüğünüzü paylaşır mısınız?','automatic',1);
const clone = (i,patch={}) => ({...seed,id:String(i),updatedAt:i,...patch});

test('an existing 1000-example memory grows without deleting or rewriting its saved examples',()=>{
  const rows=Array.from({length:1000},(_,i)=>clone(i));
  const old={...emptyMemory(),examples:rows,updatedAt:1000};
  const next=addExamples(old,[clone('new',{updatedAt:1001})],1001);
  assert.equal(next.examples.length,1001);assert.equal(next.added,1);
  for(const row of rows)assert.equal(next.examples.find(e=>e.id===row.id),row);
  assert.equal(memoryStats(next).maxBytes,10000000);assert.equal(memoryStats(next).maxExamples,20000);
});
test('the new count ceiling is enforced while an explicit correction survives automatic churn',()=>{
  const rows=Array.from({length:MAX_EXAMPLES+10},(_,i)=>clone(i));
  const taught=clone('taught',{origin:'correction',updatedAt:0});
  const memory=addExamples(emptyMemory(),[taught,...rows]);
  assert.equal(memory.examples.length,MAX_EXAMPLES);assert.equal(memory.examples[0].id,'taught');
  assert.ok(!memory.examples.some(e=>e.id==='0'));assert.ok(exampleBytes(memory.examples)<=MAX_BYTES);
});
test('large Unicode memories stay within the actual UTF-8 byte budget and report only retained additions',()=>{
  const rows=Array.from({length:7000},(_,i)=>clone(i,{response:'ğ'.repeat(1200)+'.'}));
  const memory=addExamples(emptyMemory(),rows);
  const actual=new TextEncoder().encode(JSON.stringify(memory.examples)).length;
  assert.ok(actual<=MAX_BYTES);assert.ok(actual>MAX_BYTES-5000);
  assert.ok(memory.examples.length>1000&&memory.examples.length<7000);
  assert.equal(memory.added,memory.examples.length);assert.equal(memoryStats(memory).usedBytes,actual);
  assert.equal(memoryStats(memory).nearCapacity,true);
});
test('capacity and origin counters update correctly after correction and deletion',()=>{
  const initial=addExamples(emptyMemory(),[seed]),before=memoryStats(initial);
  const corrected=addExamples(initial,[{...seed,origin:'correction',updatedAt:2}]);
  const stats=memoryStats(corrected);
  assert.equal(stats.corrected,1);assert.equal(stats.automatic,0);assert.equal(before.automatic,1);
  const deleted=removeExample(corrected,seed.id);assert.equal(memoryStats(deleted).count,0);
  assert.equal(memoryStats(deleted).usedBytes,2);
});
test('indexed selection stays relevant in a large corpus and updates after teaching or deleting a sample',async()=>{
  const other=await makeExample([{role:'user',text:'Şifremi unuttum.'}],'Giriş ekranında aldığınız hata mesajını paylaşır mısınız?','automatic',1);
  const rows=Array.from({length:12000},(_,i)=>({...other,id:`other-${i}`,updatedAt:i}));
  const a=clone('a',{response:'Kupon sonucuyla ilgili talebinizi birlikte netleştirelim.',updatedAt:12001});
  const b=clone('b',{response:'Kuponunuzda hangi sonucu beklediğinizi paylaşır mısınız?',updatedAt:12002});
  const input={request:'Kuponumun sonucu yanlış görünüyor.'};
  const memory=addExamples(emptyMemory(),[...rows,a,b]);
  const first=selectExamples(memory,input);assert.equal(first.examples.length,2);
  assert.ok(first.examples.every(e=>!e.response.includes('Giriş ekranı')));
  assert.deepEqual(selectExamples(memory,input),first);
  const taught=addExamples(memory,[{...a,origin:'correction',updatedAt:13000}]);
  assert.equal(selectExamples(taught,input).examples[0].response,a.response);
  assert.ok(!selectExamples(removeExample(taught,'a'),input).examples.some(e=>e.response===a.response));
  assert.ok(JSON.stringify(first.examples).length<=2400);
});
test('the manifest provides storage capacity and module options import the shared limits',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../extension/manifest.json',import.meta.url),'utf8'));
  assert.ok(manifest.permissions.includes('unlimitedStorage'));
  const html=await readFile(new URL('../extension/options.html',import.meta.url),'utf8');
  assert.match(html,/<script type="module" src="options.js"><\/script>/);
  const js=await readFile(new URL('../extension/options.js',import.meta.url),'utf8');
  assert.match(js,/import \{MAX_BACKUP_BYTES\} from '\.\/backup.js'/);
});
test('a backup larger than the previous 6 MB limit round-trips all records and remains bounded',async()=>{
  const letters=i=>{let word='';do{word=String.fromCharCode(97+i%26)+word;i=Math.floor(i/26);}while(i);return word;};
  const response=('Kupon sonucuyla ilgili ayrıntıları birlikte netleştirelim. ').repeat(18).trim();
  const examples=[];
  for(let i=0;i<4000;i++)examples.push(await makeExample([{role:'user',text:`Kupon ${letters(i)} sonucunda fark görüyorum. `+'Yaşadığım durumun ayrıntısını açıklıyorum. '.repeat(6)}],response,'automatic',i));
  assert.ok(examples.every(Boolean));
  const memory=addExamples(emptyMemory(),examples);
  const text=JSON.stringify(exportMemory(memory),null,2),bytes=new TextEncoder().encode(text).length;
  assert.ok(bytes>6000000);assert.ok(bytes<MAX_BACKUP_BYTES);
  const restored=await parseBackup(text),merged=mergeBackup(emptyMemory(),restored);
  assert.equal(merged.added,memory.examples.length);assert.equal(restored.examples.length,4000);
  assert.deepEqual(restored.examples[0],memory.examples[0]);
  assert.equal(mergeBackup(merged.memory,restored).added,0);
});
