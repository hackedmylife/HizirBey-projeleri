export const normalize = (s) => String(s || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
const stop = new Set('bir bu ben bana benim sen siz sizin beni bunu bana icin ile ve de da mi mu ne nasil lutfen istiyorum rica ederim bey hanim'.split(' '));
export const tokens = (s) => [...new Set(normalize(s).match(/[a-z0-9]{3,}/g) || [])].filter((t) => !stop.has(t));
export function needsConfirmation(text) {
  return /(?:ilettim|iletilmistir|aktariyorum|aktarildi|aktarilmistir|tanimlanmistir|tanimladim|eklenmistir|ekledim|kaldirildi|kaldirilmistir|aktif hale gel|kontrol sagladigimda|kontrol ettigimde|goruntulemekteyim|gormekteyim|yararlanmis|yararlandiginiz|hakkiniz (?:mevcut degil|bulunmuyor)|minimum yatirim tutarini karsilamadiginiz|mail adresiniz guncel|incelemenin devam ettigi|hesabinizda .*engel|hesabinizda bahis duzeltmesi|tarafiniza tanimlidir|tarafiniza tanimlanmis|yeterli yatiriminiz mevcuttur|bu bonusu son alisinizdan)/.test(normalize(text)) || /\b\d{1,2}[/.]\d{1,2}[/.]20\d{2}\b/.test(text);
}
export function parseFastKeys(source) {
  if (typeof source !== 'string' || source.length > 8_000_000) throw new Error('Dosya çok büyük veya metin biçiminde değil.');
  const records = [];
  let current = null;
  for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (/^[01]•/.test(line)) { if (current) records.push(current); current = line; }
    else if (/^[∟‼→]$/.test(line)) { if (current) records.push(current); current = null; }
    else if (current) current += '\n' + line;
  }
  if (current) records.push(current);
  const stats = {records: records.length, disabled: 0, commands: 0, interactive: 0, unsupported: 0, duplicates: 0};
  const templates = [], seen = new Set();
  for (const record of records) {
    const f = record.split('•');
    // Main Text Expander records: 7 fields; keyboard shortcuts: 9 fields.
    const shape = f.length === 7 ? {label: 2, type: 3, body: 4} : f.length === 9 ? {label: 3, type: 4, body: 5} : null;
    if (!shape) { stats.unsupported++; continue; }
    if (f[0] !== '1') { stats.disabled++; continue; }
    if (f[shape.type] !== 'Send') { stats.commands++; continue; }
    const raw = f[shape.body];
    const plain = raw.includes('♥') ? raw.slice(raw.lastIndexOf('♥') + 1) : raw;
    if (/\{\\rtf|%[A-Z][A-Z0-9_]*|[▬]|\{[^{}]*\}/i.test(plain) || /\b(?:Sleep|MouseMove|Send,)\b/.test(plain)) { stats.interactive++; continue; }
    const text = plain.replace(/¶/g, '\n').trim();
    if (!text || text.length > 12000) { stats.unsupported++; continue; }
    if (seen.has(text)) { stats.duplicates++; continue; }
    seen.add(text);
    templates.push({id: `t${templates.length}`, shortcut: f[1], label: f[shape.label].trim(), text, guarded: needsConfirmation(text)});
  }
  if (!templates.length) throw new Error('Kullanılabilir düz metin kalıbı bulunamadı.');
  return {templates, stats};
}
const domains = [
  ['finans', /yatir|cekim|para.*gel|havale|odeme/, /finans|yatir|cekim/],
  ['giris', /girem|giris|bloke|sifre|ip\b|sms/, /giris|bloke|sifre|ip\b|sms/],
  ['spor', /kupon|bahis|mac|spor|skor/, /kupon|bahis|spor|skor/],
  ['casino', /oyun|casino|slot|tur\b|aviator/, /oyun|casino|slot|tur\b|aviator/],
  ['bonus', /bonus|promosyon|freespin|discount/, /bonus|promosyon|freespin|discount/]
];
export function requestContext(messages) {
  const userMessages = messages.filter((m) => m.role === 'user');
  const meaningful = userMessages.filter((m) => {
    const text = normalize(m.text).trim();
    return !/^(?:bekliyorum|hala bekliyorum|tamam|peki|evet|tesekkur(?:ler| ederim)?|ok|okey|merhaba(?:lar)?|selam(?:lar)?|haba|kolay gelsin|iyi (?:gunler|aksamlar)|ilgilenecek misiniz|ilgilenir misiniz|orada misiniz)[,.!?\s]*$/.test(text)
      && !/^(?:kullanici\s*(?:adim|adi)|kullanici\s*ismim|nick(?:im)?|username)\b/.test(text);
  });
  const topic = /sms.*(?:bonus|promosyon)|(?:bonus|promosyon).*sms|jest|geri\s*don.*bonus|kupon|bahis|sifre|parola|girem|yatirim\w*\s*(?:gel|gec|sorun)|cekim\w*\s*(?:talep|gel|gec|sorun|ist)|para.*(?:cek|gel|yatir)|telefon|e.?posta|kimlik|hesap.*kapat|oyun.*(?:sorun|id)/;
  const anchor = meaningful.findLastIndex((m) => topic.test(normalize(m.text)));
  return meaningful.slice(anchor < 0 ? -2 : anchor).slice(-4).map((m) => m.text).join(' ');
}
export function smsIntent(messages) {
  const text = normalize(requestContext(messages));
  if (!/sms/.test(text) || !/bonus|promosyon/.test(text)) return null;
  if (/geri\s*don|geridon|30\s*gun/.test(text)) return null;
  const repeat = /(?:\b2\s*\.(?!\d)|\b2\s*(?:defa|kez)|ikinci|bir daha|tekrar|yeniden|daha once.*(?:aldim|almistim|kullandim))/.test(text);
  return {repeat, text};
}
export function templatePolicy(t) {
  const text = normalize(t.text), title = normalize(`${t.label} ${t.shortcut}`);
  const otherBonus = /geri\s*don|geridon|30\s*gun|kayip|jest|discount|yatirim bonus/.test(title)
    || /^(?:geri\s*don|kayip bonus)/.test(text.trim());
  const smsBonus = !otherBonus && (/sms(?:\s*(?:aktif|aktivasyon|dogrulama))?\s*(?:bonus|promosyon)|sms\s*dogrulama promosyon|smsicerik|smsbonus|smsyok|smsvar/.test(`${title} ${text}`));
  const singleUse = /(?:yalnizca|sadece)\s*(?:1\s*(?:\(bir\))?|bir)\s*(?:defa|kez|kere)/.test(text);
  const repeated = smsBonus && /daha once.*(?:almis|yararlan|kullan)|yeniden tanimlama saglanama/.test(text) && !/silinmistir|48 saat/.test(text);
  return {smsBonus, singleUse, repeated};
}
export function selectSmsPolicy(ranked, messages) {
  const intent = smsIntent(messages);
  if (!intent) return null;
  const policies = ranked.filter((t) => templatePolicy(t).smsBonus);
  const general = policies.find((t) => templatePolicy(t).singleUse && !t.guarded);
  if (intent.repeat) {
    const repeated = policies.find((t) => templatePolicy(t).repeated);
    const items = [repeated, general].filter(Boolean);
    return {items, mode: 'local', notice: items.length
      ? 'İkinci SMS bonusu talebi: arşivdeki tek kullanım şartı esas alındı. Hesap geçmişi doğrulanmadı; önceki kullanım iddiası içeren metni kontrol edip onaylamadan kopyalama.'
      : 'İkinci SMS bonusu talebi anlaşıldı; arşivde uygun tek kullanım kalıbı bulunamadı.'};
  }
  // General eligibility is distinct from a claimed account outcome.
  if (general && !/gelmedi|eklenmedi|tanimlanmadi|silin|iptal/.test(intent.text)) return {
    items: [general], mode: 'local', notice: 'SMS bonusu talebi için arşivdeki genel koşullar seçildi. Geri dönüş bonusu ayrı bir promosyondur; hesap uygunluğu veya bonus tanımlaması doğrulanmış değildir.'
  };
  return null;
}
export function rankTemplates(templates, messages, query = '') {
  const userMessages = messages.filter((m) => m.role === 'user');
  const latest = query || requestContext(messages);
  const q = normalize(latest), words = tokens(latest);
  const sms = query ? null : smsIntent(messages);
  const used = new Set(messages.filter((m) => m.role === 'agent' || m.role === 'bot').map((m) => m.text.trim()));
  const hasAgent = messages.some((m) => m.role === 'agent');
  const hasWait = messages.some((m) => ['agent', 'bot'].includes(m.role) && /kontrol ediyorum|beklemenizi|bekletecegim/.test(normalize(m.text)));
  return templates.map((t) => {
    // Existing imported catalogs also receive updated assertion checks.
    t = {...t, guarded: Boolean(t.guarded) || needsConfirmation(t.text)};
    const hay = normalize(`${t.label} ${t.shortcut} ${t.text}`), label = normalize(`${t.label} ${t.shortcut}`);
    const policy = templatePolicy(t);
    let score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0) + (label.includes(w) ? 2 : 0), 0);
    if (!query) {
      if (sms && /bonus|promosyon|freespin/.test(hay) && !policy.smsBonus) return {...t, score: -100};
      if (sms && !policy.smsBonus && /sms/.test(hay)) return {...t, score: -100};
      // A general bonus mention is insufficient evidence for a specific promotion.
      if (/sms|telefon dogrulama/.test(hay) && !/sms|telefon|dogrulama/.test(q)) return {...t, score: -100};
      if (/jest/.test(q) && /bonus|promosyon|freespin/.test(hay) && !/jest/.test(hay)) return {...t, score: -100};
    }
    for (const [, input, output] of domains) if (input.test(q) && output.test(hay)) score += 3;
    if (/sms/.test(q) && /sms/.test(hay)) score += 4;
    if (/bonus/.test(q) && /bonus/.test(hay)) score += 3;
    if (sms && policy.smsBonus) {
      score += 20;
      if (policy.singleUse && !t.guarded) score += 25;
      if (sms.repeat && policy.repeated) score += 50;
    }
    if (/ip\b/.test(q) && /ip\b/.test(hay)) score += 5;
    if (/sifre/.test(q) && /sifre/.test(hay)) score += 5;
    if (used.has(t.text.trim())) score = -100;
    if (!query && hasAgent && /merhaba|hos geldiniz/.test(hay)) score = -100;
    if (!query && hasWait && /kontrol ediyorum|beklemenizi|bekletecegim/.test(hay)) score = -100;
    if (!query && !hasWait && /kontrol ediyorum/.test(hay) && userMessages.length) score += 5;
    return {...t, score};
  }).filter((t) => t.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function cleanMessages(messages) {
  if (!Array.isArray(messages)) throw new Error('Görüşme okunamadı.');
  return messages.slice(-20).filter((m) => m && ['user', 'agent', 'bot', 'system'].includes(m.role) && typeof m.text === 'string').map((m) => ({role: m.role, text: m.text.slice(0, 1800).replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[e-posta]').replace(/\b\d{8,}\b/g, '[numara]').replace(/https?:\/\/\S+/g, '[bağlantı]')}));
}
