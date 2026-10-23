/* Adapted from our existing LiveChat editor adapter. Only text insertion. */
(() => {
  'use strict';
  const SELECTOR = '[data-testid="chat-feed-text-area-test-id"][contenteditable="true"], #chat-feed-text-area-id[contenteditable="true"], [data-testid="message-input"][contenteditable="true"], textarea[data-testid="message-input"]';
  const visible = x => x.isConnected && x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden';
  const read = x => (x.tagName === 'TEXTAREA' ? x.value : x.innerText).replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n').replace(/\n$/, '');
  const fail = code => { throw new Error(code); };
  function find() {
    const editors = [...document.querySelectorAll(SELECTOR)].filter(visible);
    if (editors.length !== 1) fail('editor');
    return editors[0];
  }
  function isNote(editor) {
    if (editor.closest('[data-mode="note"], [data-mode="internal"], [data-internal-note="true"]')) return true;
    return [...editor.parentElement.querySelectorAll('p, [data-placeholder], [id*="placeholder"], [class*="placeholder"], [role="tab"][aria-selected="true"]')]
      .filter(x => !editor.contains(x))
      .some(x => /internal note|private note|dahili not|iç not|müşteri.*göreme/i.test(x.textContent || x.getAttribute('data-placeholder') || ''));
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
    if (!feed && !stable) fail('identity');
    return {url: location.href, feed, stable, thread};
  }
  class Binding {
    constructor() {
      this.editor = find();
      if (isNote(this.editor)) fail('note');
      this.identity = identity(this.editor);
      this.expected = read(this.editor);
    }
    assert() {
      const next = identity(this.editor);
      if (!this.editor.isConnected || !visible(this.editor) || find() !== this.editor || isNote(this.editor)
          || Object.keys(this.identity).some(k => this.identity[k] !== next[k])) fail('changed');
      if (read(this.editor) !== this.expected) fail('edited');
    }
    focus() {
      this.assert();
      this.editor.focus({preventScroll: true});
      if (document.activeElement !== this.editor) fail('focus');
    }
    async insert(text) {
      this.focus();
      const addition = `${this.expected && !/\s$/.test(this.expected) ? ' ' : ''}${text}`;
      const target = this.expected + addition;
      if (this.editor.tagName === 'TEXTAREA') {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(this.editor, target);
        this.editor.setSelectionRange(target.length, target.length);
        this.editor.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText', data: addition}));
      } else {
        const range = document.createRange();
        const last = this.editor.lastElementChild;
        const container = last?.matches('p, div') ? last : this.editor;
        range.selectNodeContents(container);
        range.collapse(container.childNodes.length === 1 && container.firstChild?.nodeName === 'BR');
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        document.execCommand('insertText', false, addition);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
      const next = identity(this.editor);
      if (!this.editor.isConnected || isNote(this.editor) || Object.keys(this.identity).some(k => this.identity[k] !== next[k])) fail('changed');
      if (read(this.editor) !== target) fail('verify');
      this.expected = target;
    }
  }
  globalThis.HizirDikteEditor = {Binding, read};
})();
