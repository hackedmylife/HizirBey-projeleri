import test from 'node:test';
import assert from 'node:assert/strict';
import {exportMemory, parseBackup, mergeBackup, BACKUP_FORMAT, MAX_BACKUP_BYTES} from '../extension/backup.js';
import {emptyMemory, makeExample, addExamples, removeExample, rejectResponse} from '../extension/learning.js';
const context = [{role:'user',text:'İkinci SMS bonusu istiyorum.'}];
const response = 'SMS bonusu yalnızca bir kere alınabilir. Talebinizi bu bilgi doğrultusunda değerlendirebiliriz.';
const sample = async(origin='correction') => makeExample(context,response,origin,100);
test('backup round-trip preserves member context, response, correction and feedback identities',async()=>{
  const e=await sample();
  let memory=addExamples(emptyMemory(),[e]);
  memory=await rejectResponse(memory,[{role:'user',text:'Kuponumda sorun var.'}],'Hangi sonuçta farklılık gördüğünüzü paylaşır mısınız? Birlikte netleştirelim.',200);
  const restored=await parseBackup(JSON.stringify(exportMemory(memory,300)));
  assert.deepEqual(restored.examples[0],memory.examples[0]);
  assert.deepEqual(restored.rejected,memory.rejected);
  assert.deepEqual(restored.blocked,memory.blocked);
});
test('export whitelists learning fields and excludes provider keys, settings and arbitrary extra fields',async()=>{
  const e=await sample(); e.apiKey='test-secret-extra';e.context[0].session='test-session';
  const memory={...addExamples(emptyMemory(),[e]),settings:{apiKey:'test-secret-extra'},catalog:'private-fdb'};
  const backup=JSON.stringify(exportMemory(memory));
  assert.ok(!backup.includes('test-secret-extra'));assert.ok(!backup.includes('test-session'));assert.ok(!backup.includes('private-fdb'));
  assert.ok(backup.includes(BACKUP_FORMAT));assert.ok(backup.includes('context'));
});
test('malformed, oversized and unsupported backups fail without mutating the existing memory',async()=>{
  const e=await sample(),memory=addExamples(emptyMemory(),[e]); const before=JSON.stringify(memory);
  const bad=exportMemory(memory);bad.memory.examples[0].context[0].role='system';
  for(const text of ['not-json',JSON.stringify({format:BACKUP_FORMAT,schemaVersion:99,memory:{version:1}}),JSON.stringify(bad),'x'.repeat(MAX_BACKUP_BYTES+1)]) await assert.rejects(parseBackup(text));
  assert.equal(JSON.stringify(memory),before);
});
test('restoring twice never duplicates records and a newer current correction remains intact',async()=>{
  const e=await sample('automatic'),old=addExamples(emptyMemory(),[e]);
  const restored=await parseBackup(JSON.stringify(exportMemory(old)));
  const corrected=addExamples(old,[{...e,origin:'correction',updatedAt:500}]);
  const merged=mergeBackup(corrected,restored,600);assert.equal(merged.added,0);
  assert.equal(merged.memory.examples[0].origin,'correction');assert.equal(merged.memory.examples[0].updatedAt,500);
  const fresh=mergeBackup(emptyMemory(),restored);assert.equal(fresh.added,1);
  assert.equal(mergeBackup(fresh.memory,restored).added,0);
});
test('deleted examples stay blocked and restoring an old deletion cannot erase an explicit current approval',async()=>{
  const e=await sample(),memory=addExamples(emptyMemory(),[e]);
  const backup=await parseBackup(JSON.stringify(exportMemory(memory)));
  assert.equal(mergeBackup(removeExample(memory,e.id),backup).memory.examples.length,0);
  const deletion=await parseBackup(JSON.stringify(exportMemory(removeExample(memory,e.id))));
  const approved=addExamples(emptyMemory(),[{...e,origin:'approved'}]);
  assert.equal(mergeBackup(approved,deletion).memory.examples.length,1);
});
test('import rechecks privacy and strips unknown fields before persistence',async()=>{
  const memory=addExamples(emptyMemory(),[await sample()]),backup=exportMemory(memory);
  backup.memory.examples[0].context.push({role:'user',text:'E-posta: member@example.org. Kuponum da yanlış.',apiKey:'test-secret-extra'});
  backup.memory.examples[0].providers={groq:{apiKey:'test-secret-extra'}};
  const restored=await parseBackup(JSON.stringify(backup));
  const text=JSON.stringify(restored);assert.ok(!text.includes('member@example.org'));assert.ok(!text.includes('test-secret-extra'));
});
