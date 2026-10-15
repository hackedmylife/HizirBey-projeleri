import test from 'node:test';
import assert from 'node:assert/strict';
import {dictationTextRisk, inspectTranscription} from '../extension/lib/safety.js';
const good = {text: 'Merhaba, talebiniz henüz onaylanmadı.', avg_logprob: -0.15, no_speech_prob: 0.01, compression_ratio: 1.2};
test('subtitle artifacts and ambiguous MK variants reject the entire chunk', () => {
  for (const text of ['Erişim ve Altyazı M.K. Ses deneme 1-2.', 'Merhaba. Altyazı M.K.', 'mk', 'M. K.', 'M-K', 'M K', 'ｍ．ｋ', 'm\u200bk', 'amk', 'AQ']) assert.ok(dictationTextRisk(text), text);
});
test('video credit patterns are blocked without blocking customer support wording', () => {
  for (const text of ['Çeviri ve altyazı.', 'Altyazı: Örnek', 'İzlediğiniz için teşekkürler.', 'Abone olmayı unutmayın.', 'Translated by Amara.org']) assert.ok(dictationTextRisk(text), text);
  for (const text of ['Merhaba, iyi günler.', 'Ses deneme bir iki.', 'İlginiz için teşekkür ederiz.', 'Çekiminiz henüz onaylanmadı.', 'Marka ve emek.', 'İşlem MK123 için 500 TL bekleniyor.', 'Altyazı desteği var mı?']) assert.equal(dictationTextRisk(text), '', text);
});
test('normal Turkish speech passes with its actual quality metadata', () => {
  assert.deepEqual(inspectTranscription({text: good.text, segments: [good]}), {ok: true, text: good.text});
});
test('missing or malformed quality metadata never bypasses the guard', () => {
  for (const segments of [undefined, [], [{}], [{...good, avg_logprob: null}], [{...good, no_speech_prob: 2}], [{...good, compression_ratio: 0}]]) assert.equal(inspectTranscription({text: good.text, segments}).ok, false);
});
test('weak decoding, likely silence and repetition are rejected even in mixed speech', () => {
  for (const patch of [{avg_logprob: -1.2}, {no_speech_prob: 0.8}, {compression_ratio: 3}]) assert.equal(inspectTranscription({text: good.text, segments: [good, {...good, ...patch}]}).ok, false);
  assert.deepEqual(inspectTranscription({text: 'gürültü', segments: [{...good, avg_logprob: -1.3, no_speech_prob: 0.95}]}), {ok: true, text: ''});
});
test('unsafe segment content cannot hide behind a clean top-level transcript', () => {
  assert.equal(inspectTranscription({text: good.text, segments: [good, {...good, text: 'Altyazı M.K.'}]}).ok, false);
});
