import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIndex, retrieve, candidateBatch} from '../extension/retrieval.js';
import {compactInput} from '../extension/ai-control.js';
const template = (id, label, text) => ({id, label, shortcut: label, text});
const user = text => [{role: 'user', text}];
test('topic index distinguishes named bonuses and credential problems even on broader pass', () => {
  const index = buildIndex([
    template('sms', 'SMS bonusu', 'SMS aktif bonusumuz yalnızca bir kere alınabilir.'),
    template('return', 'Geri dönüş bonusu', 'Geri dönüş bonusu için SMS doğrulamasını açınız.'),
    template('password', 'Şifre', 'Şifrenizi giriş sayfasından yenileyebilirsiniz.'),
    template('ip', 'IP bloke', 'IP blokesinde giriş için farklı bağlantı deneyiniz.'),
    template('cash', 'Çekim', 'Para çekim talepleri finans birimine iletilmektedir.')
  ]);
  for (const broaden of [false, true]) {
    assert.deepEqual(retrieve(index, user('SMS bonusu alabilir miyim'), {broaden}).items.map(t => t.id), ['sms']);
    assert.deepEqual(retrieve(index, user('Parolamı unuttum giriş yapamıyorum'), {broaden}).items.map(t => t.id), ['password']);
  }
  assert.equal(retrieve(index, user('Paramı çekemiyorum')).items[0].id, 'cash');
});
test('full catalog ranking and alternate batches reach beyond the old six candidates', () => {
  const index = buildIndex(Array.from({length: 40}, (_, i) => template(`t${i}`, 'Kupon bilgisi', `Spor kupon numarasını iletir misiniz? Seçenek ${i}.`)));
  const first = candidateBatch(retrieve(index, user('Kuponum yanlış sonuçlandı')));
  assert.equal(first.length, 12);
  const next = candidateBatch(retrieve(index, user('Kuponum yanlış sonuçlandı'), {exclude: first.map(t => t.id), broaden: true}));
  assert.equal(next.length, 12);
  assert.ok(next.every(t => !first.some(previous => previous.id === t.id)));
});
test('conditions late in long templates and confirmation requirements reach the AI separately', () => {
  const original = template('t1', 'Yatırım bonusu', 'Yatırım bonusumuzla ilgili açıklama. ' + 'Uzun açıklama. '.repeat(100) + 'Yalnızca 1 defa yararlanabilirsiniz. Bonus hesabınıza tanımlanmıştır.');
  const candidate = retrieve(buildIndex([original]), user('Yatırım bonusu ikinci kez alınır mı')).items[0];
  assert.equal(candidate.guarded, true);
  const compact = compactInput(user('Yatırım bonusu ikinci kez alınır mı'), [candidate]).candidates[0];
  assert.ok(compact.conditions.some(s => /1 defa/.test(s)));
  assert.equal(compact.requiresVerification, true);
  assert.equal(candidate.text, original.text);
});
test('already supplied coupon ID and internal comments are never suggested', () => {
  const index = buildIndex([template('ask', 'Kupon numarası', 'Kupon numarasını iletir misiniz?'), template('internal', 'Kupon', '// kupon için kontrol pls')]);
  const messages = [{role:'user',text:'Kuponumda sorun var'}, {role:'agent',text:'Kupon numarasını iletir misiniz?'}, {role:'user',text:'123456789'}];
  assert.equal(retrieve(index, messages).items.length, 0);
});
