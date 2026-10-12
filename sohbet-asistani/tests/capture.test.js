import test from 'node:test';
import assert from 'node:assert/strict';
await import('../extension/capture.js');
const {CaptureTracker}=globalThis.HizirCapture;
const user={id:'u1',role:'user',text:'Kuponumda sorun var.'};
const agent={id:'a1',role:'agent',text:'Kupon numarasını paylaşır mısınız?'};
const view=(id,messages)=>({found:true,conversationId:id,messages});
test('all conversation views are eligible and repeated DOM snapshots do not duplicate messages',()=>{
  const t=new CaptureTracker();
  assert.equal(t.observe(view('one',[user,agent]),true,0).length,1);
  assert.equal(t.observe(view('one',[user,agent]),true,0).length,0);
  assert.equal(t.observe(view('two',[user,agent]),true,0).length,1);
  assert.equal(t.observe(view('one',[user,agent,{id:'b1',role:'bot',text:'Otomatik mesaj'}]),true,0).length,0);
});
test('pause tracks a baseline; resume never backfills paused turns in current or other views',()=>{
  const t=new CaptureTracker();t.observe(view('one',[user,agent]),true,0);t.observe(view('two',[user,agent]),true,0);
  const paused={id:'a2',role:'agent',text:'Beklerken gönderilen yanıt.'};
  assert.equal(t.observe(view('one',[user,agent,paused]),false,1).length,0);
  assert.equal(t.observe(view('one',[user,agent,paused]),true,2).length,0);
  assert.equal(t.observe(view('two',[user,agent,paused]),true,2).length,0);
  assert.equal(t.observe(view('one',[user,agent,paused,{id:'a3',role:'agent',text:'Yeni yanıt.'}]),true,2).length,1);
});
test('new tab started after a pause/resume also skips old history on first observation',()=>{
  const t=new CaptureTracker();
  assert.equal(t.observe(view('new',[user,agent]),true,4).length,0);
  assert.equal(t.observe(view('new',[user,agent,{id:'a3',role:'agent',text:'Yeni cevap.'}]),true,4).length,1);
});
test('failed persistence can retry its batch without duplicating successfully stored examples',()=>{
  const t=new CaptureTracker(),snapshot=view('one',[user,agent]);
  const first=t.observe(snapshot,true,0);assert.equal(first.length,1);
  t.retry(snapshot,first);assert.equal(t.observe(snapshot,true,0).length,1);
});
test('a customer request survives more than five intervening representative messages',()=>{
  const messages=[user,...Array.from({length:7},(_,i)=>({id:`a${i+10}`,role:'agent',text:`Gerekli ayrıntıları birlikte değerlendirelim. Adım ${i+1}.`}))];
  const records=new CaptureTracker().observe(view('long-turn',messages),true,0);
  assert.ok(records.at(-1).context.some(m=>m.role==='user'&&m.text===user.text));
  assert.ok(records.at(-1).context.length<=20);
});
