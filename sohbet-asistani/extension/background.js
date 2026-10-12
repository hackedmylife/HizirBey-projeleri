import {parseFastKeys, rankTemplates, cleanMessages} from './core.js';
import {buildIndex} from './retrieval.js';
import {prepareKnowledge, knowledgeBatch, knowledgeProgress, KNOWLEDGE_SYSTEM, validateAnalysis} from './knowledge.js';
import {COMPOSER_SYSTEM, composeInput, validateReplies, localReplies} from './composer.js';
import {ProviderPool, PROVIDERS, NAMES, normalizeSettings, publicSettings, mergeSettings, isFreeRouter, verifyPaidKey} from './providers.js';
let revision = 0, catalogCache, knowledgeCache, knowledgeForCatalog, knowledgePromise, retrievalIndex;
let prepController, prepTimer, lastInteractionAt = 0, rateWrite = Promise.resolve();
const pending = new Map(), running = new Map();
const pool = new ProviderPool({persist: state => {
  rateWrite = rateWrite.catch(() => {}).then(() => chrome.storage.session?.set({providerRate: state}));
  return rateWrite;
}});
const rateReady = chrome.storage.session?.get(['providerRate', 'aiRate']).then(({providerRate, aiRate}) => pool.restore(providerRate || {groq: aiRate})).catch(() => {});
chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area && area !== 'local') return;
  if (changes.catalog) {catalogCache = undefined; knowledgeForCatalog = undefined; retrievalIndex = undefined;}
  if (changes.knowledge) {knowledgeCache = changes.knowledge.newValue; retrievalIndex = undefined;}
  if (changes.catalog || changes.settings) {
    revision++; pool.cache.cache.clear(); prepController?.abort();
    for (const controller of running.values()) controller.abort();
    if (changes.settings) for (const id of PROVIDERS) {
      if (pool.errors[id] && pool.errors[id] !== 'quota') {pool.controls[id].cooldownAt = 0; pool.errors[id] = '';}
    }
  }
});
const HOST = 'com.hizirbey.fastkeys';
let port, nativePending, nativeCounter = 0;
async function catalog() {
  if (!catalogCache) catalogCache = (await chrome.storage.local.get('catalog')).catalog || {templates: [], stats: {}};
  return catalogCache;
}
async function settings() { return normalizeSettings((await chrome.storage.local.get('settings')).settings); }
async function saveSource(text, source) {
  const parsed = parseFastKeys(text);
  const value = {...parsed, source, updatedAt: Date.now()};
  const previous = knowledgeCache || (await chrome.storage.local.get('knowledge')).knowledge;
  const prepared = await prepareKnowledge(value, previous);
  await chrome.storage.local.set({catalog: value, knowledge: prepared});
  catalogCache = value; knowledgeCache = prepared; knowledgeForCatalog = value;
  schedulePreparation(1000);
  return {count: value.templates.length, stats: value.stats, updatedAt: value.updatedAt, source};
}
function connectHost() {
  if (port) return;
  port = chrome.runtime.connectNative(HOST);
  port.onMessage.addListener((message) => {
    const p = nativePending;
    if (!p || message.id !== p.id) return;
    if (message.error) { p.reject(new Error(message.error)); return; }
    if (typeof message.data === 'string') p.chunks.push(message.data);
    if (message.done) p.resolve({...message, data: p.chunks.join('')});
  });
  port.onDisconnect.addListener(() => {
    const message = chrome.runtime.lastError?.message;
    port = undefined;
    nativePending?.reject(new Error(message || 'FastKeys bağlantısı kapandı.'));
  });
}
async function syncNative() {
  if (nativePending) return nativePending.promise;
  const stamp = (await chrome.storage.local.get('nativeStamp')).nativeStamp || '';
  const id = ++nativeCounter;
  let timer;
  const promise = new Promise((resolve, reject) => {
    nativePending = {id, chunks: [], resolve, reject};
    timer = setTimeout(() => { reject(new Error('FastKeys bağlantısı yanıt vermedi.')); port?.disconnect(); port = undefined; }, 12000);
    connectHost();
    port.postMessage({id, type: 'read', stamp});
  }).then(async (reply) => {
    if (reply.unchanged) return {unchanged: true};
    const bytes = Uint8Array.from(atob(reply.data), (c) => c.charCodeAt(0));
    const result = await saveSource(new TextDecoder('utf-8', {fatal: true}).decode(bytes), 'FastKeys otomatik bağlantı');
    await chrome.storage.local.set({nativeStamp: reply.stamp});
    return result;
  }).finally(() => { clearTimeout(timer); nativePending = undefined; });
  nativePending.promise = promise;
  return promise;
}
async function ensureKnowledge() {
  const c = await catalog();
  if (knowledgeForCatalog === c && knowledgeCache) return knowledgeCache;
  if (knowledgePromise) {await knowledgePromise; return ensureKnowledge();}
  knowledgePromise = (async () => {
    const previous = knowledgeCache || (await chrome.storage.local.get('knowledge')).knowledge;
    const value = await prepareKnowledge(c, previous);
    if (catalogCache !== c) return;
    if (value !== previous) await chrome.storage.local.set({knowledge: value});
    knowledgeCache = value; knowledgeForCatalog = c;
  })();
  try {await knowledgePromise;} finally {knowledgePromise = undefined;}
  return ensureKnowledge();
}
function schedulePreparation(delay = 1000) {
  if (prepTimer || prepController) return;
  prepTimer = setTimeout(() => {prepTimer = undefined; prepareOne().catch(() => {});}, delay);
  prepTimer.unref?.();
}
export async function prepareOne() {
  const currentRevision = revision;
  const idleWait = 30000 - (Date.now() - lastInteractionAt);
  if (idleWait > 0) {schedulePreparation(idleWait); return;}
  if (prepController || running.size) {schedulePreparation(8000); return;}
  const config = await settings(), c = await catalog(), k = await ensureKnowledge();
  if (!config.aiEnabled || !c.templates.length || !config.providerOrder.some(id => config.providers[id].enabled && config.providers[id].apiKey)) return;
  if (k.nextAt > Date.now()) {schedulePreparation(Math.min(60000, k.nextAt - Date.now())); return;}
  const batch = knowledgeBatch(k, c); if (!batch.length) return;
  if (currentRevision !== revision || catalogCache !== c) return;
  const controller = prepController = new AbortController();
  try {
    await rateReady;
    const result = await pool.run({settings: config, system: KNOWLEDGE_SYSTEM, input: {entries: batch}, maxTokens: 2200, signal: controller.signal, validate: value => validateAnalysis(value, batch)});
    if (revision !== currentRevision || controller.signal.aborted || knowledgeCache?.hash !== k.hash) return;
    const value = {...k, entries: k.entries.map(e => ({...e})), attempts: result.ok ? 0 : (k.attempts || 0) + 1};
    if (result.ok) {
      const analyzed = new Map(result.value.map(e => [e.id, e.analysis]));
      value.entries = value.entries.map(e => analyzed.has(e.id) ? {...e, analysis: analyzed.get(e.id)} : e);
      value.error = ''; value.nextAt = Date.now() + 8000;
      if (knowledgeProgress(value).done === knowledgeProgress(value).total) value.analyzedAt = Date.now();
    } else {
      value.error = result.failures.some(e => ['credentials', 'configuration', 'budget'].includes(e.reason)) ? 'Bağlantı ayarlarını kontrol et.' : 'Hazırlık uygun bağlantı bulunduğunda devam edecek.';
      value.nextAt = Date.now() + Math.max(result.retryAfterMs || 60000, value.attempts >= 3 ? 300000 : 15000);
    }
    await chrome.storage.local.set({knowledge: value});
    knowledgeCache = value; retrievalIndex = undefined;
  } finally {if (prepController === controller) prepController = undefined; schedulePreparation(8000);}
}
chrome.runtime.onStartup?.addListener(() => schedulePreparation(1000));
chrome.runtime.onInstalled?.addListener(() => schedulePreparation(1000));
if (chrome.alarms) {
  chrome.alarms.create('hizir-knowledge', {delayInMinutes: 1, periodInMinutes: 1});
  chrome.alarms.onAlarm.addListener(alarm => {if (alarm.name === 'hizir-knowledge') schedulePreparation(1000);});
}
function failureNotice(result) {
  if (!result.configured) return 'Yanıt üretimi için ayarlardan en az bir yapay zekâ anahtarı ekle. Hazır destek yanıtları kullanılabilir.';
  if (result.failures.some(e => ['credentials', 'configuration', 'budget', 'paid'].includes(e.reason))) return 'Yapay zekâ bağlantılarının ayarlarını kontrol et. Bu sırada hazır destek yanıtları gösteriliyor.';
  return 'Yapay zekâ bağlantıları şu anda uygun yanıt veremedi. Hazır destek yanıtlarını görüşmeye göre kontrol ederek kullanabilirsin.';
}
async function suggest(payload, tabId) {
  lastInteractionAt = Date.now();
  const messages = cleanMessages(payload.messages).filter(m => m.role !== 'system');
  const key = JSON.stringify([revision, tabId, payload.conversationId || '', payload.query || '', messages]);
  const current = pending.get(tabId);
  if (current?.key === key && !running.get(tabId)?.signal.aborted) return current.promise;
  const cached = pool.cache.get(key);
  running.get(tabId)?.abort();
  if (cached) return {...cached, cached: true};
  // Live customer replies take precedence over background catalog analysis.
  prepController?.abort();
  const controller = new AbortController(); running.set(tabId, controller);
  const promise = suggestFresh(payload, messages, controller, key).finally(() => {
    if (running.get(tabId) === controller) running.delete(tabId);
    if (pending.get(tabId)?.promise === promise) pending.delete(tabId);
    schedulePreparation(10000);
  });
  pending.set(tabId, {key, promise}); return promise;
}
async function suggestFresh(payload, messages, controller, key) {
  const c = await catalog(), config = await settings();
  if (payload.query) return {items: rankTemplates(c.templates, messages, payload.query).slice(0, 12), mode: 'search', notice: 'FastKeys arşivi · Orijinal metinler'};
  const k = await ensureKnowledge();
  if (!retrievalIndex) retrievalIndex = buildIndex(c.templates, k);
  const input = composeInput(retrievalIndex, k, messages);
  const local = (notice, retryAfterMs = 0) => ({items: localReplies(input), mode: 'prepared', notice, retryAfterMs});
  if (!config.aiEnabled) return local('Yapay zekâ kapalı. Hazır destek yanıtları gösteriliyor; arşiv aramasını da kullanabilirsin.');
  await rateReady;
  if (controller.signal.aborted) throw new DOMException('İptal edildi', 'AbortError');
  const started = Date.now();
  const result = await pool.run({settings: config, system: COMPOSER_SYSTEM, input, signal: controller.signal, maxTokens: 1800, validate: value => ({items: validateReplies(value, input), note: typeof value.note === 'string' ? value.note.slice(0, 160) : ''})});
  if (controller.signal.aborted) throw new DOMException('İptal edildi', 'AbortError');
  if (!result.ok) return local(failureNotice(result), result.retryAfterMs);
  const value = {items: result.value.items, mode: 'ai', provider: NAMES[result.provider], model: result.model, switched: result.switched, elapsed: Date.now() - started, notice: result.value.note ? `Kontrol notu: ${result.value.note}` : 'Görüşmeye göre üç yanıt hazırlandı. Kullanacağın yanıtı kontrol edip kopyalayabilirsin.'};
  pool.cache.put(key, value); return value;
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  const isOptions = sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('options.html');
  let live = false;
  try { const u = new URL(sender.url); live = u.protocol === 'https:' && ['my.livechatinc.com', 'my.livechat.com'].includes(u.hostname) && sender.frameId === 0; } catch { /* no valid sender */ }
  if (!isOptions && !live) return false;
  const run = async () => {
    switch (message.type) {
      case 'status': { const c = await catalog(), s = await settings(), k = await ensureKnowledge(); schedulePreparation(1000); return {count: c.templates.length, source: c.source, updatedAt: c.updatedAt, aiEnabled: s.aiEnabled, autoSync: s.autoSync, knowledge: knowledgeProgress(k), providers: pool.status(s), revision}; }
      case 'openOptions': await chrome.runtime.openOptionsPage(); return {};
      case 'suggest': if (!live) throw new Error('Bu işlem LiveChat ekranında kullanılabilir.'); return suggest(message, sender.tab.id);
      case 'cancel': if (live) running.get(sender.tab.id)?.abort(); return {};
      case 'sync': if (!isOptions && !(await settings()).autoSync) return {unchanged: true}; return syncNative();
      case 'getSettings': if (!isOptions) throw new Error('Yetkisiz işlem.'); return {settings: publicSettings(await settings()), catalog: await catalog(), knowledge: knowledgeProgress(await ensureKnowledge()), providers: pool.status(await settings()), extensionId: chrome.runtime.id};
      case 'import': if (!isOptions) throw new Error('Yetkisiz işlem.'); await chrome.storage.local.remove('nativeStamp'); return saveSource(message.text, message.name || 'İçe aktarılan dosya');
      case 'saveSettings': {
        if (!isOptions) throw new Error('Yetkisiz işlem.');
        const value = mergeSettings(await settings(), message.settings || {});
        const router = value.providers.openrouter;
        if (router.enabled && router.apiKey && !isFreeRouter(router.model)) {
          const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
          try { await verifyPaidKey(router, value.monthlyBudget, controller.signal); }
          finally { clearTimeout(timer); }
        }
        const k = await ensureKnowledge();
        const resumed = {...k, nextAt: 0, error: '', attempts: 0};
        await chrome.storage.local.set({settings: value, knowledge: resumed});
        schedulePreparation(1000); return {};
      }
      case 'testProvider': {
        if (!isOptions || !PROVIDERS.includes(message.provider)) throw new Error('Yetkisiz işlem.');
        const config = await settings();
        if (!config.providers[message.provider].apiKey) throw new Error('Önce anahtarı kaydet.');
        for (const id of PROVIDERS) config.providers[id] = {...config.providers[id], enabled: id === message.provider};
        await rateReady;
        const result = await pool.run({settings: config, system: 'Bağlantı testi. Sadece JSON yaz: {"ok":true}.', input: {test: true}, maxTokens: 256, validate: value => {if (value.ok !== true) throw new Error('test'); return true;}});
        return {connected: result.ok, notice: result.ok ? `${NAMES[message.provider]} bağlantısı çalışıyor.` : failureNotice(result)};
      }
      default: throw new Error('Bilinmeyen istek.');
    }
  };
  run().then((data) => reply({ok: true, data})).catch((error) => reply({ok: false, error: error.name === 'AbortError' ? 'İstek iptal edildi veya zaman aşımına uğradı.' : error.message}));
  return true;
});
