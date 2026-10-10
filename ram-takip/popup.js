const status = document.getElementById('status');
const start = document.getElementById('start');
const site = document.getElementById('site');
const all = document.getElementById('all');
async function render() {
  const response = await chrome.runtime.sendMessage({action: 'status'});
  if (!response.ok) throw new Error(response.error);
  const list = document.getElementById('list');
  document.getElementById('api').textContent = response.memoryAvailable ? 'Süreç RAM API erişimi açık.' : 'RAM erişimi kapalı: Chrome’u kapatıp Chrome-RAM-Modu.cmd ile açın ve eklentiyi yeniden yükleyin.';
  list.replaceChildren();
  status.textContent = response.globalMode ? 'Tüm sekmeler modu açık. Yeni web sekmeleri de otomatik eklenir.' : response.watches.length ? 'Sekmeler birbirinden bağımsız izlenir.' : 'İzlemek istediğiniz sekmede başlatın.';
  for (const w of response.watches) {
    const row = document.createElement('section');
    const title = document.createElement('b');
    title.textContent = w.title || w.origin;
    const detail = document.createElement('small');
    detail.textContent = w.origin + ' · ' + (Number.isFinite(w.bytes) ? Math.round(w.bytes / 1_000_000) + ' MB' : '—') + (w.pid !== undefined ? ' · Süreç: ' + w.pid : '') + ' · Geçiş: ' + (w.swaps || 0);
    const info = document.createElement('p');
    info.textContent = w.message;
    row.append(title, detail, info);
    if (w.enabled) {
      const button = document.createElement('button');
      button.className = 'secondary';
      button.textContent = 'Bu sekmeyi durdur';
      button.addEventListener('click', async () => {
        try { await chrome.runtime.sendMessage({action: 'stop', key: w.key}); await render(); }
        catch (error) { status.textContent = error.message; }
      });
      row.append(button);
    }
    list.append(row);
  }
}
async function enable(action) {
  start.disabled = site.disabled = all.disabled = true;
  try {
    if (action === 'startAll') {
      const result = await chrome.runtime.sendMessage({action});
      if (!result.ok) throw new Error(result.error);
      await render();
      return;
    }
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const url = new URL(tab.url);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('İzlemek istediğiniz web sayfasını açın.');
    const result = await chrome.runtime.sendMessage({action, tabId: tab.id});
    if (!result.ok) throw new Error(result.error);
    await render();
  } catch (error) { status.textContent = error.message; }
  finally { start.disabled = site.disabled = all.disabled = false; }
}
all.addEventListener('click', () => enable('startAll'));
start.addEventListener('click', () => enable('start'));
site.addEventListener('click', () => enable('startSite'));
document.getElementById('stop').addEventListener('click', async () => {
  try { await chrome.runtime.sendMessage({action: 'stopAll'}); await render(); }
  catch (error) { status.textContent = error.message; }
});
render().catch(error => { status.textContent = error.message; });
