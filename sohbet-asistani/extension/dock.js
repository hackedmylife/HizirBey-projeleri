(() => {
  const clamp = (n, min, max) => Math.max(min, Math.min(n, Math.max(min, max)));
  const rect = node => {
    if (!node?.getClientRects?.().length) return null;
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r : null;
  };
  function findSearch(root = document, width = innerWidth) {
    const candidates = new Set(root.querySelectorAll('button, [role="button"], [role="combobox"], input[type="search"], input[placeholder], [data-testid*="search"], [class*="search" i]'));
    // Some LiveChat versions expose a clickable div without an accessible role.
    for (const label of root.querySelectorAll('span, p')) {
      if (!/^(?:search|arama|ara)$/i.test((label.textContent || '').trim())) continue;
      let parent = label;
      for (let depth = 0; parent && depth < 5; depth++, parent = parent.parentElement) candidates.add(parent);
    }
    return [...candidates].map(node => {
      const r = rect(node);
      if (!r || r.top < 0 || r.bottom > 80 || r.width < 80 || r.width > Math.min(640, width * .65) || r.height < 20 || node.closest?.('[data-testid="chat-feed"]')) return null;
      const label = `${node.getAttribute('aria-label') || ''} ${node.getAttribute('placeholder') || ''} ${node.getAttribute('title') || ''} ${node.getAttribute('data-testid') || ''} ${(node.textContent || '').slice(0, 100)}`.toLowerCase();
      if (!/\bsearch\b|global.search|\barama\b|\bara\b/.test(label)) return null;
      return {node, score: (/(?:ctrl|⌘|command).*k/.test(label) ? 10 : 0) + (r.width > 220 ? 3 : 0) - Math.abs((r.left + r.width / 2) / width - .5) * 10};
    }).filter(Boolean).sort((a, b) => b.score - a.score)[0]?.node || null;
  }
  function geometry({width, height, search, feed, toolbarWidth = 264, toolbarHeight = 36, blockers = []}) {
    const margin = 12, panelWidth = Math.max(0, Math.min(424, width - margin * 2, feed?.width >= 280 ? feed.width - margin * 2 : Infinity));
    let toolbarLeft = clamp((width - toolbarWidth) / 2, margin, width - toolbarWidth - margin);
    let toolbarTop = 56, panelTop = 100;
    if (search) {
      const top = search.top + (search.height - toolbarHeight) / 2;
      const free = left => left >= margin && left + toolbarWidth <= width - margin && !blockers.some(b => left < b.right + 8 && left + toolbarWidth > b.left - 8 && top < b.bottom && top + toolbarHeight > b.top);
      const right = search.right + 12, left = search.left - toolbarWidth - 12;
      if (free(right) || free(left)) {toolbarLeft = free(right) ? right : left; toolbarTop = top; panelTop = search.bottom + 10;}
      else {toolbarTop = search.bottom + 10; panelTop = toolbarTop + toolbarHeight + 8;}
    }
    const center = search ? search.left + search.width / 2 : width / 2;
    const minLeft = feed?.width >= 280 ? Math.max(margin, feed.left + margin) : margin;
    const maxLeft = feed?.width >= 280 ? Math.min(width - panelWidth - margin, feed.right - panelWidth - margin) : width - panelWidth - margin;
    const panelLeft = clamp(center - panelWidth / 2, minLeft, maxLeft);
    // The panel ends above the message editor, inside the visible message feed.
    const bottom = Math.min(height - margin, feed ? feed.bottom - 8 : height * .65);
    const panelHeight = Math.max(0, Math.min(480, bottom - panelTop));
    return {toolbarLeft, toolbarTop, panelLeft, panelTop, panelWidth, panelHeight, anchored: Boolean(search)};
  }
  class Dock {
    constructor({toolbar, panel, root = document, viewport = window}) {
      Object.assign(this, {toolbar, panel, root, viewport});
      this.update = this.update.bind(this);
      this.schedule = () => {if (this.timer) return; this.timer = viewport.setTimeout(() => {this.timer = null; this.update();}, 100);};
      viewport.addEventListener('resize', this.schedule, {passive: true});
      viewport.addEventListener('scroll', this.schedule, {passive: true, capture: true});
      this.observer = new MutationObserver(this.schedule);
      this.observer.observe(root.body, {childList: true, subtree: true});
      this.resize = typeof ResizeObserver === 'function' ? new ResizeObserver(this.schedule) : null;
      this.update();
    }
    update() {
      const searchNode = findSearch(this.root, this.viewport.innerWidth);
      const feedNode = [...this.root.querySelectorAll('[data-testid="chat-feed"]')].find(node => rect(node));
      if (this.searchNode !== searchNode || this.feedNode !== feedNode) {
        this.resize?.disconnect();
        if (searchNode) this.resize?.observe(searchNode);
        if (feedNode) this.resize?.observe(feedNode);
        this.searchNode = searchNode; this.feedNode = feedNode;
      }
      const blockers = [...this.root.querySelectorAll('button, input, a, [role="button"], [role="combobox"]')].map(rect).filter(r => r && r.top < 80 && r.bottom > 0);
      const g = geometry({width: this.viewport.innerWidth, height: this.viewport.innerHeight, search: rect(searchNode), feed: rect(feedNode), blockers});
      Object.assign(this.toolbar.style, {left: `${g.toolbarLeft}px`, top: `${g.toolbarTop}px`});
      Object.assign(this.panel.style, {left: `${g.panelLeft}px`, top: `${g.panelTop}px`, width: `${g.panelWidth}px`, maxHeight: `${g.panelHeight}px`});
      this.toolbar.dataset.anchor = g.anchored ? 'search' : 'center';
      return g;
    }
  }
  globalThis.HizirDock = {Dock, findSearch, geometry};
})();
