const $ = id => document.getElementById(id);
const providers = ['groq', 'gemini', 'openrouter'];
const orders = {groq: ['groq', 'gemini', 'openrouter'], gemini: ['gemini', 'groq', 'openrouter'], openrouter: ['openrouter', 'groq', 'gemini']};
const ask = async message => {const r = await chrome.runtime.sendMessage(message); if (!r?.ok) throw new Error(r?.error || 'İşlem tamamlanamadı.'); return r.data;};
const status = text => {$('status').textContent = text;};
function progress(data) {
  const k = data.knowledge || {};
  $('knowledge').textContent = k.total ? `${k.total} metin bilgi tabanında · AI analizi ${k.done}/${k.total}${k.done === k.total ? ' · Tamamlandı' : data.aiEnabled === false || data.settings?.aiEnabled === false ? ' · AI kapalı; analiz bekliyor' : ' · Arka planda devam ediyor'}${k.error ? `\n${k.error}` : ''}` : 'Arşiv yüklenmedi. Genel destek yanıtları kullanılabilir.';
  for (const p of data.providers || []) {
    const names = {credentials: 'Anahtarı kontrol et', configuration: 'Modeli kontrol et', budget: 'Aylık sınırı kontrol et', credit: 'Kredi sınırı', quota: 'Diğer bağlantılar kullanılabilir', timeout: 'Yanıt bekleniyor', quality: 'Yanıt kontrolü', connection: 'Bağlantıyı kontrol et'};
    $(`${p.id}State`).textContent = !p.enabled ? 'Kapalı' : !p.hasKey ? 'Anahtar bekleniyor' : p.error ? names[p.error] || 'Kontrol gerekli' : p.waitMs > 0 ? 'Hazırlanıyor' : 'Kullanılabilir';
  }
}
async function load() {
  const data = await ask({type: 'getSettings'}), config = data.settings;
  $('extensionId').textContent = data.extensionId;
  $('aiEnabled').checked = config.aiEnabled; $('autoSync').checked = config.autoSync;
  $('primaryProvider').value = config.providerOrder[0];
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
    await ask({type: 'saveSettings', settings: {aiEnabled: $('aiEnabled').checked, autoSync: $('autoSync').checked, providerOrder: orders[$('primaryProvider').value], providers: connections, allowPaid: $('allowPaid').checked, monthlyBudget: Number($('monthlyBudget').value)}});
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
setInterval(async () => {if (!document.hidden) {try {progress(await ask({type: 'status'}));} catch { /* retain last status */ }}}, 10000);
load().catch(error => status(error.message));
