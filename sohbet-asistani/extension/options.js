const $ = (id) => document.getElementById(id);
const ask = async (message) => { const r = await chrome.runtime.sendMessage(message); if (!r?.ok) throw new Error(r?.error || 'İşlem tamamlanamadı.'); return r.data; };
function status(text) { $('status').textContent = text; }
async function load() {
  const data = await ask({type: 'getSettings'});
  $('extensionId').textContent = data.extensionId;
  $('aiEnabled').checked = data.settings.aiEnabled;
  $('autoSync').checked = data.settings.autoSync;
  $('model').value = data.settings.model;
  $('apiKey').placeholder = data.settings.apiKey ? 'Anahtar kayıtlı. Değiştirmek için yeni anahtar gir.' : 'Groq API anahtarını gir';
  const c = data.catalog;
  $('catalog').textContent = c.templates.length ? `${c.templates.length} benzersiz düz metin kalıbı\nKaynak: ${c.source}\nGüncelleme: ${new Date(c.updatedAt).toLocaleString('tr-TR')}\nElendi: ${c.stats.commands || 0} komut, ${c.stats.interactive || 0} etkileşimli kalıp, ${c.stats.disabled || 0} devre dışı, ${c.stats.duplicates || 0} tekrar.` : 'Arşiv yüklenmedi.';
}
$('file').onchange = async () => {
  const file = $('file').files[0]; if (!file) return;
  try {
    if (file.size > 8_000_000) throw new Error('Dosya 8 MB sınırından büyük.');
    const text = new TextDecoder('utf-8', {fatal: true}).decode(await file.arrayBuffer());
    await ask({type: 'import', text, name: file.name}); await load(); status('Cevap arşivi hazır. LiveChat sayfasında önerileri deneyebilirsin.');
  } catch (e) { status(e.message); }
};
$('save').onclick = async () => {
  try { await ask({type: 'saveSettings', settings: {aiEnabled: $('aiEnabled').checked, autoSync: $('autoSync').checked, apiKey: $('apiKey').value, clearKey: $('clearKey').checked, model: $('model').value}}); $('apiKey').value = ''; $('clearKey').checked = false; await load(); status('Ayarlar kaydedildi.'); }
  catch (e) { status(e.message); }
};
$('sync').onclick = async () => {
  try { status('FastKeys dosyası kontrol ediliyor…'); await ask({type: 'sync'}); await load(); status('FastKeys bağlantısı çalışıyor. Otomatik takibi açıp ayarları kaydet.'); }
  catch (e) { status(`Bağlantı kurulamadı: ${e.message}\nWindows yardımcısını kurduktan sonra tekrar dene. İçe aktarma yöntemi kullanılabilir.`); }
};
$('copyId').onclick = async () => { try { await navigator.clipboard.writeText($('extensionId').textContent); status('Eklenti kimliği kopyalandı.'); } catch { status('Kimliği seçip Ctrl+C ile kopyala.'); } };
load().catch((e) => status(e.message));
