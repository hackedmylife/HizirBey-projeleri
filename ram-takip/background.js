const LIMIT = 500_000_000;
function requireMemoryAPI() {
  if (!chrome.processes?.getProcessIdForTab || !chrome.processes?.getProcessInfo) {
    throw new Error('Gerçek RAM erişimi kapalı. Chrome’u tamamen kapatıp Chrome-RAM-Modu.cmd ile açın; eklentiyi yeniden yükleyin.');
  }
}
async function readMemory(tabId) {
  requireMemoryAPI();
  const pid = await chrome.processes.getProcessIdForTab(tabId);
  const info = await chrome.processes.getProcessInfo([pid], true);
  const process = info[String(pid)];
  if (!process || !Number.isFinite(process.privateMemory) || process.privateMemory <= 0) {
    throw new Error('Chrome bu sekmenin süreç RAM değerini vermedi.');
  }
  return {bytes: process.privateMemory, pid};
}
let queue = Promise.resolve();
function serial(task) {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}
async function state() {
  return (await chrome.storage.session.get('watches')).watches || [];
}
async function badge() {
  const watches = await state();
  const count = watches.filter(w => w.enabled).length;
  await chrome.action.setBadgeText({text: count ? String(count) : ''});
}
async function save(watch) {
  const watches = await state();
  const index = watches.findIndex(w => w.key === watch.key);
  if (index < 0) watches.push(watch); else watches[index] = watch;
  await chrome.storage.session.set({watches});
}
async function fail(watch, message) {
  await save({...watch, enabled: false, pending: null, message});
  await badge();
}
async function finish(watch) {
  const pending = watch.pending;
  let fresh;
  try { fresh = await chrome.tabs.get(pending.newId); }
  catch { return fail(watch, 'Yeni sekme kapandı. Eski sekme korundu; yeniden başlatın.'); }
  if (fresh.status !== 'complete') {
    if (Date.now() - pending.started > 90_000) {
      await fail(watch, 'Yeni sekme 90 saniyede yüklenmedi. Eski sekme korundu.');
    }
    return;
  }
  let old;
  try { old = await chrome.tabs.get(pending.oldId); } catch { old = null; }
  // Closing a tab after the user navigated elsewhere would lose unrelated work.
  if (old && old.url !== pending.url) {
    return fail(watch, 'Eski sekmenin adresi değişti; otomatik kapatma iptal edildi.');
  }
  if (!fresh.url || new URL(fresh.url).origin !== watch.origin) {
    return fail(watch, 'Yeni sekme başka bir siteye yönlendi. Eski sekme korundu.');
  }
  try {
    if (old?.active) await chrome.tabs.update(fresh.id, {active: true});
    if (old) await chrome.tabs.remove(old.id);
    await save({...watch, tabId: fresh.id, pending: null, bytes: null,
      cooldownUntil: Date.now() + 300_000, swaps: (watch.swaps || 0) + 1,
      message: 'Geçiş tamamlandı. Beş dakika bekleme süresi.'});
    await badge();
  } catch {
    await fail(watch, 'Sekme değişimi tamamlanamadı. Sekmeleri kontrol edip yeniden başlatın.');
  }
}
async function inspectWatch(watch) {
  if (!watch.enabled) return;
  if (watch.pending) return finish(watch);
  let tab;
  try { tab = await chrome.tabs.get(watch.tabId); }
  catch { return fail(watch, 'İzlenen sekme kapandı.'); }
  if (!tab.url || new URL(tab.url).origin !== watch.origin) {
    return fail(watch, 'İzlenen sekme başka siteye geçti. İzleme durduruldu.');
  }
  if (tab.status !== 'complete' || tab.discarded) return;
  try {
    const {bytes, pid} = await readMemory(tab.id);
    const cooldowns = (await chrome.storage.session.get('processCooldowns')).processCooldowns || {};
    const next = {...watch, bytes, pid, checkedAt: Date.now(),
      message: Date.now() < Math.max(watch.cooldownUntil || 0, cooldowns[String(pid)] || 0) ? 'Geçiş sonrası bekleme süresi.' : 'İzleme açık.'};
    await save(next);
    
    if (bytes < LIMIT || Date.now() < Math.max(watch.cooldownUntil || 0, cooldowns[String(pid)] || 0)) return;
    const fresh = await chrome.tabs.create({url: tab.url, windowId: tab.windowId,
      index: tab.index + 1, active: false, pinned: tab.pinned});
    const pending = {oldId: tab.id, newId: fresh.id, url: tab.url, started: Date.now()};
    const swapping = {...next, pending, message: 'Yeni sekmenin yüklenmesi bekleniyor.'};
    await save(swapping);
    await chrome.storage.session.set({processCooldowns: {...cooldowns, [String(pid)]: Date.now() + 300_000}});
    // Covers completion events that happened before the pending record was stored.
    await finish(swapping);
  } catch (error) {
    await fail(watch, error.message || 'RAM ölçümü başarısız. Eski sekme korundu.');
  }
}
async function globalMode() {
  return Boolean((await chrome.storage.session.get('globalMode')).globalMode);
}
async function syncTabs() {
  if (!(await globalMode())) return;
  for (const tab of await chrome.tabs.query({})) {
    if (!tab.url || !/^https?:\/\//.test(tab.url)) continue;
    const watches = await state();
    const current = watches.find(w => w.tabId === tab.id || w.pending?.newId === tab.id);
    // Paused/failed tabs stay paused, and replacement tabs never become a second watcher.
    if (current?.pending || (current && !current.enabled)) continue;
    if (current?.origin === new URL(tab.url).origin) continue;
    try { await startTab(tab); } catch { /* Restricted pages cannot be enrolled. */ }
  }
}
async function inspect() {
  await syncTabs();
  for (const watch of await state()) await inspectWatch(watch);
  await badge();
}
async function startTab(tab) {
  const url = new URL(tab.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Bir web sayfası seçin.');
  requireMemoryAPI();
  const current = (await state()).find(w => w.tabId === tab.id || w.pending?.newId === tab.id);
  if (current?.pending) return;
  if (current?.enabled && current.origin === url.origin) return;
  await save({key: current?.key || String(tab.id), enabled: true, tabId: tab.id,
    origin: url.origin, title: tab.title || url.hostname, swaps: current?.swaps || 0,
    message: 'İzleme açık.'});
}
chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  serial(async () => {
    if (message.action === 'startAll') {
      requireMemoryAPI();
      // Explicitly starting all also resumes previously paused watches.
      for (const w of await state()) {
        if (!w.pending) {
          try { await startTab(await chrome.tabs.get(w.tabId)); } catch { /* Closed tab. */ }
        }
      }
      await chrome.storage.session.set({globalMode: true});
      await chrome.alarms.create('memory-check', {periodInMinutes: 0.5});
      await inspect();
    } else if (message.action === 'start' || message.action === 'startSite') {
      const tab = await chrome.tabs.get(message.tabId);
      if (message.action === 'startSite') {
        const origin = new URL(tab.url).origin;
        for (const candidate of await chrome.tabs.query({})) {
          if (candidate.url && new URL(candidate.url).origin === origin) await startTab(candidate);
        }
      } else await startTab(tab);
      await chrome.alarms.create('memory-check', {periodInMinutes: 0.5});
      await inspect();
    } else if (message.action === 'stop' || message.action === 'stopAll') {
      if (message.action === 'stopAll') await chrome.storage.session.set({globalMode: false});
      for (const watch of await state()) {
        if (message.action === 'stopAll' || watch.key === message.key) {
          await save({...watch, enabled: false, pending: null, message: 'İzleme durduruldu.'});
        }
      }
      await badge();
      if (!(await globalMode()) && !(await state()).some(w => w.enabled)) await chrome.alarms.clear('memory-check');
    }
    reply({ok: true, watches: await state(), globalMode: await globalMode(), memoryAvailable: Boolean(chrome.processes?.getProcessInfo)});
  }).catch(error => reply({ok: false, error: error.message}));
  return true;
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'memory-check') serial(inspect);
});
chrome.tabs.onUpdated.addListener((id, change) => {
  if (change.status === 'complete') serial(async () => {
    for (const watch of await state()) {
      if (watch.enabled && watch.pending?.newId === id) await finish(watch);
    }
    await syncTabs();
    await badge();
  });
});
chrome.runtime.onStartup.addListener(() => serial(async () => {
  await chrome.storage.session.clear();
  await chrome.action.setBadgeText({text: ''});
  await chrome.alarms.clear('memory-check');
}));
