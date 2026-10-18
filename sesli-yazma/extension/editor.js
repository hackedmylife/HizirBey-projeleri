/* Isolated-world LiveChat adapter. Never assigns innerHTML and never sends a message. */
(() => {
  const SELECTOR = '[data-testid="chat-feed-text-area-test-id"][contenteditable="true"], #chat-feed-text-area-id[contenteditable="true"], [data-testid="message-input"][contenteditable="true"], textarea[data-testid="message-input"]';
  const visible = element => element.isConnected && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  const read = editor => (editor.tagName === 'TEXTAREA' ? editor.value : editor.innerText).replace(/\u00a0/g, ' ').replace(/\n$/, '');
  function find() {
    const all = [...document.querySelectorAll(SELECTOR)].filter(visible);
    if (all.length !== 1) throw new Error(all.length ? 'Birden fazla mesaj alanı var. Tek bir görüşme aç.' : 'LiveChat mesaj alanı bulunamadı. Bir görüşme açıp tekrar dene.');
    return all[0];
  }
  function isNote(editor) {
    const scope = editor.parentElement;
    if (editor.closest('[data-mode="note"], [data-mode="internal"], [data-internal-note="true"]')) return true;
    const candidates = [...scope.querySelectorAll('p, [data-placeholder], [role="tab"][aria-selected="true"]')].filter(x => !editor.contains(x));
    return candidates.some(x => /internal note|private note|dahili not|iç not|müşterinin göremeyeceği|müşteri.*göreme/i.test(x.textContent || x.getAttribute('data-placeholder') || ''));
  }
  function identity(editor) {
    let scope = editor.parentElement;
    while (scope.parentElement && !scope.querySelector('[data-testid="chat-feed"]')) scope = scope.parentElement;
    const feeds = [...scope.querySelectorAll('[data-testid="chat-feed"]')].filter(visible);
    const feed = feeds.length === 1 ? feeds[0] : null;
    const owner = editor.closest('[data-chat-id], [data-conversation-id], [data-thread-id]') || feed?.closest('[data-chat-id], [data-conversation-id], [data-thread-id]');
    const stable = owner?.dataset.chatId || owner?.dataset.conversationId || owner?.dataset.threadId || feed?.dataset.chatId || feed?.dataset.conversationId || '';
    const reaction = feed?.querySelector('[data-testid$="-reaction"]')?.getAttribute('data-testid') || '';
    const thread = reaction.match(/^([a-z0-9]{6,})[_-]\d+-reaction$/i)?.[1] || '';
    if (!feed && !stable) throw new Error('Görüşme kimliği bulunamadı. Açık sohbeti yeniden seç.');
    return {url: location.href, feed, stable, thread};
  }
  function same(a, b) {return a.url === b.url && a.feed === b.feed && a.stable === b.stable && a.thread === b.thread;}
  function findSendButton(editor) {
    let scope = editor.parentElement;
    while (scope && scope !== document.body) {
      const buttons = [...scope.querySelectorAll('[data-testid="send-button"]')].filter(visible);
      if (buttons.length) {
        if (buttons.length !== 1) throw new Error('Gönder düğmesi belirsiz. Metni kontrol edip LiveChat Gönder düğmesini kullan.');
        const button = buttons[0];
        if (button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true' || button.closest('[inert]')) throw new Error('Gönder düğmesi henüz hazır değil. Metnin korundu; LiveChat Gönder düğmesini kullan.');
        return button;
      }
      // Never climb past this conversation to a different composer's button.
      if (scope.querySelector('[data-testid="chat-feed"]')) break;
      scope = scope.parentElement;
    }
    throw new Error('Gönder düğmesi bulunamadı. Metnin korundu; LiveChat Gönder düğmesini kullan.');
  }
  function write(editor, target, addition = null) {
    editor.focus({preventScroll: true});
    if (editor.tagName === 'TEXTAREA') {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(editor, target);
      editor.setSelectionRange(target.length, target.length);
      editor.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText', data: addition ?? target}));
      return;
    }
    const selection = window.getSelection(), range = document.createRange();
    if (addition === null) range.selectNodeContents(editor);
    else {
      const last = editor.lastElementChild, container = last?.matches('p, div') ? last : editor;
      range.selectNodeContents(container);
      range.collapse(container.childNodes.length === 1 && container.firstChild?.nodeName === 'BR');
    }
    selection.removeAllRanges(); selection.addRange(range);
    document.execCommand('insertText', false, addition ?? target);
  }
  class Binding {
    constructor() {
      this.editor = find();
      if (isNote(this.editor)) throw new Error('İç not modu açık. Önce müşteriye mesaj moduna geç.');
      this.identity = identity(this.editor); this.expected = read(this.editor); this.initial = this.expected; this.segments = []; this.lastUndo = null; this.writing = false;
    }
    valid() {
      try {return this.editor.isConnected && visible(this.editor) && !isNote(this.editor) && find() === this.editor && same(this.identity, identity(this.editor));} catch {return false;}
    }
    assert() {if (!this.valid()) throw new Error('Görüşme veya yazı alanı değişti. Dikte durduruldu.');}
    sendButton() {this.assert(); return findSendButton(this.editor);}
    async insert(text, {replace = false} = {}) {
      this.assert();
      if (read(this.editor) !== this.expected) throw new Error('Yazı alanını elle değiştirdin. Mevcut metnin korundu; yeni dikte için Alt + H.');
      if (typeof text !== 'string' || !text.trim() || text.length > 10000) throw new Error('Aktarılacak metin geçersiz.');
      const before = read(this.editor), prefix = replace ? this.initial : before;
      const target = `${prefix}${prefix && !/\s$/.test(prefix) ? ' ' : ''}${text.trim()}`;
      if (target === before) return before;
      const previousSegments = [...this.segments];
      this.writing = true;
      try {
        write(this.editor, target, target.startsWith(before) ? target.slice(before.length) : null);
        await new Promise(resolve => setTimeout(resolve, 35));
        this.assert();
        const after = read(this.editor);
        if (after !== target) throw new Error('Editör metni doğrulayamadı. Metni kontrol et; otomatik tekrar eklenmedi.');
        this.expected = after; this.lastUndo = {before: replace ? this.initial : before, after, segments: replace ? [] : previousSegments};
        this.segments = replace ? [text.trim()] : [...previousSegments, text.trim()];
        return after;
      } finally {this.writing = false;}
    }
    async undo() {
      this.assert();
      if (!this.lastUndo || read(this.editor) !== this.lastUndo.after) throw new Error('Elle değiştirilmiş metin geri alınmaz. LiveChat içinde Ctrl + Z kullanabilirsin.');
      this.editor.focus({preventScroll: true});
      this.writing = true;
      try {
        write(this.editor, this.lastUndo.before);
        await new Promise(resolve => setTimeout(resolve, 35));
        this.assert();
        this.expected = read(this.editor);
        if (this.expected !== this.lastUndo.before) throw new Error('Geri alma doğrulanamadı. Mevcut metni kontrol et.');
        this.segments = this.lastUndo.segments; this.lastUndo = null;
      } finally {this.writing = false;}
    }
    async rewrite(text) {
      this.assert();
      const current = read(this.editor);
      if (current !== this.expected && current !== this.initial && current.trim()) throw new Error('Yazı alanında farklı bir metin var. Korundu; alanı boşaltıp yeniden dene veya son dikteyi kopyala.');
      // A deliberately cleared field becomes the new prefix. Do not bring back
      // text the user removed, and never use textual similarity to delete words.
      const binding = current === this.expected || current === this.initial ? this : new Binding();
      if (binding === this) binding.expected = current;
      const before = read(binding.editor);
      await binding.insert(text, {replace: true});
      return {binding, unchanged: before === read(binding.editor)};
    }
  }
  globalThis.HizirVoiceEditor = {Binding, read, find, isNote};
})();
