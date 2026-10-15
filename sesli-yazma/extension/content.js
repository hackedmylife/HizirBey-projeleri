(() => {
  if (document.getElementById('hizir-voice-host')) return;
  const host = document.createElement('div'); host.id = 'hizir-voice-host';
  host.style.cssText = 'position:fixed;bottom:20px;right:24px;z-index:2147483001;max-width:calc(100vw - 32px)';
  const shadow = host.attachShadow({mode: 'open'});
  shadow.innerHTML = `<style>
    :host{all:initial;color-scheme:dark}*{box-sizing:border-box}button{font:inherit;cursor:pointer}button:focus-visible{outline:2px solid #e7cc86;outline-offset:3px}button:disabled{opacity:.45;cursor:default}.bar{display:flex;align-items:center;gap:10px;max-width:470px;padding:9px 11px 9px 9px;background:#171a21;border:1px solid #55503b;border-radius:16px;box-shadow:0 12px 38px #0005;color:#f4f1e8;font:12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}.logo{width:40px;height:36px;object-fit:contain;flex:none}.copy{min-width:0;flex:1}.title{font-weight:650;display:flex;align-items:center;gap:8px}.subtitle{font-size:11px;color:#bbc2ce;max-width:270px;overflow-wrap:anywhere}kbd{font:10px system-ui;color:#e2c77e;border:1px solid #5c5540;border-radius:5px;padding:2px 5px;white-space:nowrap}.light{width:6px;height:6px;border-radius:50%;background:#89909d;flex:none}.bar[data-live=true] .light{background:#98d8b8}.bar[data-error=true]{border-color:#b86855}.control{background:#d9bd78;color:#1a1b20;border:0;padding:8px 11px;border-radius:9px;white-space:nowrap;font-weight:650}.quiet{border:0;background:transparent;color:#c0c6d0;padding:7px;min-width:28px}.meter{display:flex;align-items:center;gap:2px;height:18px}.meter i{width:3px;height:4px;background:#d9bd78;border-radius:2px}.timer{color:#c8cfda;font-variant-numeric:tabular-nums;font-size:11px}.extra{display:flex;gap:3px;align-items:center}@media(max-width:580px){.subtitle{max-width:160px}.extra{display:none}.bar{gap:7px}.logo{width:30px;height:30px}}@media(prefers-reduced-motion:reduce){*{transition:none}}
  </style><div class="bar" id="bar" role="region" aria-label="Hızır Bey sesli yazma"><img class="logo" alt="Hızır Bey"/><div class="copy"><div class="title"><span class="light" aria-hidden="true"></span><span>Sesli yazma</span><kbd>Alt + H</kbd></div><div class="subtitle" id="message" role="status" aria-live="polite">Konuş, kontrol et, Enter ile gönder.</div></div><div class="extra"><div class="meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><span class="timer" id="timer">00:00</span></div><button class="control" id="toggle" type="button">Başlat</button><button class="quiet" id="undo" type="button" aria-label="Son dikteyi geri al" title="Son dikteyi geri al" disabled>↶</button><button class="quiet" id="settings" type="button" aria-label="Sesli yazma ayarları" title="Ayarlar">⚙</button><button class="quiet" id="close" type="button" aria-label="Sesli yazmayı gizle" title="Gizle ve mikrofonu kapat">×</button></div>`;
  document.documentElement.append(host);
  const $ = id => shadow.getElementById(id);
  shadow.querySelector('img').src = chrome.runtime.getURL('logo.png');
  let active = null, observer = null, monitorTimer = null, insertion = Promise.resolve();
  const ask = async message => {const response = await chrome.runtime.sendMessage(message); if (!response?.ok) throw new Error(response?.error || 'Eklenti bağlantısı yenilenmeli.'); return response.data;};
  function notify(text, error = false) {$('message').textContent = text; $('bar').dataset.error = String(error);}
  function position() {
    if (!active?.binding.editor.isConnected) {host.style.bottom = '20px'; host.style.top = ''; host.style.right = '24px'; return;}
    const rect = active.binding.editor.getBoundingClientRect();
    if (rect.top > 90 && rect.top < innerHeight) {host.style.top = `${Math.max(12, rect.top - host.offsetHeight - 12)}px`; host.style.bottom = ''; host.style.right = `${Math.max(16, innerWidth - rect.right)}px`;}
  }
  function detach(message) {
    active = null; observer?.disconnect(); observer = null; clearTimeout(monitorTimer);
    $('toggle').textContent = 'Başlat'; $('undo').disabled = true; $('bar').dataset.live = 'false';
    shadow.querySelectorAll('.meter i').forEach(x => {x.style.height = '4px';});
    if (message) notify(message); position();
  }
  function cancel(reason) {
    const id = active?.id; detach(reason);
    if (id) ask({type: 'content:cancel', sessionId: id, reason}).catch(() => {});
  }
  function monitor() {
    if (active && !active.binding.valid()) cancel('Görüşme değişti; mikrofon kapatıldı.');
    else position();
  }
  function bind(id) {
    detach(); host.hidden = false;
    const binding = new globalThis.HizirVoiceEditor.Binding();
    active = {id, binding, busy: true, recording: false};
    observer = new MutationObserver(records => {
      if (records.every(record => host.contains(record.target))) return;
      clearTimeout(monitorTimer); monitorTimer = setTimeout(monitor, 60);
    });
    observer.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-chat-id', 'data-conversation-id', 'data-mode', 'data-testid', 'aria-selected']});
    $('toggle').textContent = 'Durdur'; notify('Mikrofon hazırlanıyor…'); position();
  }
  function render(data) {
    if (!active || data.sessionId !== active.id) return;
    active.busy = data.busy; active.recording = data.recording;
    $('bar').dataset.live = String(data.recording); $('bar').dataset.error = String(data.phase === 'error');
    $('timer').textContent = `${String(Math.floor((data.seconds || 0) / 60)).padStart(2, '0')}:${String((data.seconds || 0) % 60).padStart(2, '0')}`;
    shadow.querySelectorAll('.meter i').forEach((item, i) => {item.style.height = `${4 + Math.round((data.level || 0) * (i === 2 ? 15 : i % 2 ? 10 : 6))}px`;});
    if (!active.warning || data.busy) notify(data.message);
    $('toggle').textContent = data.phase === 'finishing' ? 'İptal' : 'Durdur';
  }
  $('toggle').onclick = () => ask({type: 'content:toggle'}).catch(error => notify(error.message, true));
  $('settings').onclick = () => ask({type: 'content:options'}).catch(error => notify(error.message, true));
  $('close').onclick = () => {cancel('Sesli yazma gizlendi.'); host.hidden = true;};
  $('undo').onclick = async () => {if (!active) return; try {await active.binding.undo(); $('undo').disabled = true; notify('Son dikte geri alındı.');} catch (error) {notify(error.message, true);}};
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !message?.type?.startsWith('voice:')) return false;
    if (message.type === 'voice:bind') {try {bind(message.sessionId); respond({ok: true});} catch (error) {detach(); notify(error.message, true); respond({ok: false, error: error.message});} return false;}
    if (!active || active.id !== message.sessionId) {respond({ok: false, error: 'Dikte oturumu artık açık değil.'}); return false;}
    if (message.type === 'voice:status') {render(message.data); respond({ok: true}); return false;}
    if (message.type === 'voice:release') {detach(message.message); respond({ok: true}); return false;}
    if (message.type === 'voice:insert') {
      const mine = active;
      insertion = insertion.catch(() => {}).then(async () => {
        if (active !== mine) throw new Error('Dikte oturumu değişti; metin eklenmedi.');
        await mine.binding.insert(message.data.text);
        if (active !== mine) throw new Error('Görüşme değişti.');
        mine.warning = message.data.warning;
        notify(message.data.warning || 'Metin hazır · Oku, Enter ile gönder.'); $('undo').disabled = false;
      });
      insertion.then(() => respond({ok: true}), error => {notify(error.message, true); respond({ok: false, error: error.message});});
      return true;
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
    if (mine.busy || mine.binding.writing) {event.preventDefault(); event.stopImmediatePropagation(); notify('Metin henüz hazırlanıyor. Hazır olduğunda tekrar Enter’a bas.'); return;}
    const from = mine.binding.initial.trim() ? '' : mine.binding.segments.join(' ');
    const to = globalThis.HizirVoiceEditor.read(mine.binding.editor).trim();
    detach('Yeni dikte için Alt + H.');
    // Observe the user's real send gesture; leave native LiveChat dispatch untouched.
    ask({type: 'content:sent', sessionId: mine.id, from, to}).catch(() => {});
  }
  document.addEventListener('keydown', beforeSend, true);
  document.addEventListener('click', beforeSend, true);
  document.addEventListener('visibilitychange', () => {if (document.hidden && active) cancel('Sekme değişti; mikrofon kapatıldı.');});
  addEventListener('pagehide', () => {if (active) cancel('LiveChat sayfası kapandı.');});
  addEventListener('resize', position, {passive: true});
  addEventListener('scroll', position, {passive: true, capture: true});
})();
