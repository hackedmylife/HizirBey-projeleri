export const VERSION = '0.2.0';
export const MEMORY_LIMIT = 10_000_000;
export const SPEECH_MODELS = ['whisper-large-v3', 'whisper-large-v3-turbo'];
export const TEXT_MODEL = 'openai/gpt-oss-20b';
export const STORE = Object.freeze({settings: 'hbVoice.settings.v1', credentials: 'hbVoice.credentials.v1', memory: 'hbVoice.memory.v1', usage: 'hbVoice.usage.v1', runtime: 'hbVoice.runtime.v1'});
export const DEFAULTS = Object.freeze({provider: 'browser', browserConsent: false, model: SPEECH_MODELS[0], correction: true, fastMode: true, freeConfirmed: false, cloudConsent: false, microphoneReady: false, deviceId: '', sensitivity: 0.005, micGain: 1.35, backgroundGuard: true, noiseLevel: 0, audioRevision: 2, latencyRevision: 1, pauseMs: 500, learn: false});
export const DEFAULT_TERMS = ['Hızır Bey', 'LiveChat', 'EveryMatrix', 'FastKeys'];

export function cleanSettings(value = {}) {
  const sensitivity = !value.audioRevision && Number(value.sensitivity) === 0.008 ? DEFAULTS.sensitivity : Number(value.sensitivity);
  const pauseMs = !value.latencyRevision && Number(value.pauseMs) === 1000 ? DEFAULTS.pauseMs : Number(value.pauseMs);
  return {
    provider: value.provider === 'groq' ? 'groq' : 'browser',
    browserConsent: value.browserConsent === true,
    model: SPEECH_MODELS.includes(value.model) ? value.model : DEFAULTS.model,
    correction: value.correction !== false,
    fastMode: value.fastMode !== false,
    freeConfirmed: value.freeConfirmed === true,
    cloudConsent: value.cloudConsent === true,
    microphoneReady: value.microphoneReady === true,
    deviceId: typeof value.deviceId === 'string' ? value.deviceId.slice(0, 250) : '',
    sensitivity: Math.max(0.002, Math.min(0.04, sensitivity || DEFAULTS.sensitivity)),
    micGain: Math.max(1, Math.min(2, Number(value.micGain) || DEFAULTS.micGain)),
    backgroundGuard: value.backgroundGuard !== false,
    noiseLevel: Number.isFinite(value.noiseLevel) ? Math.max(0, Math.min(0.2, value.noiseLevel)) : 0,
    noiseDeviceId: typeof value.noiseDeviceId === 'string' ? value.noiseDeviceId.slice(0, 250) : '',
    audioRevision: DEFAULTS.audioRevision,
    latencyRevision: DEFAULTS.latencyRevision,
    pauseMs: Math.max(350, Math.min(1800, pauseMs || DEFAULTS.pauseMs)),
    learn: value.learn === true
  };
}
export function groqReady(settings, hasKey) {return Boolean(hasKey && settings.freeConfirmed && settings.cloudConsent);}
export function dictationReady(settings, hasKey) {return Boolean(settings.microphoneReady && (settings.provider === 'browser' ? settings.browserConsent : groqReady(settings, hasKey)));}
export function normalize(text) {return String(text).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i');}
export function words(text) {return normalize(text).match(/[\p{L}\p{N}]+/gu) || [];}
export function textBytes(value) {return new TextEncoder().encode(JSON.stringify(value)).byteLength;}
export function basicText(value, terms = [], {terminal = true} = {}) {
  let text = String(value || '').normalize('NFC').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/([!?]){3,}/g, '$1').trim();
  for (const term of terms.slice(0, 200)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'), term);
  }
  text = text.replace(/(^|[.!?]\s+)([\p{L}])/gu, (_, start, letter) => start + letter.toLocaleUpperCase('tr-TR'));
  if (terminal && text && !/[.!?…:;]$/.test(text)) text += '.';
  return text;
}
// ASR punctuation is provisional. Keep number separators, URLs and addresses;
// sentence punctuation is decided only after the user finishes dictation.
export function draftText(value, terms = []) {
  const source = String(value || '');
  const protectedRanges = [...source.matchAll(/(?:https?:\/\/|www\.)[^\s]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu)].map(x => [x.index, x.index + x[0].replace(/[,.!?;:]+$/, '').length]);
  const text = source.replace(/[.,!?;:…]/gu, (mark, at) => {
    if (protectedRanges.some(([start, end]) => at >= start && at < end)) return mark;
    if (/[.,:]/.test(mark) && /\d/.test(source[at - 1] || '') && /\d/.test(source[at + 1] || '')) return mark;
    return ' ';
  });
  return basicText(text, terms, {terminal: false});
}
export function guardPunctuation(original, candidate, terms = []) {
  const check = guardCorrection(original, candidate, terms);
  if (!check.ok) return check;
  const lexical = text => String(text).normalize('NFC').toLocaleLowerCase('tr-TR').match(/[\p{L}\p{N}]+/gu) || [];
  if (!sameArray(lexical(original), lexical(candidate))) return {ok: false, reason: 'Noktalama sırasında kelime eklendi, silindi veya değişti.'};
  const amounts = text => (String(text).match(/(?:[+−-]\s*)?\d+(?:[.,:/-]\d+)*|[%₺$€£]/gu) || []).map(x => x.replace(/\s/g, ''));
  if (!sameArray(amounts(original), amounts(candidate))) return {ok: false, reason: 'Sayı işareti, ayırıcı veya yüzde değişti.'};
  return check;
}
function digits(text) {return (text.match(/\d+(?:[.,:/-]\d+)*/g) || []).map(x => x.replace(/,/g, '.'));}
function sameArray(a, b) {return a.length === b.length && a.every((x, i) => x === b[i]);}
function negativeWords(text) {return words(text).filter(w => /^(?:degil\w*|yok\w*|hayir|asla|henuz|mumkun\s*degil)$/.test(w) || /(?:madi|medi|mamis|memis|mayacak|meyecek|miyor|miyorum|miyoruz|miyorsunuz|mamal|memel|amaz|emez|masin|mesin)/.test(w));}
function numberWords(text) {const set = new Set('sifir bir iki uc dort bes alti yedi sekiz dokuz on yirmi otuz kirk elli altmis yetmis seksen doksan yuz bin milyon milyar'.split(' ')); return words(text).filter(w => set.has(w));}
function categories(text) {
  const w = words(text);
  return ['yatirim', 'cekim', 'onay', 'redd', 'iptal', 'kapat', 'acil', 'bekle', 'tamamlan'].filter(root => w.some(x => x.startsWith(root)));
}
export function guardCorrection(original, candidate, terms = []) {
  if (typeof candidate !== 'string' || !candidate.trim() || candidate.length > Math.max(250, original.length * 1.7)) return {ok: false, reason: 'Metin uzunluğu değişti.'};
  const raw = original.trim(), next = candidate.trim();
  if (/```|<\/?(?:script|think)>|https?:\/\//i.test(next) && !raw.includes(next)) return {ok: false, reason: 'Beklenmeyen içerik eklendi.'};
  if (!sameArray(digits(raw), digits(next))) return {ok: false, reason: 'Tutar veya sayı değişti.'};
  if (!sameArray(numberWords(raw), numberWords(next))) return {ok: false, reason: 'Söylenen sayı değişti.'};
  if (!sameArray(negativeWords(raw), negativeWords(next))) return {ok: false, reason: 'Olumsuzluk veya işlem durumu değişti.'};
  if (!sameArray(categories(raw), categories(next))) return {ok: false, reason: 'İşlem türü değişti.'};
  for (const term of terms) if (normalize(raw).includes(normalize(term)) && !normalize(next).includes(normalize(term))) return {ok: false, reason: 'Özel terim değişti.'};
  const a = new Set(words(raw)), b = new Set(words(next));
  const common = [...a].filter(x => b.has(x)).length;
  if (a.size > 3 && common / Math.max(a.size, b.size) < 0.55) return {ok: false, reason: 'Cümle fazla değiştirildi.'};
  return {ok: true, text: next};
}
export function relevantExamples(text, pairs = []) {
  const query = new Set(words(text));
  return pairs.map(pair => ({pair, score: words(pair.from).filter(w => query.has(w)).length / Math.max(1, new Set(words(pair.from)).size)})).filter(x => x.score > 0.45).sort((a, b) => b.score - a.score).slice(0, 2).map(x => ({from: x.pair.from.slice(0, 200), to: x.pair.to.slice(0, 200)}));
}
export function whisperPrompt(terms = []) {
  let prompt = 'Türkçe canlı destek diktesi. Özel yazılışlar:';
  for (const term of terms.slice(0, 30)) {const next = `${prompt} ${term},`; if (new TextEncoder().encode(next).byteLength > 220) break; prompt = next;}
  return prompt;
}
export function emptyMemory() {return {schema: 1, terms: [...DEFAULT_TERMS], pairs: []};}
export function validateMemory(value) {
  if (!value || value.schema !== 1 || !Array.isArray(value.terms) || !Array.isArray(value.pairs)) throw new Error('Geçerli bir Hızır Bey sözlük yedeği seç.');
  if (textBytes(value) > MEMORY_LIMIT) throw new Error('Yedek 10 MB sınırını aşıyor.');
  const terms = [...new Set(value.terms.filter(x => typeof x === 'string').map(x => x.trim()).filter(x => x && x.length <= 80))].slice(0, 300);
  const pairs = value.pairs.map(x => {
    if (!x || typeof x.from !== 'string' || typeof x.to !== 'string' || x.from.length > 4000 || x.to.length > 4000) throw new Error('Yedekte geçersiz düzeltme kaydı var.');
    return {from: x.from.trim(), to: x.to.trim(), at: Number.isFinite(x.at) ? x.at : 0};
  }).filter(x => x.from && x.to && x.from !== x.to);
  const result = {schema: 1, terms, pairs};
  if (textBytes(result) > MEMORY_LIMIT) throw new Error('Hafıza 10 MB sınırını aşıyor.');
  return result;
}
export function addCorrection(memory, from, to, now = Date.now()) {
  const safe = validateMemory(memory);
  if (!from || !to || from === to || from.length > 4000 || to.length > 4000) return safe;
  const pairs = safe.pairs.filter(x => x.from !== from);
  pairs.push({from, to, at: now});
  const result = {...safe, pairs};
  // Retire oldest pairs only when the byte limit is reached, not at an arbitrary record count.
  while (result.pairs.length && textBytes(result) > MEMORY_LIMIT) result.pairs.shift();
  return result;
}
export function serializeBackup(memory) {return JSON.stringify(validateMemory(memory));}
export function liveChatUrl(url) {try {const u = new URL(url); return u.protocol === 'https:' && ['my.livechatinc.com', 'my.livechat.com'].includes(u.hostname);} catch {return false;}}
export class QuotaWaitError extends Error {
  constructor(waitMs) {super('İstekler ücretsiz sınır için bekletildi. Kısa bir süre sonra tekrar dene.'); this.name = 'QuotaWaitError'; this.waitMs = waitMs;}
}
export function quotaReservation(usage, kind, seconds = 0, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const state = usage?.day === day ? {...usage, recent: (usage.recent || []).filter(x => now - x.at < 60_000)} : {day, speech: 0, text: 0, audio: 0, recent: []};
  if (!['speech', 'text'].includes(kind)) throw new Error('Geçersiz kota işlemi.');
  const perMinute = kind === 'speech' ? 18 : 25, perDay = kind === 'speech' ? 1800 : 900;
  if ((state[kind] || 0) >= perDay) throw new Error('Ücretsiz günlük uygulama sınırı doldu. Yeni kota dönemini bekle.');
  if (kind === 'speech' && (state.audio || 0) + seconds > 27_000) throw new Error('Ücretsiz ses kullanım sınırına ulaşıldı.');
  const recent = state.recent.filter(x => x.kind === kind).sort((a, b) => a.at - b.at);
  if (recent.length >= perMinute) throw new QuotaWaitError(Math.max(1, recent[recent.length - perMinute].at + 60_050 - now));
  state[kind] = (state[kind] || 0) + 1;
  state.audio = (state.audio || 0) + (kind === 'speech' ? Math.max(0, seconds) : 0);
  state.recent = [...state.recent, {at: now, kind}];
  return state;
}
