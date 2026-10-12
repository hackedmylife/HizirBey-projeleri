import {normalize, tokens, requestContext, needsConfirmation} from './core.js';
import {digest} from './knowledge.js';

export const MEMORY_VERSION = 1;
export const MAX_EXAMPLES = 1000, MAX_BYTES = 1500000;
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
    // Company eligibility and limits are never learned from an old conversation.
    if (/bonus|promosyon|cevrim/.test(q) && /yalnizca|sadece|minimum|maksimum|en az|en fazla|yararlan|kullanim|alinabil|alinamaz|sart|kosul|gecerli/.test(q)) {
      const index = q.search(/yalnizca|sadece|minimum|maksimum|en az|en fazla|yararlan|kullanim|alinabil|alinamaz|sart|kosul|gecerli/);
      return `${maskPrivate(piece.slice(0, Math.max(0, index)))} [güncel FastKeys koşulu].`.trim();
    }
    return maskPrivate(piece);
  }).join(' ').trim().slice(0, 1200);
}
export function cleanContext(messages) {
  const result = []; let lastOriginalAgent = '';
  for (const m of (Array.isArray(messages) ? messages : []).filter(m => m && ['user', 'agent'].includes(m.role) && typeof m.text === 'string').slice(-5)) {
    const previous = lastOriginalAgent;
    // A short answer following an identity request is not retained as training data.
    if (m.role === 'user' && /kullanici ad|nick|telefon|adiniz|soyadiniz/.test(normalize(previous)) && m.text.length < 100) continue;
    if (m.role === 'agent') {lastOriginalAgent = m.text; if (accountOutcome(m.text)) continue;}
    const text = maskPrivate(m.text).slice(0, 350);
    if (text && !/^\[(?:kimlik|sifre|şifre)/.test(normalize(text))) result.push({role: m.role, text});
  }
  return result;
}
function category(text) {
  const q = normalize(text);
  const rules = [['sms_bonus', /sms.*bonus|bonus.*sms/], ['return_bonus', /geri\s*don/], ['jest_bonus', /jest|teselli/], ['loss_bonus', /kayip.*bonus|discount/], ['password', /sifre|parola/], ['ip_block', /\bip\b/], ['withdrawal', /cekim|cekem|para.*cek/], ['deposit', /yatir|havale/], ['sports', /kupon|bahis|mac|spor/], ['casino', /oyun|casino|slot|tur id/], ['verification', /kimlik|hesap.*onay|belge/]];
  return rules.find(([, pattern]) => pattern.test(q))?.[0] || 'general';
}
export async function makeExample(context, response, origin = 'automatic', now = Date.now()) {
  const cleaned = cleanContext(context), answer = styleResponse(response);
  if (!cleaned.some(m => m.role === 'user') || answer.length < 25 || !/[.!?…]$/.test(answer)) return null;
  const request = requestContext(cleaned).slice(-600);
  if (!request || !tokens(request).length) return null;
  const id = await digest(JSON.stringify([cleaned, answer]));
  return {id, context: cleaned, request, response: answer, category: category(request), origin: origin === 'correction' || origin === 'approved' ? origin : 'automatic', createdAt: now, updatedAt: now};
}
export function addExamples(raw, incoming, now = Date.now()) {
  const memory = raw?.version === MEMORY_VERSION ? raw : emptyMemory();
  const blocked = new Set(memory.blocked || []), map = new Map(memory.examples.map(e => [e.id, e]));
  let added = 0;
  for (const item of incoming.filter(Boolean)) {
    if (blocked.has(item.id)) continue;
    const old = map.get(item.id);
    if (!old) {map.set(item.id, item); added++;}
    else if (item.origin !== 'automatic' && old.origin === 'automatic') map.set(item.id, {...item, createdAt: old.createdAt});
  }
  const examples = [...map.values()].sort((a, b) => {
    const priority = e => e.origin === 'automatic' ? 0 : 1;
    return priority(b) - priority(a) || b.updatedAt - a.updatedAt;
  }).slice(0, MAX_EXAMPLES);
  while (new TextEncoder().encode(JSON.stringify(examples)).length > MAX_BYTES) examples.pop();
  return {...memory, examples, updatedAt: added || incoming.some(e => e?.origin !== 'automatic') ? now : memory.updatedAt, added};
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
export function selectExamples(raw, input, enabled = true) {
  if (!enabled || raw?.version !== MEMORY_VERSION) return {examples: [], unwantedExamples: [], writingPreferences: {}};
  const wanted = new Set(tokens(input.request)), topic = category(input.request);
  const score = e => {
    const overlap = tokens(e.request).filter(t => wanted.has(t)).length;
    if (e.category !== topic && e.category !== 'general' && topic !== 'general') return -1;
    return overlap * 3 + (e.category === topic ? 8 : 0) + (e.origin !== 'automatic' ? 5 : 0);
  };
  const chosen = raw.examples.map(e => ({...e, score: score(e)})).filter(e => e.score > 0).sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
  const examples = [], distinct = new Set(); let size = 0;
  for (const e of chosen) {
    if (examples.length >= 3) break;
    if (distinct.has(normalize(e.response))) continue;
    const item = {context: e.context.slice(-3).map(m => ({...m, text: m.text.slice(0, 220)})), response: e.response.slice(0, 650), origin: e.origin, purpose: 'style_only'};
    if (size + JSON.stringify(item).length > 2400) continue;
    examples.push(item); distinct.add(normalize(e.response)); size += JSON.stringify(item).length;
  }
  const unwantedExamples = (raw.rejected || []).filter(e => score(e) > 0).slice(-1).map(e => ({request: e.request.slice(0, 250), response: e.response.slice(0, 400), purpose: 'avoid_this_response'}));
  const preferred = raw.examples.filter(e => e.origin !== 'automatic').slice(0, 20);
  const basis = preferred.length ? preferred : chosen.slice(0, 20);
  const averageChars = basis.length ? Math.round(basis.reduce((n, e) => n + e.response.length, 0) / basis.length) : 0;
  return {examples, unwantedExamples, writingPreferences: {preferredLength: averageChars, source: preferred.length ? 'your_corrections' : 'observed_agent_replies'}};
}
export function memoryStats(raw) {
  const m = raw?.version === MEMORY_VERSION ? raw : emptyMemory();
  return {count: m.examples.length, corrected: m.examples.filter(e => e.origin === 'correction').length, approved: m.examples.filter(e => e.origin === 'approved').length, automatic: m.examples.filter(e => e.origin === 'automatic').length, rejected: m.rejected.length, updatedAt: m.updatedAt};
}
