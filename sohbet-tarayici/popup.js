const status = document.getElementById('status');
const enabled = document.getElementById('enabled');
const scanButton = document.getElementById('scan');
let tabId;
async function refresh() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    const result = await chrome.tabs.sendMessage(tabId, { type: 'status' });
    scanButton.disabled = !result.listFound || !enabled.checked;
    status.textContent = result.listFound
      ? `Sohbet listesi bulundu. Şu an ${result.count} sohbet 2 dakika veya üzerinde.${result.soundError ? ' Ses hatası: ' + result.soundError : ''}`
      : 'LiveChat sohbet listesi görünmüyor. Chats bölümünü aç.';
  } catch {
    scanButton.disabled = true;
    status.textContent = 'LiveChat sekmesini aç. Yeni kurduysan sayfayı bir kez yenile. Desteklenen adresler: livechat.com ve livechatinc.com.';
  }
}
enabled.addEventListener('change', async () => {
  await chrome.storage.local.set({ enabled: enabled.checked });
  await refresh();
});
scanButton.addEventListener('click', async () => {
  scanButton.disabled = true;
  try {
    const result = await chrome.tabs.sendMessage(tabId, { type: 'scan-now' });
    status.textContent = result.soundError ? `Ses hatası: ${result.soundError}` : `Kontrol tamamlandı: ${result.count} eşleşme.`;
  } catch { status.textContent = 'Sayfa bağlantısı kesildi. LiveChat sayfasını yenile.'; }
  scanButton.disabled = !enabled.checked;
});
document.getElementById('sound').addEventListener('click', async () => {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'play-alert' });
    status.textContent = result?.ok ? 'Test sesi çalındı.' : `Ses hatası: ${result?.error || 'Bilinmeyen hata'}`;
  } catch (error) { status.textContent = `Ses hatası: ${error.message}`; }
});
chrome.storage.local.get({ enabled: true }).then(async (settings) => {
  enabled.checked = settings.enabled;
  await refresh();
});
