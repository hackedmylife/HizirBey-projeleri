import {MAX_BYTES, MAX_EXAMPLES} from './learning.js';
import {MAX_BACKUP_BYTES} from './backup.js';

const $ = id => document.getElementById(id);
const providers = ['groq', 'gemini', 'openrouter'];
const orders = {groq: ['groq', 'gemini', 'openrouter'], gemini: ['gemini', 'groq', 'openrouter'], openrouter: ['openrouter', 'groq', 'gemini']};
const ask = async message => {const r = await chrome.runtime.sendMessage(message); if (!r?.ok) throw new Error(r?.error || 'İşlem tamamlanamadı.'); return r.data;};
let learningDirty = false;
$('learningEnabled').onchange = () => {learningDirty = true;};
const status = text => {$('status').textContent = text;};
function progress(data) {
  const l = data.learning || {};
  if (data.learning && !learningDirty) $('learningEnabled').checked = l.enabled;
  $('learningInfo').textContent = `${l.enabled ? 'Öğrenme açık' : 'Öğrenme durduruldu'} · ${l.count || 0} örnek\n${l.automatic || 0} otomatik, ${l.corrected || 0} düzeltilmiş, ${l.approved || 0} onaylı · ${l.rejected || 0} uygun bulunmayan yanıt`;
  const used = Number(l.usedBytes) || 0, max = Number(l.maxBytes) || MAX_BYTES;
  const format = value => (value / 1000000).toLocaleString('tr-TR', {maximumFractionDigits: 2});
  $('memoryUsage').max = max; $('memoryUsage').value = Math.min(max, used);
  $('memoryUsage').setAttribute('aria-label', `Öğrenme hafızası: ${format(used)} / ${format(max)} MB`);
  $('memoryCapacity').textContent = `${format(used)} / ${format(max)} MB · ${(l.count || 0).toLocaleString('tr-TR')} / ${(l.maxExamples || MAX_EXAMPLES).toLocaleString('tr-TR')} örnek`;
  $('memoryNotice').hidden = !l.nearCapacity;
  const k = data.knowledge || {};
  if (data.knowledge) $('knowledge').textContent = (data.useFastKeys ?? data.settings?.useFastKeys) === false ? 'FastKeys otomatik yanıtlarda kapalı. Yanıtlar görüşme ve öğrenilmiş örnekler üzerinden hazırlanır; arşiv için AI analizi yapılmaz.' : k.total ? `${k.total} metin bilgi tabanında · AI analizi ${k.done}/${k.total}${k.done === k.total ? ' · Tamamlandı' : data.aiEnabled === false || data.settings?.aiEnabled === false ? ' · AI kapalı; analiz bekliyor' : ' · Arka planda devam ediyor'}${k.error ? `\n${k.error}` : ''}` : 'Arşiv yüklenmedi. Genel destek yanıtları kullanılabilir.';
  for (const p of data.providers || []) {
    const names = {credentials: 'Anahtarı kontrol et', configuration: 'Modeli kontrol et', budget: 'Aylık sınırı kontrol et', credit: 'Kredi sınırı', quota: 'Diğer bağlantılar kullanılabilir', timeout: 'Yanıt bekleniyor', quality: 'Yanıt kontrolü', connection: 'Bağlantıyı kontrol et'};
    $(`${p.id}State`).textContent = !p.enabled ? 'Kapalı' : !p.hasKey ? 'Anahtar bekleniyor' : p.error ? names[p.error] || 'Kontrol gerekli' : p.waitMs > 0 ? 'Hazırlanıyor' : 'Kullanılabilir';
  }
}
async function load() {
  const data = await ask({type: 'getSettings'}), config = data.settings;
  $('extensionId').textContent = data.extensionId;
  $('aiEnabled').checked = config.aiEnabled; $('autoSync').checked = config.autoSync;
  $('useFastKeys').checked = config.useFastKeys;
  $('primaryProvider').value = config.providerOrder[0];
  learningDirty = false; $('learningEnabled').checked = config.learningEnabled; $('useExamples').checked = config.useExamples;
  $('allowPaid').checked = config.allowPaid; $('monthlyBudget').value = config.monthlyBudget;
  for (const id of providers) {
    const p = config.providers[id];
    $(`${id}Enabled`).checked = p.enabled; $(`${id}Model`).value = p.model;
    $(`${id}Key`).placeholder = p.hasKey ? 'Anahtar kayıtlı. Korumak için boş bırak.' : 'API anahtarını gir';
  }
  const c = data.catalog;
  $('catalog').textContent = c.templates.length ? `${c.templates.length} benzersiz düz metin\nKaynak: ${c.source}\nGüncelleme: ${new Date(c.updatedAt).toLocaleString('tr-TR')}\nElendi: ${c.stats.commands || 0} komut, ${c.stats.interactive || 0} etkileşimli, ${c.stats.disabled || 0} devre dışı, ${c.stats.duplicates || 0} tekrar.` : 'Arşiv yüklenmedi.';
  progress(data);
}
$('file').onchange = async () => {
  const file = $('file').files[0]; if (!file) return;
  try {
    if (file.size > 8_000_000) throw new Error('Dosya 8 MB sınırından büyük.');
    await ask({type: 'import', text: new TextDecoder('utf-8', {fatal: true}).decode(await file.arrayBuffer()), name: file.name});
    await load(); status('Bilgi tabanı kaydedildi. Yapay zekâ açıksa arşiv analizi arka planda devam eder.');
  } catch (error) {status(error.message);}
};
$('save').onclick = async () => {
  $('save').disabled = true;
  try {
    const connections = Object.fromEntries(providers.map(id => [id, {enabled: $(`${id}Enabled`).checked, model: $(`${id}Model`).value, apiKey: $(`${id}Key`).value, clearKey: $(`${id}Clear`).checked}]));
    await ask({type: 'saveSettings', settings: {aiEnabled: $('aiEnabled').checked, autoSync: $('autoSync').checked, useFastKeys: $('useFastKeys').checked, learningEnabled: $('learningEnabled').checked, useExamples: $('useExamples').checked, providerOrder: orders[$('primaryProvider').value], providers: connections, allowPaid: $('allowPaid').checked, monthlyBudget: Number($('monthlyBudget').value)}});
    for (const id of providers) {$(`${id}Key`).value = ''; $(`${id}Clear`).checked = false;}
    await load(); status('Ayarlar kaydedildi. LiveChat paneli yeni ayarlarla devam edecek.');
  } catch (error) {status(error.message);} finally {$('save').disabled = false;}
};
$('sync').onclick = async () => {
  try {status('FastKeys dosyası kontrol ediliyor…'); await ask({type: 'sync'}); await load(); status('FastKeys bağlantısı çalışıyor. Otomatik takibi açıp ayarları kaydet.');}
  catch (error) {status(`Bağlantı kurulamadı: ${error.message}\nWindows yardımcısını kontrol et veya dosyayı içe aktar.`);}
};
$('copyId').onclick = async () => {try {await navigator.clipboard.writeText($('extensionId').textContent); status('Eklenti kimliği kopyalandı.');} catch {status('Kimliği seçip Ctrl+C ile kopyala.');}};
for (const button of document.querySelectorAll('[data-test]')) button.onclick = async () => {
  button.disabled = true;
  try {status('Kaydedilmiş bağlantı deneniyor…'); const result = await ask({type: 'testProvider', provider: button.dataset.test}); status(result.notice);}
  catch (error) {status(error.message);} finally {button.disabled = false;}
};
let exampleOffset = 0;
async function showExamples() {
  const data = await ask({type: 'getLearning', offset: exampleOffset});
  $('examples').replaceChildren();
  if (!data.examples.length) {const p = document.createElement('p'); p.textContent = 'Henüz kaydedilmiş örnek yok.'; $('examples').append(p);}
  for (const sample of data.examples) {
    const card = document.createElement('article'); card.className = 'example';
    const title = document.createElement('small'); title.textContent = `${({automatic:'Otomatik', correction:'Düzeltilmiş', approved:'Onaylı'})[sample.origin]} · ${new Date(sample.updatedAt).toLocaleString('tr-TR')}`;
    const context = document.createElement('p'); context.textContent = sample.request;
    const conversation = document.createElement('details'); conversation.className = 'example-context';
    const summary = document.createElement('summary'); summary.textContent = 'Üye mesajları ve konuşma bağlamı';
    conversation.append(summary);
    for (const message of sample.context || []) {
      const row = document.createElement('p');
      const role = document.createElement('strong'); role.textContent = message.role === 'user' ? 'Üye: ' : 'Temsilci: ';
      row.append(role, document.createTextNode(message.text)); conversation.append(row);
    }
    const answerLabel = document.createElement('small'); answerLabel.textContent = 'Öğrenilen temsilci yanıtı';
    const text = document.createElement('div'); text.className = 'example-text'; text.textContent = sample.response;
    const remove = document.createElement('button'); remove.textContent = 'Örneği sil';
    remove.onclick = async () => {remove.disabled = true; try {await ask({type:'deleteExample', id: sample.id}); await showExamples();} catch (error) {status(error.message); remove.disabled = false;}};
    card.append(title, context, conversation, answerLabel, text, remove); $('examples').append(card);
  }
  $('previousExamples').hidden = exampleOffset === 0; $('nextExamples').hidden = !data.hasMore;
  progress({learning: data.learning});
}
$('refreshExamples').onclick = () => {exampleOffset = 0; showExamples().catch(error => status(error.message));};
$('previousExamples').onclick = () => {exampleOffset = Math.max(0, exampleOffset - 20); showExamples().catch(error => status(error.message));};
$('nextExamples').onclick = () => {exampleOffset += 20; showExamples().catch(error => status(error.message));};
$('clearExamples').onclick = async () => {
  if (!confirm('Kaydedilmiş yanıt örnekleri ve beğenilmeyen yanıt kayıtları silinsin mi?')) return;
  try {await ask({type:'clearLearning'}); exampleOffset = 0; await showExamples(); status('Örnek hafızası temizlendi. Yeni mesajlarla yeniden örnek toplanabilir.');}
  catch (error) {status(error.message);}
};
$('exportLearning').onclick = async () => {
  $('exportLearning').disabled = true;
  try {
    const data = await ask({type: 'exportLearning'});
    const blob = new Blob([JSON.stringify(data.backup, null, 2)], {type: 'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    link.href = url; link.download = `HizirBey-Ogrenme-Yedegi-${stamp}.json`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('backupStatus').textContent = `${data.learning.count} yanıt örneği için yedek indirme başlatıldı. Düzeltmeler, olumsuz örnekler ve silinmiş örnek kimlikleri de dahil.`;
  } catch (error) {$('backupStatus').textContent = error.message;}
  finally {$('exportLearning').disabled = false;}
};
$('backupFile').onchange = () => {
  const file = $('backupFile').files[0]; $('importLearning').disabled = !file;
  $('backupStatus').textContent = file ? `${file.name} seçildi. Birleştirerek yükle ile mevcut örneklere ekleyebilirsin.` : '';
};
$('importLearning').onclick = async () => {
  const file = $('backupFile').files[0]; if (!file) return;
  $('importLearning').disabled = true;
  $('backupStatus').textContent = 'Yedek kontrol ediliyor ve mevcut kayıtlarla birleştiriliyor…';
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Öğrenme yedeği en fazla 25 MB olabilir.');
    const result = await ask({type: 'importLearning', text: await file.text()});
    exampleOffset = 0; await showExamples();
    $('backupStatus').textContent = `Yedek birleştirildi: ${result.added} yeni yanıt ve ${result.rejectedAdded} olumsuz örnek eklendi. Toplam ${result.learning.count} yanıt örneği.`;
    $('backupFile').value = '';
  } catch (error) {$('backupStatus').textContent = error.message; $('importLearning').disabled = false;}
};
setInterval(async () => {if (!document.hidden) {try {progress(await ask({type: 'status'}));} catch { /* retain last status */ }}}, 10000);
load().catch(error => status(error.message));

