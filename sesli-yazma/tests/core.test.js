import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanSettings, basicText, draftText, guardCorrection, guardPunctuation, emptyMemory, validateMemory, addCorrection, serializeBackup, relevantExamples, quotaReservation, QuotaWaitError, liveChatUrl, MEMORY_LIMIT, textBytes} from '../extension/lib/core.js';

test('only supported models and explicit free consent survive configuration', () => {
  const settings = cleanSettings({model: 'paid-unlisted-model', freeConfirmed: 'true', cloudConsent: true, sensitivity: 100, pauseMs: 0});
  assert.equal(settings.model, 'whisper-large-v3'); assert.equal(settings.freeConfirmed, false); assert.equal(settings.cloudConsent, true); assert.equal(settings.sensitivity, 0.04);
});
test('audio defaults migrate while custom choices and Free consent are preserved', () => {
  const migrated = cleanSettings({sensitivity: 0.008, microphoneReady: true, freeConfirmed: true, cloudConsent: true});
  assert.equal(migrated.sensitivity, 0.005); assert.equal(migrated.micGain, 1.35); assert.equal(migrated.audioRevision, 2); assert.equal(migrated.microphoneReady, true); assert.equal(migrated.freeConfirmed, true);
  assert.equal(cleanSettings({sensitivity: 0.012}).sensitivity, 0.012);
  assert.equal(cleanSettings({sensitivity: 0.008, audioRevision: 2}).sensitivity, 0.008);
  assert.equal(cleanSettings({micGain: 999}).micGain, 2); assert.equal(cleanSettings({micGain: 0.5}).micGain, 1);
});
test('Turkish capitalization and local terms preserve financial text', () => {
  assert.equal(basicText('istanbul için 500 TL yatırılmadı , henüz bekliyoruz', []), 'İstanbul için 500 TL yatırılmadı, henüz bekliyoruz.');
  assert.equal(basicText('livechat açık', ['LiveChat']), 'LiveChat açık.');
});
test('latency defaults migrate while deliberate pauses and fast-mode choices survive', () => {
  assert.equal(cleanSettings().pauseMs, 500);
  const migrated = cleanSettings({pauseMs: 1000, microphoneReady: true, freeConfirmed: true, cloudConsent: true});
  assert.equal(migrated.pauseMs, 500); assert.equal(migrated.latencyRevision, 1); assert.equal(migrated.fastMode, true);
  assert.equal(migrated.microphoneReady, true); assert.equal(migrated.freeConfirmed, true); assert.equal(migrated.cloudConsent, true);
  assert.equal(cleanSettings({pauseMs: 750}).pauseMs, 750);
  assert.equal(cleanSettings({pauseMs: 1000, latencyRevision: 1, fastMode: false}).pauseMs, 1000);
  assert.equal(cleanSettings({fastMode: false}).fastMode, false);
});
test('critical negative meaning cannot be inverted', () => {
  assert.equal(guardCorrection('Çekiminiz henüz onaylanmadı.', 'Çekiminiz onaylandı.').ok, false);
  assert.equal(guardCorrection('Bonus hakkınız yok.', 'Bonus hakkınız var.').ok, false);
  assert.equal(guardCorrection('İşleminiz yapılmadı.', 'İşleminiz yapıldı.').ok, false);
});
test('digit amounts and spoken quantities cannot change or reorder', () => {
  assert.equal(guardCorrection('500 TL ve 20 dakika.', '5000 TL ve 20 dakika.').ok, false);
  assert.equal(guardCorrection('Beş dakika bekleyin.', 'On dakika bekleyin.').ok, false);
  assert.equal(guardCorrection('500 TL ve 20 dakika.', '20 TL ve 500 dakika.').ok, false);
});
test('safe punctuation passes while invented operation or term is blocked', () => {
  assert.equal(guardCorrection('merhaba çekiminiz henüz onaylanmadı', 'Merhaba. Çekiminiz henüz onaylanmadı.').ok, true);
  assert.equal(guardCorrection('Çekim talebinizi bekleyin.', 'Yatırım talebinizi bekleyin.').ok, false);
  assert.equal(guardCorrection('EveryMatrix işlemi bekliyor.', 'Başka kurum işlemi bekliyor.', ['EveryMatrix']).ok, false);
});
test('backup excludes unknown keys and restores only validated memory fields', () => {
  const memory = validateMemory({...emptyMemory(), apiKey: 'not-a-real-credential', credentials: {key: 'never-export'}});
  const backup = serializeBackup(memory); assert.equal(backup.includes('never-export'), false); assert.equal(backup.includes('apiKey'), false);
  assert.throws(() => validateMemory({schema: 1, terms: [], pairs: [{from: false, to: 'text'}]}));
  assert.throws(() => validateMemory({schema: 1, terms: [], pairs: [], large: 'x'.repeat(MEMORY_LIMIT)}));
});
test('memory has no 1000-record cutoff and correction examples stay relevant', () => {
  const memory = {...emptyMemory(), pairs: Array.from({length: 1050}, (_, i) => ({from: `yanlış ${i}`, to: `doğru ${i}`, at: i}))};
  const next = addCorrection(memory, 'yeni yanlış', 'yeni doğru', 1234);
  assert.equal(next.pairs.length, 1051); assert.ok(textBytes(next) < MEMORY_LIMIT);
  const examples = relevantExamples('çekim talebiniz bekliyor', [{from: 'çekim talebiniz bekliyor', to: 'Çekim talebiniz bekliyor.'}, {from: 'havanın rengi çok güzel', to: 'Havanın rengi çok güzel.'}]);
  assert.equal(examples.length, 1);
});
test('a near-capacity JSON backup can be imported under the same 10 MB limit', () => {
  const memory = {schema: 1, terms: [], pairs: Array.from({length: 1240}, (_, i) => ({from: 'x'.repeat(4000), to: 'y'.repeat(4000), at: i}))};
  const backup = serializeBackup(memory);
  assert.ok(new TextEncoder().encode(backup).byteLength <= MEMORY_LIMIT);
  assert.equal(validateMemory(JSON.parse(backup)).pairs.length, 1240);
});
test('local free quota fails closed and resets by day', () => {
  const at = Date.UTC(2026, 9, 15, 10); let usage;
  for (let i = 0; i < 18; i++) usage = quotaReservation(usage, 'speech', 3, at);
  assert.throws(() => quotaReservation(usage, 'speech', 3, at), /bekletildi/);
  assert.equal(quotaReservation(usage, 'speech', 3, at + 61_000).speech, 19);
  assert.equal(quotaReservation(usage, 'speech', 3, at + 86_400_000).speech, 1);
  assert.throws(() => quotaReservation({day: '2026-10-15', speech: 1800, recent: []}, 'speech', 1, at), /günlük/);
});
test('host access is limited to the actual LiveChat hosts', () => {
  assert.equal(liveChatUrl('https://my.livechatinc.com/chats/demo'), true);
  for (const url of ['https://my.livechatinc.com.attacker.test/', 'http://my.livechat.com/', 'https://evil.test/']) assert.equal(liveChatUrl(url), false);
});
test('burst quota waits for the oldest rolling slot without weakening hard limits', () => {
  const now = Date.UTC(2026, 9, 15, 10); let usage;
  for (let i = 0; i < 18; i++) usage = quotaReservation(usage, 'speech', 1, now + i * 100);
  assert.throws(() => quotaReservation(usage, 'speech', 1, now + 2000), error => error instanceof QuotaWaitError && error.waitMs === 58050);
  assert.equal(usage.speech, 18);
  assert.equal(quotaReservation(usage, 'speech', 1, now + 60050).speech, 19);
  assert.throws(() => quotaReservation({...usage, speech: 1800}, 'speech', 1, now + 2000), error => !(error instanceof QuotaWaitError) && /günlük/.test(error.message));
  assert.throws(() => quotaReservation({...usage, audio: 27000}, 'speech', 1, now + 2000), error => !(error instanceof QuotaWaitError) && /ses kullanım/.test(error.message));
});
test('preview omits guessed sentence marks while amounts, times, URLs and email survive', () => {
  assert.equal(draftText('merhaba. çekim, henüz onaylanmadı!'), 'Merhaba çekim henüz onaylanmadı');
  assert.equal(draftText('1.500,75 TL, saat 17:30. https://ornek.com/a?x=1, bilgi@ornek.com.'), '1.500,75 TL saat 17:30 https://ornek.com/a?x=1 bilgi@ornek.com');
});
test('final punctuation cannot add, delete, reorder or complete spoken words', () => {
  const raw = 'merhaba talebiniz henüz onaylanmadı bilgi vereceğiz';
  assert.equal(guardPunctuation(raw, 'Merhaba. Talebiniz henüz onaylanmadı; bilgi vereceğiz.').ok, true);
  for (const text of ['Merhaba, değerli üyemiz. Talebiniz henüz onaylanmadı; bilgi vereceğiz.', 'Talebiniz henüz onaylanmadı; bilgi vereceğiz.', 'Merhaba bilgi vereceğiz talebiniz henüz onaylanmadı']) assert.equal(guardPunctuation(raw, text).ok, false);
  assert.equal(guardPunctuation('eğer işleminiz', 'Eğer işleminiz onaylanırsa bilgi vereceğiz.').ok, false);
  assert.equal(guardPunctuation('can', 'Çan.').ok, false, 'Diacritics cannot silently change a word');
  assert.equal(guardPunctuation('-500 TL ve %5', '500 TL ve %5.').ok, false);
  assert.equal(guardPunctuation('1.500,75 TL', '1,500.75 TL.').ok, false);
  assert.equal(guardPunctuation('%5 bekliyor', '5 bekliyor.').ok, false);
});
