import {normalize, tokens, needsConfirmation, requestContext, templatePolicy} from './core.js';

const concepts = [
  ['sms_bonus', /sms.{0,35}(?:bonus|promosyon)|(?:bonus|promosyon).{0,25}sms/],
  ['return_bonus', /geri\s*don|geridon|30\s*gun/],
  ['loss_bonus', /kayip\s*bonus|discount|zarar\s*bonus/],
  ['jest_bonus', /jest|teselli|jestbonus/],
  ['deposit_bonus', /yatirim\s*bonus|yatbonus|havale\s*bonus|kripto.{0,20}bonus|hosgeldin\s*bonus/],
  ['bonus_code', /bonus\s*kod|promosyon\s*kod|kod.{0,20}(?:bonus|promosyon)/],
  ['password', /sifre|parola|password/],
  ['ip_block', /\bip\b|ipbloke|ip blok/],
  ['sms_code', /sms.{0,20}(?:kod|gelm|ulas)|(?:kod|gelm).{0,20}sms/],
  ['email', /e.?posta|mail|eposta/],
  ['phone', /telefon|numara.{0,20}(?:guncel|degis)/],
  ['deposit', /finans|yatirim|yatirdim|para.{0,15}(?:yatir|yukle)|havale|deposit/],
  ['withdrawal', /finans|cekbekle|cekim|cekemed|cekemiy|para.{0,15}cek|withdraw/],
  ['sports', /kupon|bahis|karsilasma|musabaka|mac\b|spor|skor/],
  ['casino', /casino|slot|aviator|oyun|tur\s*(?:id|numara)/],
  ['verification', /hesap.{0,15}onay|kimlik|belge|dogum|kyc/],
  ['close_account', /hesap.{0,20}kapat|uyelik.{0,20}kapat/],
  ['technical', /donuyor|kasma|yuklenm|tarayici|cerez|uygulama|acilmiyor/],
  ['security', /guvenlik|sahte|dolandir|hesabim.{0,20}calin/]
];
const bonusNames = new Set(concepts.slice(0, 6).map(([name]) => name));
const stageRules = [
  ['repeat', /ikinci|\b2\s*(?:\.|kez|defa)|bir daha|yeniden|tekrar|daha once.{0,30}(?:aldim|kullandim)/],
  ['missing', /gecmedi|gelmedi|gelmiyor|eklenmedi|yansimadi|tanimlanmadi|ulasma|yok/],
  ['conditions', /sart|kosul|cevrim|limit|kac|ne kadar|icerik|nasil|bir kere|tek sefer/],
  ['request', /istiyor|talep|alabilir|rica|ekler|verir/]
];
function tags(text) { return concepts.filter(([, pattern]) => pattern.test(normalize(text))).map(([name]) => name); }
function stage(text) { return stageRules.find(([, pattern]) => pattern.test(normalize(text)))?.[0] || 'general'; }
function sentences(text) { return String(text).split(/\n+|(?<=[.!?;])\s+/).map(s => s.trim()).filter(Boolean); }
export function describeTemplate(t) {
  const parts = sentences(t.text);
  const title = `${t.label} ${t.shortcut}`;
  const policy = templatePolicy(t);
  const shortcutTags = tags(t.shortcut);
  const titleTags = shortcutTags.length ? shortcutTags : tags(title);
  let primary = titleTags.length ? titleTags : tags(parts[0] || '');
  // Promotion identity takes priority over secondary eligibility steps.
  if (policy.smsBonus) primary = ['sms_bonus'];
  else {
    const identity = titleTags.filter(name => bonusNames.has(name));
    if (identity.length) primary = identity;
    else if (primary.some(name => bonusNames.has(name))) primary = primary.filter(name => bonusNames.has(name));
  }
  if (!primary.some(name => bonusNames.has(name)) && /bonus|promosyon|freespin/.test(normalize(t.text)) && !/finans/.test(normalize(t.shortcut))) primary = ['other_bonus'];
  const conditions = parts.filter(s => /yalnizca|sadece|minimum|maksimum|en az|en fazla|defa|kere|kez|saat|gun|cevrim|sart|kosul|yeniden|sonra|once|(?:\d|bir).{0,15}(?:kat|₺|tl)/.test(normalize(s))).slice(0, 4);
  const guarded = Boolean(t.guarded) || needsConfirmation(t.text)
    || /(?:kontrol.{0,25}(?:sagladim|saglanmis)|(?:hesabinizda|yatiriminiz|cekim talebiniz).{0,60}(?:mevcuttur|bulunmamaktadir|onaylan|redded|iptal)|hakkiniz mevcut degildir|tanimlanmis|silinmistir|incelemeler sonrasinda|kullanmaktasiniz|hesabiniz.{0,35}(?:kapatil|incelen|engell|onay)|almaktasiniz)/.test(normalize(t.text));
  const asksId = /(?:kupon|tur|bahis).{0,35}(?:id|numara)|(?:id|numara).{0,35}(?:kupon|tur|bahis)/.test(normalize(`${title} ${t.text}`)) && /ilet|alabilir|rica|paylas/.test(normalize(t.text));
  return {primary, conditions, guarded, asksId, singleUse: policy.singleUse, stage: stage(t.text), internal: /^\s*\/\//.test(t.text) || /^(?:deposit yazanlar|withdraw yazanlar)/.test(normalize(t.text))};
}
export function buildIndex(templates, knowledge) {
  const prepared = new Map((knowledge?.entries || []).map(e => [e.id, e]));
  const documents = templates.map(t => {
    const entry = prepared.get(t.id);
    const base = entry?.profile || describeTemplate(t);
    const profile = {...base, primary: [...base.primary]};
    const hints = entry?.analysis;
    const words = tokens(`${t.label} ${t.shortcut} ${t.text} ${hints?.summary || ""} ${(hints?.keywords || []).join(" ")}`);
    if (hints?.topics?.length && !profile.primary.some(t => bonusNames.has(t))) {
      const inferred = hints.topics.filter(t => t !== 'general' && t !== 'sms_bonus');
      profile.primary = [...new Set([...profile.primary.filter(t => t !== 'other_bonus' || !inferred.some(name => bonusNames.has(name))), ...inferred])];
    }
    return {template: {...t, guarded: profile.guarded}, profile, words, title: normalize(`${t.label} ${t.shortcut}`), hay: normalize(t.text)};
  });
  const frequency = new Map();
  for (const doc of documents) for (const word of doc.words) frequency.set(word, (frequency.get(word) || 0) + 1);
  return {documents, frequency, count: documents.length};
}
export function retrieve(index, messages, {exclude = [], broaden = false} = {}) {
  const context = requestContext(messages), q = normalize(context), queryWords = tokens(context);
  let intent = tags(context);
  const promotion = intent.filter(name => bonusNames.has(name));
  if (promotion.length) intent = promotion;
  else if (intent.includes('ip_block')) intent = ['ip_block'];
  else if (intent.includes('password')) intent = ['password'];
  else if (intent.includes('sms_code')) intent = ['sms_code'];
  const phase = stage(context), excluded = new Set(exclude);
  const used = new Set(messages.filter(m => ['agent', 'bot'].includes(m.role)).map(m => normalize(m.text).trim()));
  const askedForId = messages.some(m => ['agent', 'bot'].includes(m.role) && /(?:kupon|tur|bahis).{0,35}(?:numara|id)/.test(normalize(m.text)));
  const hasId = messages.some(m => m.role === 'user' && /(?:\b\d{5,}\b|\[numara\]|(?:kupon|tur|bahis).{0,20}(?:id|numara).{0,10}[a-z0-9]{4,})/.test(normalize(m.text)));
  const items = index.documents.map(doc => {
    const {template: t, profile} = doc;
    if (profile.primary.includes('sms_bonus') && !promotion.includes('sms_bonus')) return null;
    if (profile.internal || excluded.has(t.id) || used.has(normalize(t.text).trim())) return null;
    if (/^(?:merhaba|hos geldiniz)|^(?:lutfen )?(?:beklemenizi|kontrol ediyorum)/.test(doc.hay)) return null;
    if (profile.asksId && hasId && askedForId) return null;
    const matched = intent.filter(name => profile.primary.includes(name));
    // Reject mismatched named promotions; shared words cannot override identity.
    if (promotion.includes('sms_bonus') && !profile.primary.every(name => name === 'sms_bonus')) return null;
    if (promotion.length && !matched.length && /bonus|promosyon|freespin/.test(doc.hay)) return null;
    if (!promotion.length && intent.length && !/bonus|promosyon/.test(q) && /bonus|promosyon|freespin/.test(doc.hay) && !tags(`${t.label} ${t.shortcut}`).some(name => intent.includes(name))) return null;
    if (intent.some(name => ['password', 'ip_block', 'sms_code'].includes(name)) && profile.primary.some(name => ['password', 'ip_block', 'sms_code'].includes(name)) && !matched.length) return null;
    if (intent.length && profile.primary.length && !matched.length && !broaden) return null;
    let lexical = 0;
    for (const word of queryWords) {
      if (doc.words.some(w => w === word || (word.length >= 5 && w.length >= 5 && w.slice(0, 5) === word.slice(0, 5)))) {
        lexical += Math.log(1 + index.count / (1 + (index.frequency.get(word) || 0))) + (doc.title.includes(word) ? 2 : 0);
      }
    }
    if (!matched.length && (lexical < 2 || (intent.length && !broaden))) return null;
    let score = lexical + matched.length * 18;
    if (tags(`${t.label} ${t.shortcut}`).some(name => intent.includes(name))) score += 24;
    if (tags(t.shortcut).some(name => intent.includes(name))) score += 24;
    if (intent.some(name => ['deposit', 'withdrawal'].includes(name)) && /finans/.test(normalize(t.shortcut))) score += 40;
    if (matched.length) score -= Math.max(0, profile.primary.length - matched.length) * 5;
    if (profile.guarded) score -= phase === 'repeat' ? 0 : 8;
    if (phase === 'repeat' && profile.singleUse) score += 22;
    if (phase === 'conditions' && profile.conditions.length) score += 10;
    if (phase === 'request' && profile.conditions.length && !profile.guarded) score += 10;
    if (phase === 'missing' && profile.stage === 'missing') score += 8;
    if (profile.asksId && !hasId && /sorun|hata|sonuc|yanlis|eksik/.test(q)) score += 10;
    if (broaden && !matched.length) score -= 12;
    if (score <= 0) return null;
    return {...t, score, profile};
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return {items, context, intent, phase, scanned: index.count};
}
export function candidateBatch(retrieval, offset = 0) { return retrieval.items.slice(offset, offset + 12); }
export function evidenceSnippet(t, max = 220) {
  const parts = sentences(t.text);
  const evidence = [...new Set([parts[0], ...(t.profile?.conditions || [])])].filter(Boolean);
  return evidence.join(' ').slice(0, max);
}
