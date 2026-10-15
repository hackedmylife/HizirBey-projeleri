(() => {
  if (document.getElementById('hizir-voice-host')) return;
  const host = document.createElement('div'); host.id = 'hizir-voice-host'; host.hidden = true;
  host.style.cssText = 'all:initial!important;position:fixed!important;top:16px!important;right:16px!important;width:10px!important;height:10px!important;z-index:2147483001!important;pointer-events:none!important;display:none!important';
  const shadow = host.attachShadow({mode: 'open'});
  shadow.innerHTML = `<style>:host{color-scheme:dark}.dot{display:block;width:10px;height:10px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 2px #171a21,0 0 9px #ef444450}</style><span class="dot" id="indicator" role="img" aria-label="Hızır Bey sesli yazma etkin"></span>`;
  document.documentElement.append(host);
  const indicator = shadow.getElementById('indicator');
  let active = null, observer = null, monitorTimer = null, insertion = Promise.resolve();
  const ask = async message => {const response = await chrome.runtime.sendMessage(message); if (!response?.ok) throw new Error(response?.error || 'Eklenti bağlantısı yenilenmeli.'); return response.data;};
  function renderIndicator() {
    const visible = Boolean(active && (active.recording || active.busy || active.binding.writing));
    host.hidden = !visible; host.style.setProperty('display', visible ? 'block' : 'none', 'important');
    indicator.dataset.phase = active?.recording ? 'listening' : active?.busy ? 'processing' : 'idle';
    indicator.setAttribute('aria-label', active?.busy ? 'Hızır Bey metni hazırlıyor' : 'Hızır Bey dinliyor');
  }
  function detach() {active = null; observer?.disconnect(); observer = null; clearTimeout(monitorTimer); renderIndicator();}
  function cancel(reason) {
    const id = active?.id; detach();
    if (id) ask({type: 'content:cancel', sessionId: id, reason}).catch(() => {});
  }
  function monitor() {if (active && !active.binding.valid()) cancel('Görüşme değişti; mikrofon kapatıldı.');}
  function bind(id) {
    detach();
    const binding = new globalThis.HizirVoiceEditor.Binding();
    active = {id, binding, busy: true, recording: false, lastSegment: 0};
    observer = new MutationObserver(records => {
      if (records.every(record => host.contains(record.target))) return;
      clearTimeout(monitorTimer); monitorTimer = setTimeout(monitor, 60);
    });
    observer.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-chat-id', 'data-conversation-id', 'data-mode', 'data-testid', 'aria-selected']});
    renderIndicator();
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !message?.type?.startsWith('voice:')) return false;
    if (message.type === 'voice:bind') {try {bind(message.sessionId); respond({ok: true});} catch (error) {detach(); respond({ok: false, error: error.message});} return false;}
    if (!active || active.id !== message.sessionId) {respond({ok: false, error: 'Dikte oturumu artık açık değil.'}); return false;}
    if (message.type === 'voice:status') {
      if (message.data.sessionId === active.id) {active.busy = message.data.busy; active.recording = message.data.recording; renderIndicator();}
      respond({ok: true}); return false;
    }
    if (message.type === 'voice:release') {detach(); respond({ok: true}); return false;}
    if (message.type === 'voice:undo') {
      if (active.busy || active.binding.writing) {respond({ok: false, error: 'Metin hazırlanıyor. Tamamlanmasını bekle.'}); return false;}
      active.binding.undo().then(() => respond({ok: true}), error => respond({ok: false, error: error.message})); return true;
    }
    if (message.type === 'voice:insert') {
      const mine = active;
      insertion = insertion.catch(() => {}).then(async () => {
        if (active !== mine) throw new Error('Dikte oturumu değişti; metin eklenmedi.');
        if (message.data.segmentId && message.data.segmentId <= mine.lastSegment) return;
        await mine.binding.insert(message.data.text);
        if (active !== mine) throw new Error('Görüşme değişti.');
        mine.lastSegment = message.data.segmentId || mine.lastSegment;
      });
      insertion.then(() => respond({ok: true}), error => respond({ok: false, error: error.message})); return true;
    }
    return false;
  });
  function beforeSend(event) {
    const mine = active; if (!mine || !event.isTrusted) return;
    const keyboard = event.type === 'keydown';
    if (keyboard && (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing)) return;
    if (keyboard && event.target !== mine.binding.editor && !mine.binding.editor.contains(event.target)) return;
    if (!keyboard && !event.target.closest?.('[data-testid="send-button"]')) return;
    if (!mine.binding.valid()) {event.preventDefault(); event.stopImmediatePropagation(); cancel('Görüşme değişti. Mesajı kontrol et.'); return;}
    if (mine.busy || mine.binding.writing) {event.preventDefault(); event.stopImmediatePropagation(); return;}
    const from = mine.binding.initial.trim() ? '' : mine.binding.segments.join(' ');
    const to = globalThis.HizirVoiceEditor.read(mine.binding.editor).trim();
    detach();
    // Observe the user's real send gesture; leave native LiveChat dispatch untouched.
    ask({type: 'content:sent', sessionId: mine.id, from, to}).catch(() => {});
  }
  document.addEventListener('keydown', beforeSend, true);
  document.addEventListener('click', beforeSend, true);
  document.addEventListener('visibilitychange', () => {if (document.hidden && active) cancel('Sekme değişti; mikrofon kapatıldı.');});
  addEventListener('pagehide', () => {if (active) cancel('LiveChat sayfası kapandı.');});
})();
