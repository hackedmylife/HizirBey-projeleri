(() => {
  'use strict';
  const PREFIX = 'HB-DIKTE-2';
  let session = null;
  let preparing = false;
  let reply = null;
  function clearReply(current) {
    if (reply !== current) return;
    const restore = document.activeElement === current.field;
    current.field.remove(); reply = null;
    if (restore && current.previous?.isConnected) current.previous.focus({preventScroll: true});
  }
  async function copySignal(kind, id, detail) {
    const signal = `${PREFIX}|${kind}|${id}|${detail}`;
    if (reply) clearReply(reply);
    const field = document.createElement('textarea');
    field.dataset.hbDikteReply = ''; field.readOnly = true; field.tabIndex = -1;
    field.setAttribute('aria-hidden', 'true');
    field.value = signal;
    field.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0';
    const current = {field, signal, previous: document.activeElement, expires: Date.now() + 10000};
    reply = current;
    document.body.append(field); field.focus({preventScroll: true}); field.select();
    // Do not write the remote clipboard programmatically: the local client
    // explicitly presses Ctrl+C, which also triggers the remote clipboard path.
    setTimeout(() => clearReply(current), 10000);
  }
  window.addEventListener('copy', event => {
    const current = reply;
    if (!event.isTrusted || !current || document.activeElement !== current.field) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (Date.now() <= current.expires) event.clipboardData?.setData('text/plain', current.signal);
    queueMicrotask(() => clearReply(current));
  }, true);
  async function signalError(error) {
    const allowed = new Set(['editor', 'identity', 'note', 'changed', 'edited', 'focus', 'verify', 'text', 'clipboard', 'expired', 'protocol']);
    const code = allowed.has(error.message) ? error.message : 'editor';
    await copySignal('ERROR', session?.id || '0'.repeat(32), code).catch(() => {});
    return {ok: false, error: code};
  }
  async function prepare(reset = false) {
    if (preparing || session?.phase === 'writing') return {ok: false, error: 'busy'};
    preparing = true;
    try {
      if (session?.phase === 'failed' && !reset) throw new Error('verify');
      if (reset || !session || session.phase === 'done') {
        session = {id: crypto.randomUUID().replaceAll('-', ''), binding: new HizirDikteEditor.Binding(), phase: 'prepared', armedUntil: 0};
      } else {
        session.binding.assert();
        session.phase = 'armed';
        session.armedUntil = Date.now() + 12000;
      }
      session.binding.focus();
      await copySignal('READY', session.id, session.phase);
      return {ok: true, phase: session.phase};
    } catch (error) { return signalError(error); }
    finally { preparing = false; }
  }
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || !['hb:prepare', 'hb:reset'].includes(message?.type)) return false;
    void prepare(message.type === 'hb:reset').then(reply);
    return true;
  });
  // Control replies are never customer text. Guard before any LiveChat handler,
  // even before preparation, after a failure, or after the transfer completed.
  window.addEventListener('paste', event => {
    const raw = event.clipboardData?.getData('text/plain') || '';
    if (HizirDikteEditor.isControlText(raw)) {
      event.preventDefault(); event.stopImmediatePropagation();
      return;
    }
    if (!session || !['armed', 'writing'].includes(session.phase) || !event.isTrusted) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (session.phase === 'writing') return;
    if (Date.now() > session.armedUntil) { session.phase = 'prepared'; void signalError(new Error('expired')); return; }
    const text = raw.replace(/\r?\n/g, ' ').trim();
    if (!text || text.length > 10000) {
      void signalError(new Error('text')); return;
    }
    session.phase = 'writing';
    void session.binding.insert(text).then(async () => {
      session.phase = 'done';
      await copySignal('DONE', session.id, 'inserted');
    }).catch(error => {
      // After an uncertain editor write, only an explicit reset can start over.
      session.phase = 'failed';
      void signalError(error);
    });
  }, true);
})();
