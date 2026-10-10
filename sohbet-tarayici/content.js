(() => {
  if (globalThis.__hizirChatScanner) return;
  globalThis.__hizirChatScanner = true;
  let enabled = true;
  let soundError = null;
  let lastScan = null;
  let lastCount = 0;
  let scanning = false;

  // Scope to chat rows and exclude names, message text, badges and menu labels.
  function isOverThreshold(text) {
    const value = text.trim().toLowerCase();
    if (!/^(?:\d+\s*[smhd]\s*)+$/.test(value)) return false;
    const units = { s: 1, m: 60, h: 3600, d: 86400 };
    let seconds = 0;
    for (const match of value.matchAll(/(\d+)\s*([smhd])/g)) {
      seconds += Number(match[1]) * units[match[2]];
    }
    return seconds >= 120;
  }

  function findTargets() {
    const list = document.querySelector('[data-testid="chat-list"]');
    if (!list) return [];
    const targets = [];
    for (const row of list.querySelectorAll('[data-testid^="chat-item-"]')) {
      const container = row.querySelector('.chat-item');
      if (!container) continue;
      const timer = Array.from(container.children).find((child) => {
        if (child.tagName !== 'DIV' || child.hasAttribute('data-testid')) return false;
        if (child.querySelector('[data-testid], button, p, svg')) return false;
        return isOverThreshold(child.textContent);
      });
      if (timer) targets.push({ row, timer });
    }
    return targets;
  }

  function highlight(timer) {
    const rect = timer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const marker = document.createElement('div');
    marker.setAttribute('aria-hidden', 'true');
    marker.style.cssText = `position:fixed;pointer-events:none;z-index:2147483647;border:3px solid #22c55e;border-radius:5px;box-sizing:border-box;left:${rect.left - 4}px;top:${rect.top - 4}px;width:${rect.width + 8}px;height:${rect.height + 8}px;`;
    document.documentElement.append(marker);
    setTimeout(() => marker.remove(), 200);
  }

  async function scan(manual = false) {
    if (scanning || !enabled) return;
    // Preserve the macro's foreground-only behavior; do not rely on hidden-tab timers.
    if (!manual && (document.visibilityState !== 'visible' || !document.hasFocus())) return;
    scanning = true;
    try {
      const targets = findTargets();
      lastScan = Date.now();
      lastCount = targets.length;
      for (const { timer } of targets) highlight(timer);
      if (targets.length) {
        const result = await chrome.runtime.sendMessage({ type: 'play-alert' });
        soundError = result?.ok ? null : result?.error || 'Ses çalınamadı.';
      }
    } catch (error) {
      soundError = error.message;
    } finally {
      scanning = false;
    }
  }

  chrome.storage.local.get({ enabled: true }).then((settings) => { enabled = settings.enabled; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) enabled = changes.enabled.newValue;
  });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type === 'status') {
      respond({ listFound: !!document.querySelector('[data-testid="chat-list"]'), count: findTargets().length, lastScan, lastCount, soundError });
    } else if (message.type === 'scan-now') {
      scan(true).then(() => respond({ count: lastCount, soundError }));
      return true;
    }
  });
  setInterval(() => { void scan(); }, 15000);
})();
