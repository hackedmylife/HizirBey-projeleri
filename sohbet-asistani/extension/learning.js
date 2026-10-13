import {normalize, tokens, requestContext, needsConfirmation, supportIntent} from './core.js';
import {digest} from './knowledge.js';

export const MEMORY_VERSION = 1;
export const MAX_EXAMPLES = 20000, MAX_BYTES = 10000000;
const encoder = new TextEncoder();
// Stored rows are immutable snapshots; cache work for rows that have not changed.
const rowSizes = new WeakMap(), arraySizes = new WeakMap(), profiles = new WeakMap(), indexes = new WeakMap(), statsCache = new WeakMap();
function rowBytes(row) {
  if (!rowSizes.has(row)) rowSizes.set(row, encoder.encode(JSON.stringify(row)).length);
  return rowSizes.get(row);
}
export function exampleBytes(examples) {
  if (!arraySizes.has(examples)) arraySizes.set(examples, 2 + Math.max(0, examples.length - 1) + examples.reduce((size, row) => size + rowBytes(row), 0));
  return arraySizes.get(examples);
}
export function emptyMemory() {return {version: MEMORY_VERSION, examples: [], rejected: [], blocked: [], updatedAt: null};}
export function maskPrivate(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, '[bağlantı]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[e-posta]')
    .replace(/\b(?:gsk_|sk-or-|sk-|AIza)[\w-]{12,}/g, '[gizli bilgi]')
    .replace(/(?:şifrem|sifrem|parolam)\s+(?!unuttum\b|yok\b|yenile|değiş|degis|sıfır|sifir)(?:[^\s,;.!?]{6,})/gi, '[şifre bilgisi]')
    .replace(/(?:şifre(?:m|niz|si)?|sifre(?:m|niz|si)?|parola(?:m|nız|niz|sı|si)?)\s*(?:[:=]|(?:şu|su|bu)\s*:)\s*\S+/gi, '[şifre bilgisi]')
    .replace(/(?:kullanıcı\s*(?:adım|adı|adınız)|kullanici\s*(?:adim|adi|adiniz)|nick(?:im)?|username|tc\s*(?:kimlik)?)\s*[:=]?\s*[^,;.!?\n]+/gi, '[kimlik bilgisi]')
    .replace(/(?:^|\bbenim\s+|merhaba[,!]\s*)(?:adım|adim|soyadım|soyadim)\s*[:=]?\s*[^,;.!?\n]+/gi, '[kimlik bilgisi]')
    .replace(/(?:adım|adim|soyadım|soyadim)\s*[:=]\s*[^,;.!?\n]+/gi, '[kimlik bilgisi]')
    .replace(/(?:\+?\d[\s().-]*){7,}/g, '[numara]')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[tanımlayıcı]')
    .replace(/\b(?:Merhaba|Sayın|Sayin)\s*[,!]?\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){0,2}(?:\s*(?:Bey|Hanım))?\s*[,!]?/g, 'Merhaba, ')
    .replace(/^[\p{L}]+(?:\s+[\p{L}]+){0,2}\s+(?:Bey|Hanım|Hanim)\s*[,.:]?\s*/u, '')
    .replace(/\d+(?:[.,]\d+)*/g, '[sayı]')
    .replace(/\b(?:bir|iki|üç|uc|dört|dort|beş|bes|on|yirmi)\s+(?:defa|kez|kere|kat|saat|gün|gun|dakika)\b/gi, '[koşul]')
    .trim();
}
function dangerousRequest(text) {
  const q = normalize(text);
  return /(?:sifrenizi|parolanizi|kart numaranizi|guvenlik kodunuzu).{0,35}(?:paylas(?:ir|iniz|manizi)|ilet(?:ir|iniz|menizi)|gonder(?:ir|iniz|menizi))|sistem talimat|onceki talimat|api anahtar|ignore.{0,20}instruction|system prompt|developer message|```|\{\s*"/.test(q);
}
function accountOutcome(text) {
  return needsConfirmation(text) || /kontrol ettim|hesabinizdaki bakiye|hesabinizda.{0,50}(?:mevcut|bulun|goruyor)|tamamlanmistir|tamamlandi\b|onaylanmistir|reddedilmistir|hakkiniz.{0,15}(?:yok|bulunmuyor)|incelemeye.{0,20}ilettim/.test(normalize(text));
}
export function styleResponse(text) {
  if (dangerousRequest(text)) return '';
  const pieces = String(text).split(/\n+|(?<=[.!?;])\s+/);
  return pieces.filter(piece => !accountOutcome(piece)).map(piece => {
    const q = normalize(piece);
    if (piece.includes('[güncel FastKeys koşulu]')) return maskPrivate(piece);
    // Company eligibility and limits are never learned from an old conversation.
    if (/bonus|promosyon|cevrim/.test(q) && /yalnizca|sadece|minimum|maksimum|en az|en fazla|yararlan|kullanim|alinabil|alinamaz|sart|kosul|gecerli/.test(q)) {
      const index = q.search(/yalnizca|sadece|minimum|maksimum|en az|en fazla|yararlan|kullanim|alinabil|alinamaz|sart|kosul|gecerli/);
      return `${maskPrivate(piece.slice(0, Math.max(0, index)))} [güncel FastKeys koşulu].`.trim();
    }
    return maskPrivate(piece);
  }).join(' ').trim().slice(0, 1200);
}
function contextWindow(messages, limit) {
  const request = requestContext(messages), selected = new Set();
  const anchors = messages.map((m, i) => m.role === 'user' && request.includes(m.text) ? i : -1).filter(i => i >= 0);
  for (const i of anchors.slice(-Math.min(4, Math.floor(limit / 2)))) selected.add(i);
  for (const role of ['user', 'agent']) {
    const i = messages.findLastIndex(m => m.role === role);
    if (i >= 0 && selected.size < limit) selected.add(i);
  }
  for (let i = messages.length - 1; i >= 0 && selected.size < limit; i--) selected.add(i);
  return [...selected].sort((a, b) => a - b).map(i => messages[i]);
}
const excerpt = (text, limit) => text.length <= limit ? text : `${text.slice(0, Math.floor((limit - 3) / 2))} … ${text.slice(-Math.ceil((limit - 3) / 2))}`;
export function cleanContext(messages) {
  const result = []; let lastOriginalAgent = '';
  for (const m of (Array.isArray(messages) ? messages : []).filter(m => m && ['user', 'agent'].includes(m.role) && typeof m.text === 'string').slice(-20)) {
    const previous = lastOriginalAgent;
    lastOriginalAgent = m.role === 'agent' ? m.text : '';
    // A short answer following an identity request is not retained as training data.
    if (m.role === 'user' && /kullanici ad|nick|telefon|adiniz|soyadiniz/.test(normalize(previous)) && m.text.length < 100) continue;
    if (m.role === 'agent' && accountOutcome(m.text)) continue;
    const text = maskPrivate(m.text).slice(0, 350);
    if (text && !/^\[(?:kimlik|sifre|şifre)/.test(normalize(text))) result.push({role: m.role, text});
  }
  return contextWindow(result, 8);
}
function category(text) {
  const priority = supportIntent(text); if (priority) return priority;
  const q = normalize(text);
  const rules = [['sms_bonus', /sms.*bonus|bonus.*sms/], ['return_bonus', /geri\s*don/], ['jest_bonus', /jest|teselli/], ['loss_bonus', /kayip.*bonus|discount/], ['password', /sifre|parola/], ['ip_block', /\bip\b/], ['withdrawal', /cekim|cekem|para.*cek/], ['deposit', /yatir|havale/], ['sports', /kupon|bahis|mac|spor/], ['casino', /oyun|casino|slot|tur id/], ['verification', /kimlik|hesap.*onay|belge/]];
  return rules.find(([, pattern]) => pattern.test(q))?.[0] || 'general';
}
export async function makeExample(context, response, origin = 'automatic', now = Date.now()) {
  const cleaned = cleanContext(context), answer = styleResponse(response);
  if (!cleaned.some(m => m.role === 'user') || answer.length < 25 || !/[.!?…]$/.test(answer)) return null;
  const request = excerpt(requestContext(cleaned), 600);
  if (!request || !tokens(request).length) return null;
  const id = await digest(JSON.stringify([cleaned, answer]));
  return {id, context: cleaned, request, response: answer, category: category(request), origin: origin === 'correction' || origin === 'approved' ? origin : 'automatic', createdAt: now, updatedAt: now};
}
export function addExamples(raw, incoming, now = Date.now()) {
  const memory = raw?.version === MEMORY_VERSION ? raw : emptyMemory();
  const blocked = new Set(memory.blocked || []), map = new Map(memory.examples.map(e => [e.id, e]));
  let updated = false;
  for (const item of incoming.filter(Boolean)) {
    if (blocked.has(item.id)) continue;
    const old = map.get(item.id);
    if (!old) map.set(item.id, item);
    else if (item.origin !== 'automatic' && old.origin === 'automatic') {map.set(item.id, {...item, createdAt: old.createdAt}); updated = true;}
  }
  const ordered = [...map.values()].sort((a, b) => {
    const priority = e => e.origin === 'automatic' ? 0 : 1;
    return priority(b) - priority(a) || b.updatedAt - a.updatedAt;
  });
  const examples = []; let bytes = 2;
  for (const row of ordered) {
    const cost = rowBytes(row) + (examples.length ? 1 : 0);
    if (examples.length >= MAX_EXAMPLES || bytes + cost > MAX_BYTES) break;
    examples.push(row); bytes += cost;
  }
  arraySizes.set(examples, bytes);
  const oldIds = new Set(memory.examples.map(e => e.id));
  const added = examples.filter(e => !oldIds.has(e.id)).length;
  return {...memory, examples, updatedAt: added || updated ? now : memory.updatedAt, added};
}
export function removeExample(raw, id) {
  const memory = raw?.version === MEMORY_VERSION ? raw : emptyMemory();
  return {...memory, examples: memory.examples.filter(e => e.id !== id), blocked: [...new Set([...(memory.blocked || []), id])].slice(-2000), updatedAt: Date.now()};
}
export async function rejectResponse(raw, messages, response, now = Date.now()) {
  const memory = raw?.version === MEMORY_VERSION ? raw : emptyMemory();
  const sample = await makeExample(messages, response, 'automatic', now); if (!sample) return memory;
  return {...removeExample(memory, sample.id), rejected: [...memory.rejected.filter(e => e.id !== sample.id), sample].slice(-100), updatedAt: now};
}
function profile(example) {
  if (!profiles.has(example)) profiles.set(example, {example, words: tokens(example.request), kind: category(example.request), responseKey: normalize(example.response)});
  return profiles.get(example);
}
function exampleIndex(examples) {
  if (indexes.has(examples)) return indexes.get(examples);
  const byTopic = new Map(), byWord = new Map(), preferred = [];
  for (const example of examples) {
    const row = profile(example);
    if (!byTopic.has(row.kind)) byTopic.set(row.kind, []);
    byTopic.get(row.kind).push(row);
    for (const word of row.words) {
      if (!byWord.has(word)) byWord.set(word, []);
      byWord.get(word).push(row);
    }
    if (example.origin !== 'automatic' && preferred.length < 20) preferred.push(example);
  }
  const value = {byTopic, byWord, preferred}; indexes.set(examples, value); return value;
}
export function selectExamples(raw, input, enabled = true) {
  if (!enabled || raw?.version !== MEMORY_VERSION) return {examples: [], unwantedExamples: [], writingPreferences: {}};
  const wanted = new Set(tokens(input.request)), topic = category(input.request), priority = supportIntent(input.request), index = exampleIndex(raw.examples);
  const score = row => {
    const overlap = row.words.filter(t => wanted.has(t)).length, kind = row.kind;
    if (priority && kind !== topic) return -1;
    if (kind !== topic && kind !== 'general' && topic !== 'general') return -1;
    if (!overlap && (kind !== topic || topic === 'general')) return -1;
    return overlap * 3 + (kind === topic ? 8 : 0) + (row.example.origin !== 'automatic' ? 5 : 0);
  };
  const candidates = new Set(topic === 'general' ? [] : index.byTopic.get(topic) || []);
  if (!priority) for (const word of wanted) for (const row of index.byWord.get(word) || []) candidates.add(row);
  const chosen = [...candidates].map(row => ({row, score: score(row)})).filter(e => e.score > 0).sort((a, b) => b.score - a.score || b.row.example.updatedAt - a.row.example.updatedAt);
  const examples = [], distinct = new Set(); let size = 0;
  for (const {row} of chosen) {
    if (examples.length >= 3) break;
    if (distinct.has(row.responseKey)) continue;
    const e = row.example;
    const item = {request: excerpt(e.request, 350), context: contextWindow(e.context, 4).map(m => ({...m, text: excerpt(m.text, 220)})), response: e.response.slice(0, 650), origin: e.origin, purpose: 'style_only'};
    if (size + JSON.stringify(item).length > 2390) continue;
    examples.push(item); distinct.add(row.responseKey); size += JSON.stringify(item).length;
  }
  const unwantedExamples = (raw.rejected || []).filter(e => score(profile(e)) > 0).slice(-1).map(e => ({request: e.request.slice(0, 250), response: e.response.slice(0, 400), purpose: 'avoid_this_response'}));
  const preferred = index.preferred;
  const basis = preferred.length ? preferred : chosen.slice(0, 20).map(e => e.row.example);
  const averageChars = basis.length ? Math.round(basis.reduce((n, e) => n + e.response.length, 0) / basis.length) : 0;
  return {examples, unwantedExamples, writingPreferences: {preferredLength: averageChars, source: preferred.length ? 'your_corrections' : 'observed_agent_replies'}};
}
export function memoryStats(raw) {
  const m = raw?.version === MEMORY_VERSION ? raw : emptyMemory();
  if (!statsCache.has(m)) {
    let corrected = 0, approved = 0, automatic = 0;
    for (const e of m.examples) {if (e.origin === 'correction') corrected++; else if (e.origin === 'approved') approved++; else automatic++;}
    const usedBytes = exampleBytes(m.examples), usagePercent = Math.min(100, Math.round(usedBytes / MAX_BYTES * 1000) / 10);
    statsCache.set(m, {count: m.examples.length, corrected, approved, automatic, rejected: m.rejected.length, updatedAt: m.updatedAt, usedBytes, maxBytes: MAX_BYTES, maxExamples: MAX_EXAMPLES, usagePercent, nearCapacity: usedBytes >= MAX_BYTES * .95 || m.examples.length >= MAX_EXAMPLES * .95});
  }
  return {...statsCache.get(m)};
}
