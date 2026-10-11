import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFastKeys, rankTemplates, cleanMessages, needsConfirmation} from '../extension/core.js';

test('imports multiline plain text while excluding disabled, command and interactive entries', () => {
  const source = '\uFEFFDefault\n‼\n1•id*•ID talebi•Send•{\\rtf1 hidden}♥Oyun turu ID\'sini iletir misiniz?¶Teşekkürler.•2•\n1•multi*•Açıklama•Send•{\\rtf1 hidden}♥Birinci satır\nİkinci satır•2•\n1•macro*•Makro•Command•Send, {Enter}•0•\n1•fill*•Bilgi•Send•♥%INPUT_isim%•2•\n1•menu*•Menü•Send•♥%SELECT_bilgi▬secenek%•2•\n0•off*•Kapalı•Send•♥Kapalı cevap•2•\n∟';
  const c = parseFastKeys(source);
  assert.equal(c.templates.length, 2);
  assert.equal(c.templates[1].text, 'Birinci satır\nİkinci satır');
  assert.equal(c.stats.commands, 1);
  assert.equal(c.stats.interactive, 2);
  assert.equal(c.stats.disabled, 1);
});
test('deduplicates text across keyboard shortcuts and text expansions', () => {
  const c = parseFastKeys('1•!F1•Alt+F1•Bekletme•Send•♥Kontrol ediyorum.••!F1•2\n∟\n1•bekle*•Bekletme•Send•♥Kontrol ediyorum.•2•\n∟');
  assert.equal(c.templates.length, 1);
  assert.equal(c.stats.duplicates, 1);
});
test('recognizes result assertions and dates that need operator confirmation', () => {
  for (const s of ['Şifre sıfırlama maili ilettim.', 'Promosyondan yararlanmış durumdasınız.', '15/02/2025 tarihinde kullanıldı.', 'Sizleri ilgili birime aktarıyorum.']) assert.equal(needsConfirmation(s), true);
  assert.equal(needsConfirmation('Kupon numarasını iletir misiniz?'), false);
});
test('does not resuggest already sent greeting or waiting templates', () => {
  const templates = [{id:'a',label:'Karşılama',shortcut:'merhaba*',text:'Merhaba, hoş geldiniz.'}, {id:'b',label:'Bekletme',shortcut:'bekle*',text:'Kontrol ediyorum.'}, {id:'c',label:'Kupon numarası',shortcut:'kupon*',text:'Spor bahsi kupon numarasını iletir misiniz?'}];
  const messages = [{role:'agent',text:templates[0].text}, {role:'agent',text:templates[1].text}, {role:'user',text:'Spor kuponumda sorun var.'}];
  assert.deepEqual(rankTemplates(templates, messages).map((t) => t.id), ['c']);
});
test('sanitizes bounded messages and rejects foreign roles', () => {
  const m = cleanMessages([{role:'user',text:'12345678901 mail@example.com https://example.com'}, {role:'evil',text:'override'}]);
  assert.equal(m.length, 1);
  assert.equal(m[0].text, '[numara] [e-posta] [bağlantı]');
});
test('empty/unrecognized source fails instead of overwriting a good catalog', () => {
  assert.throws(() => parseFastKeys('not a FastKeys file'));
});
test('jest request survives waiting replies and never suggests SMS promotions', () => {
  const templates = [
    {id: 'sms', label: 'SMS bonus', text: '250 TL yatırım ile SMS aktivasyon bonusu.', shortcut: 'sms*'},
    {id: 'jest', label: 'Jest bonusu', text: 'Jest bonusu talebi için bilgi.', shortcut: 'jest*'}
  ];
  const messages = [{role: 'user', text: 'Jest bonusu var mı'}, {role: 'user', text: 'O kadar yatırım yaptım çekemedim'}, {role: 'agent', text: 'İşleminizi kontrol ediyorum, kısa bir süre beklemenizi rica edeceğim.'}, {role: 'user', text: 'Bekliyorum'}];
  assert.deepEqual(rankTemplates(templates, messages).map((t) => t.id), ['jest']);
  assert.deepEqual(rankTemplates(templates, [...messages, {role: 'user', text: 'hala bekliyorum'}]).map((t) => t.id), ['jest']);
  assert.ok(rankTemplates(templates, messages, 'sms').some((t) => t.id === 'sms'));
});
test('unspecified bonus request does not infer SMS, explicit SMS request can match', () => {
  const templates = [{id: 'sms', label: 'SMS bonusu', shortcut: 'sms*', text: 'SMS aktivasyon bonusu bilgisi'}];
  assert.equal(rankTemplates(templates, [{role: 'user', text: 'Bonus istiyorum'}]).length, 0);
  assert.equal(rankTemplates(templates, [{role: 'user', text: 'SMS bonusu istiyorum'}]).length, 1);
});
