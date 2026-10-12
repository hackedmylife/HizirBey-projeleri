import test from 'node:test';
import assert from 'node:assert/strict';
await import('../extension/reader.js');
function feed(id,visible,text) {
  const message={dataset:{testid:'agent-message',messageId:`${id}-m1`},id:'',querySelector:()=>({textContent:text})};
  return {dataset:{chatId:id},querySelectorAll:()=>[message],closest:()=>null,getClientRects:()=>visible?[{}]:[]};
}
test('reader isolates the visible conversation for suggestions but exposes every loaded feed to learning',()=>{
  const root={querySelectorAll:()=>[feed('hidden',false,'Önceki görüşme.'),feed('visible',true,'Aktif görüşme.')]};
  assert.equal(globalThis.HizirReader.read(root).conversationId,'visible');
  assert.deepEqual(globalThis.HizirReader.readAll(root).map(v=>v.conversationId),['hidden','visible']);
  assert.equal(globalThis.HizirReader.read(root).messages[0].id,'visible-m1');
});
test('an empty DOM exposes no conversation and unloaded history is never invented',()=>{
  const root={querySelectorAll:()=>[]};assert.equal(globalThis.HizirReader.read(root).found,false);assert.deepEqual(globalThis.HizirReader.readAll(root),[]);
});
