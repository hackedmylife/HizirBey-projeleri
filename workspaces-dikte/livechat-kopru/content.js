(() => {
  'use strict';
  const PREFIX = 'HB-DIKTE-2';
  let session = null;
  let preparing = false;
  async function copySignal(kind, id, detail) {
    const signal = `${PREFIX}|${kind}|${id}|${detail}`;
    try { await navigator.clipboard.writeText(signal); }
    catch {
      // Extension clipboardWrite permission also permits the legacy copy path.
      const field = document.createElement('textarea');
      field.value = signal; field.style.cssText = 'position:fixed;left:-10000px;top:0';
      document.body.append(field); field.select();
      const copied = document.execCommand('copy'); field.remove();
      if (!copied) throw new Error('clipboard');
      if (session) session.binding.editor.focus({preventScroll: true});
    }
  }
  async function signalError(error) {
    const allowed = new Set(['editor', 'identity', 'note', 'changed', 'edited', 'focus', 'verify', 'text', 'clipboard', 'expired']);
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
  document.addEventListener('paste', event => {
    if (!session || !['armed', 'writing'].includes(session.phase) || !event.isTrusted) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (session.phase === 'writing') return;
    if (Date.now() > session.armedUntil) { session.phase = 'prepared'; void signalError(new Error('expired')); return; }
    const text = event.clipboardData?.getData('text/plain').replace(/\r?\n/g, ' ').trim() || '';
    if (!text || text.length > 10000 || text.startsWith(`${PREFIX}|`) || text.startsWith('HB-DIKTE-WAIT-')) {
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
