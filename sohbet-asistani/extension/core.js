export const normalize = (s) => String(s || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
const stop = new Set('bir bu ben bana benim sen siz sizin beni bunu bana icin ile ve de da mi mu ne nasil lutfen istiyorum rica ederim bey hanim'.split(' '));
export const tokens = (s) => [...new Set(normalize(s).match(/[a-z0-9]{3,}/g) || [])].filter((t) => !stop.has(t));
export function needsConfirmation(text) {
  return /(?:ilettim|iletilmistir|aktariyorum|aktarildi|aktarilmistir|tanimlanmistir|tanimladim|eklenmistir|ekledim|kaldirildi|kaldirilmistir|aktif hale gel|kontrol sagladigimda|kontrol ettigimde|goruntulemekteyim|yararlanmis|yararlandiginiz|hakkiniz (?:mevcut degil|bulunmuyor)|minimum yatirim tutarini karsilamadiginiz|mail adresiniz guncel|incelemenin devam ettigi|hesabinizda .*engel|hesabinizda bahis duzeltmesi)/.test(normalize(text)) || /\b\d{1,2}[/.]\d{1,2}[/.]20\d{2}\b/.test(text);
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
export function rankTemplates(templates, messages, query = '') {
  const userMessages = messages.filter((m) => m.role === 'user');
  // Short acknowledgements keep the most recent substantive request in scope.
  const meaningful = userMessages.filter((m) => !/^(?:bekliyorum|tamam|peki|evet|tesekkur.*|ok|okey|hala bekliyorum)[.!?\s]*$/.test(normalize(m.text).trim()));
  const latest = query || meaningful.slice(-2).map((m) => m.text).join(' ');
  const q = normalize(latest), words = tokens(latest);
  const used = new Set(messages.filter((m) => m.role === 'agent' || m.role === 'bot').map((m) => m.text.trim()));
  const hasAgent = messages.some((m) => m.role === 'agent');
  const hasWait = messages.some((m) => ['agent', 'bot'].includes(m.role) && /kontrol ediyorum|beklemenizi|bekletecegim/.test(normalize(m.text)));
  return templates.map((t) => {
    const hay = normalize(`${t.label} ${t.shortcut} ${t.text}`), label = normalize(`${t.label} ${t.shortcut}`);
    let score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0) + (label.includes(w) ? 2 : 0), 0);
    if (!query) {
      // A general bonus mention is insufficient evidence for a specific promotion.
      if (/sms|telefon dogrulama/.test(hay) && !/sms|telefon|dogrulama/.test(q)) return {...t, score: -100};
      if (/jest/.test(q) && /bonus|promosyon|freespin/.test(hay) && !/jest/.test(hay)) return {...t, score: -100};
    }
    for (const [, input, output] of domains) if (input.test(q) && output.test(hay)) score += 3;
    if (/sms/.test(q) && /sms/.test(hay)) score += 4;
    if (/bonus/.test(q) && /bonus/.test(hay)) score += 3;
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
