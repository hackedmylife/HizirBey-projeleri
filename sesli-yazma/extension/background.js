import {STORE, cleanSettings, emptyMemory, validateMemory, addCorrection, relevantExamples, serializeBackup, textBytes, MEMORY_LIMIT, liveChatUrl, quotaReservation, QuotaWaitError, TEXT_MODEL} from './lib/core.js';
import {request} from './lib/groq.js';
import {dictationTextRisk, REJECTED_DICTATION} from './lib/safety.js';

const extensionOrigin = chrome.runtime.getURL('');
const offscreenUrl = chrome.runtime.getURL('offscreen.html');
let session = null, status = {phase: 'idle', message: 'Dikteye hazır', busy: false, recording: false, lastText: '', lastRaw: ''};
let memoryCache = null, toggleChain = Promise.resolve(), ledgerChain = Promise.resolve(), offscreenCreation = null, offscreenClosing = null;
const boot = (async () => {
  await chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
  await chrome.storage.session.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'});
  const saved = (await chrome.storage.session.get(STORE.runtime))[STORE.runtime];
  const contexts = await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']});
  if (saved?.session && contexts.length) {session = saved.session; status = saved.status;}
  else await chrome.storage.session.remove(STORE.runtime);
})();
const getSettings = async () => cleanSettings((await chrome.storage.local.get(STORE.settings))[STORE.settings]);
const getKey = async () => (await chrome.storage.local.get(STORE.credentials))[STORE.credentials]?.key || '';
async function getMemory() {return memoryCache || (await chrome.storage.local.get(STORE.memory))[STORE.memory] || emptyMemory();}
function view() {return {...status, sessionId: session?.id || null, tabId: session?.tabId || null};}
async function tellTab(type, data = {}) {
  if (!session) return null;
  return chrome.tabs.sendMessage(session.tabId, {type, sessionId: session.id, ...data}, {frameId: 0});
}
async function publish(patch = {}, persist = true) {
  const expectedSession = session;
  const stateChanged = ['phase', 'recording', 'busy'].some(key => key in patch && patch[key] !== status[key]);
  status = {...status, ...patch};
  const value = view();
  if (persist || stateChanged) await chrome.storage.session.set({[STORE.runtime]: {session, status}});
  if (session !== expectedSession) return view();
  chrome.action.setBadgeText({text: status.recording ? 'MIC' : status.busy ? '…' : status.phase === 'error' ? '!' : ''}).catch(() => {});
  chrome.action.setBadgeBackgroundColor({color: status.phase === 'error' ? '#b0493d' : '#a78641'}).catch(() => {});
  chrome.runtime.sendMessage({type: 'voice:status', target: 'ui', data: value}).catch(() => {});
  if (session) {const id = session.id; tellTab('voice:status', {data: value}).catch(() => {if (session?.id === id) return cancel('LiveChat bağlantısı kesildi.');});}
  return value;
}
async function ensureOffscreen() {
  if (offscreenClosing) await offscreenClosing;
  const contexts = await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [offscreenUrl]});
  if (contexts.length) return;
  if (!offscreenCreation) offscreenCreation = chrome.offscreen.createDocument({url: 'offscreen.html', reasons: ['USER_MEDIA'], justification: 'Kullanıcının Alt+H ile başlattığı Türkçe mikrofon diktesi.'}).finally(() => {offscreenCreation = null;});
  await offscreenCreation;
}
function offscreen(type, data = {}) {return chrome.runtime.sendMessage({target: 'offscreen', type, ...data});}
async function closeIdleOffscreen() {
  if (session) return;
  try {
    const contexts = await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']});
    if (session || !contexts.length || offscreenClosing) return;
    offscreenClosing = chrome.offscreen.closeDocument().finally(() => {offscreenClosing = null;});
    await offscreenClosing;
  } catch { /* Already closed. */ }
}
async function cancel(message = 'Dinleme durduruldu.', phase = 'idle') {
  const old = session; session = null; memoryCache = null;
  if (old) {
    chrome.tabs.sendMessage(old.tabId, {type: 'voice:release', sessionId: old.id, message}, {frameId: 0}).catch(() => {});
    await offscreen('capture:cancel', {sessionId: old.id}).catch(() => {});
  }
  if (session) return view();
  await publish({phase, recording: false, busy: false, canUndo: false, level: 0, message});
  setTimeout(closeIdleOffscreen, 400);
}
async function finish() {
  if (!session) return view();
  await publish({phase: 'finishing', message: 'Son cümle hazırlanıyor…', recording: false, busy: true});
  await offscreen('capture:finish', {sessionId: session.id});
  return view();
}
async function start(tabId) {
  const settings = await getSettings(), key = await getKey();
  if (!key || !settings.freeConfirmed || !settings.cloudConsent || !settings.microphoneReady) {
    await chrome.runtime.openOptionsPage();
    throw new Error('Önce Free hesap anahtarını ve mikrofon iznini ayarlardan tamamla.');
  }
  const tab = await chrome.tabs.get(tabId);
  if (!liveChatUrl(tab.url)) throw new Error('Önce açık LiveChat görüşmesine geç, sonra Alt + H kullan.');
  const id = crypto.randomUUID();
  let binding;
  try {binding = await chrome.tabs.sendMessage(tabId, {type: 'voice:bind', sessionId: id}, {frameId: 0});} catch {throw new Error('LiveChat sayfasını bir kez yenile ve tekrar dene.');}
  if (!binding?.ok) throw new Error(binding?.error || 'LiveChat mesaj alanı bulunamadı.');
  session = {id, tabId, startedAt: Date.now(), lastSegment: 0};
  const mine = session;
  memoryCache = await getMemory();
  if (session !== mine) return view();
  await publish({phase: 'starting', recording: false, busy: true, canUndo: false, warning: '', lastText: '', lastRaw: '', lastLatencyMs: null, message: 'Mikrofon açılıyor…', startedAt: mine.startedAt, level: 0});
  try {
    await ensureOffscreen();
    if (session?.id !== id) return view();
    const result = await offscreen('capture:start', {sessionId: id, config: {...settings, key, terms: memoryCache.terms}});
    if (session?.id !== id) {await offscreen('capture:cancel', {sessionId: id}).catch(() => {}); return view();}
    if (!result?.ok) throw new Error(result?.error || 'Mikrofon başlatılamadı.');
  } catch (error) {if (session?.id === id) await cancel(error.message, 'error'); throw error;}
  return view();
}
async function toggle(tabId) {
  if (session) return ['finishing', 'starting'].includes(status.phase) ? cancel('Dikte iptal edildi.') : finish();
  if (!tabId) {const [tab] = await chrome.tabs.query({active: true, currentWindow: true}); tabId = tab?.id;}
  if (!tabId) throw new Error('Aktif LiveChat sekmesi bulunamadı.');
  return start(tabId);
}
function serializedToggle(tabId) {const operation = toggleChain.then(() => toggle(tabId)); toggleChain = operation.catch(() => {}); return operation;}
async function reserve(kind, seconds) {
  const operation = ledgerChain.then(async () => {
    const usage = (await chrome.storage.local.get(STORE.usage))[STORE.usage];
    let next;
    try {next = quotaReservation(usage, kind, seconds);}
    catch (error) {if (error instanceof QuotaWaitError) return {waitMs: error.waitMs}; throw error;}
    await chrome.storage.local.set({[STORE.usage]: next});
    return true;
  });
  ledgerChain = operation.catch(() => {}); return operation;
}
function contentSender(sender) {return sender.id === chrome.runtime.id && sender.tab && sender.frameId === 0 && liveChatUrl(sender.url);}
function uiSender(sender) {
  try {return sender.id === chrome.runtime.id && !sender.tab?.url?.startsWith('http') && sender.url.startsWith(extensionOrigin) && ['/popup.html', '/options.html'].includes(new URL(sender.url).pathname);} catch {return false;}
}
function audioSender(sender) {return sender.id === chrome.runtime.id && sender.url === offscreenUrl;}
async function handle(message, sender) {
  await boot;
  if (message.type?.startsWith('ui:')) {
    if (!uiSender(sender)) throw new Error('Bu işlem yalnızca eklenti ayarlarından yapılabilir.');
    if (message.type === 'ui:get') {
      const settings = await getSettings(), memory = await getMemory();
      const commands = await chrome.commands.getAll();
      const usage = (await chrome.storage.local.get(STORE.usage))[STORE.usage] || {};
      return {settings, hasKey: Boolean(await getKey()), terms: memory.terms, memory: {count: memory.pairs.length, bytes: textBytes(memory), maxBytes: MEMORY_LIMIT}, usage, shortcut: commands.find(x => x.name === 'toggle-dictation')?.shortcut || '', status: view()};
    }
    if (message.type === 'ui:save') {
      const previous = await getSettings();
      const settings = cleanSettings({...previous, ...message.settings, microphoneReady: previous.microphoneReady});
      const key = typeof message.key === 'string' ? message.key.trim() : '';
      if (key && (key.length < 20 || key.length > 250 || /\s/.test(key))) throw new Error('API anahtarının tamamını boşluksuz yapıştır.');
      if (session) await cancel('Ayarlar değişti; dikteyi yeniden başlat.');
      await chrome.storage.local.set({[STORE.settings]: settings, ...(key ? {[STORE.credentials]: {key}} : {})});
      return {saved: true};
    }
    if (message.type === 'ui:microphone') {await chrome.storage.local.set({[STORE.settings]: {...await getSettings(), microphoneReady: true}}); return true;}
    if (message.type === 'ui:removeKey') {await cancel('Anahtar kaldırıldı.'); await chrome.storage.local.remove(STORE.credentials); return true;}
    if (message.type === 'ui:check') {
      const settings = await getSettings();
      if (!settings.freeConfirmed || !settings.cloudConsent) throw new Error('Önce Free hesap ve ses işleme onayını kaydet.');
      const key = await getKey(); if (!key) throw new Error('Önce API anahtarını kaydet.');
      // The service worker has a 30-second fetch-response limit. Dictation's
      // longer requests run in the offscreen document; this setup check does not.
      const result = await request('/models', {key, timeout: 25000});
      const models = new Set((result.data || []).map(x => x.id));
      if (!models.has(settings.model)) throw new Error('Seçili konuşma modeli bu hesapta görünmüyor.');
      return {message: 'Anahtar kabul edildi; konuşma modeli erişilebilir.', correctionAvailable: models.has(TEXT_MODEL), note: 'Hesabın Free planını bu bağlantı testi doğrulamaz; hesap panelinden kontrol edilir.'};
    }
    if (message.type === 'ui:terms') {
      const memory = await getMemory();
      const next = validateMemory({...memory, terms: message.terms});
      await chrome.storage.local.set({[STORE.memory]: next}); memoryCache = session ? next : null; return true;
    }
    if (message.type === 'ui:export') return serializeBackup(await getMemory());
    if (message.type === 'ui:import') {
      if (typeof message.data !== 'string' || new TextEncoder().encode(message.data).byteLength > MEMORY_LIMIT) throw new Error('Yedek 10 MB sınırını aşıyor.');
      let data; try {data = JSON.parse(message.data);} catch {throw new Error('JSON yedeği okunamadı.');}
      const next = validateMemory(data); await chrome.storage.local.set({[STORE.memory]: next}); memoryCache = session ? next : null; return true;
    }
    if (message.type === 'ui:clearMemory') {const next = {...await getMemory(), pairs: []}; await chrome.storage.local.set({[STORE.memory]: next}); memoryCache = session ? next : null; return true;}
    if (message.type === 'ui:shortcuts') return chrome.tabs.create({url: 'chrome://extensions/shortcuts'});
    if (message.type === 'ui:options') return chrome.runtime.openOptionsPage();
    if (message.type === 'ui:toggle') return serializedToggle();
    if (message.type === 'ui:undo') {
      if (!session || status.busy || !status.canUndo) throw new Error('Şu anda geri alınabilecek hazır dikte yok.');
      const mine = session, response = await tellTab('voice:undo');
      if (session !== mine) return false;
      if (!response?.ok) throw new Error(response?.error || 'Son dikte geri alınamadı.');
      await publish({canUndo: false, warning: '', message: 'Son dikte geri alındı.'}); return true;
    }
    if (message.type === 'ui:cancel') return cancel();
  }
  if (message.type?.startsWith('content:')) {
    if (!contentSender(sender)) throw new Error('Geçersiz LiveChat bağlantısı.');
    if (message.type === 'content:toggle') return serializedToggle(sender.tab.id);
    if (message.type === 'content:options') return chrome.runtime.openOptionsPage();
    if (!session || session.id !== message.sessionId || session.tabId !== sender.tab.id) return false;
    const mine = session;
    if (message.type === 'content:cancel') return cancel(message.reason || 'Görüşme değişti; dikte durduruldu.');
    if (message.type === 'content:sent') {
      const settings = await getSettings();
      if (settings.learn && typeof message.from === 'string' && typeof message.to === 'string') {
        const next = addCorrection(await getMemory(), message.from, message.to);
        await chrome.storage.local.set({[STORE.memory]: next});
      }
      if (session !== mine) return false;
      return cancel('Mesaj kontrolü LiveChat’e bırakıldı. Yeni dikte için Alt + H.');
    }
  }
  if (message.type?.startsWith('audio:')) {
    if (!audioSender(sender) || !session || session.id !== message.sessionId) return false;
    if (message.type === 'audio:reserve') return reserve(message.kind, message.seconds || 0);
    if (message.type === 'audio:examples') return relevantExamples(String(message.text || '').slice(0, 10000), (await getMemory()).pairs);
    if (message.type === 'audio:meter') {
      const pendingSeconds = Math.max(0, Math.ceil(Number(message.pendingSeconds) || 0));
      const waiting = message.waiting && message.processing;
      const text = message.pausedForBacklog ? `Mikrofon bekleme nedeniyle kapatıldı · ${pendingSeconds} sn ses sırayla tamamlanıyor. İptal için Alt + H.` : waiting ? message.waitingForQuota ? `Ücretsiz istek kotası bekleniyor · ${pendingSeconds} sn ses sırada. İptal için Alt + H.` : `Bağlantı bekleniyor · ${Math.min(3, message.attempt || 1)}/3 deneme · ${pendingSeconds} sn ses sırada` : message.processing ? 'Metin hazırlanıyor…' : message.buffered ? 'Seni dinliyorum…' : 'Konuşabilirsin · Hazır metni Enter ile gönder';
      return publish({phase: message.processing ? (message.recording ? waiting ? 'waiting' : 'processing' : 'finishing') : message.buffered ? 'listening' : 'ready', recording: message.recording, busy: message.processing || message.buffered, level: message.level, seconds: message.seconds, pendingSeconds, message: text}, false);
    }
    if (message.type === 'audio:result') {
      const mine = session;
      if (dictationTextRisk(message.text) || dictationTextRisk(message.raw)) {await cancel(REJECTED_DICTATION, 'error'); return false;}
      if (!Number.isSafeInteger(message.segmentId) || message.segmentId < 1) throw new Error('Geçersiz dikte parçası.');
      if (message.segmentId <= (mine.lastSegment || 0)) return true;
      // Claim before the first await: duplicate delivery must never write twice.
      mine.lastSegment = message.segmentId;
      const data = {segmentId: message.segmentId, text: message.text, raw: message.raw, warning: message.warning || ''};
      // Keep a temporary recovery copy if an editor rejects insertion. Never auto-replay it.
      await publish({lastText: data.text, lastRaw: data.raw, warning: data.warning, message: data.warning || 'Metin yazı alanına eklendi.'});
      if (session !== mine) return false;
      const response = await tellTab('voice:insert', {data});
      if (session !== mine) return false;
      if (!response?.ok) {await cancel(response?.error || 'Metin aktarılmadı. Son dikteyi eklenti penceresinden kopyalayabilirsin.', 'error'); return false;}
      const lastLatencyMs = Number.isFinite(message.spokenAt) && message.spokenAt > 0 ? Math.max(0, Date.now() - message.spokenAt) : null;
      await publish({canUndo: true, lastLatencyMs}, false);
      return true;
    }
    if (message.type === 'audio:error') {await cancel(message.error || 'Dikte durduruldu.', 'error'); return true;}
    if (message.type === 'audio:done') {await cancel(message.reason || 'Dikte tamamlandı. Metni okuyup Enter ile gönderebilirsin.'); return true;}
  }
  throw new Error('Bilinmeyen eklenti işlemi.');
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message || message.target === 'offscreen' || message.target === 'ui' || !/^(ui|content|audio):/.test(message.type || '')) return false;
  handle(message, sender).then(data => respond({ok: true, data}), error => respond({ok: false, error: error.message || 'İşlem tamamlanamadı.'}));
  return true;
});
chrome.commands.onCommand.addListener(command => {
  if (command !== 'toggle-dictation') return;
  boot.then(() => serializedToggle()).catch(error => publish({phase: 'error', busy: false, recording: false, message: error.message}));
});
chrome.tabs.onActivated.addListener(info => {boot.then(() => {if (session && info.tabId !== session.tabId) return cancel('Sekme değişti; mikrofon kapatıldı.');}).catch(() => {});});
chrome.tabs.onRemoved.addListener(tabId => {boot.then(() => {if (session?.tabId === tabId) return cancel('LiveChat sekmesi kapandı.');}).catch(() => {});});
chrome.tabs.onUpdated.addListener((tabId, change) => {boot.then(() => {if (session?.tabId === tabId && (change.status === 'loading' || change.url)) return cancel('Sayfa değişti; mikrofon kapatıldı.');}).catch(() => {});});
chrome.runtime.onInstalled.addListener(details => {if (details.reason === 'install') chrome.runtime.openOptionsPage();});
