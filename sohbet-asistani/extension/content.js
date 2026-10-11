(() => {
  if (document.getElementById('hizir-assistant-host')) return;
  const host = document.createElement('div');
  host.id = 'hizir-assistant-host';
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483000;';
  const shadow = host.attachShadow({mode: 'closed'});
  shadow.innerHTML = `<style>
    :host{all:initial}*{box-sizing:border-box}section{font:13px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#edeef3;width:380px;max-width:calc(100vw - 32px);background:#14171e;border:1px solid #414034;border-radius:18px;box-shadow:0 20px 70px #0008;overflow:hidden}
    header{display:flex;align-items:center;gap:10px;padding:13px 16px;background:linear-gradient(120deg,#22252e,#191b22);border-bottom:1px solid #343641}header img{width:44px;height:44px;object-fit:contain}h1{font-size:15px;margin:0;font-weight:700}small{font-size:11px;color:#aaaebd}.grow{flex:1}button,input{font:inherit}button{cursor:pointer;border:1px solid #444753;border-radius:9px;background:#272b35;color:#f2f3f7;padding:7px 11px}button:hover{background:#353b48}button:disabled{opacity:.4;cursor:default}.icon{padding:5px 9px}.body{padding:14px}.body[hidden]{display:none}.badge{display:inline-block;background:#302e22;color:#e8ce84;font-size:10px;letter-spacing:.4px;border:1px solid #59503b;padding:3px 8px;border-radius:20px}.status{color:#aeb6c7;font-size:11px;margin:9px 0}.notice{color:#d2d7e1;font-size:12px;padding:10px;border-radius:10px;background:#202530;margin:10px 0;white-space:pre-wrap}.tools{display:flex;gap:8px}input[type=search]{min-width:0;flex:1;background:#0e1118;border:1px solid #353b49;color:#fff;border-radius:9px;padding:9px;outline:none}input:focus{border-color:#d2b66d}.cards{max-height:min(48vh,460px);overflow-y:auto;scrollbar-width:thin;margin-top:10px}.card{padding:13px;border:1px solid #363d4b;background:#1b202b;border-radius:12px;margin-bottom:10px}.top{display:flex;align-items:center;gap:8px}code{font-size:11px;color:#e3c981;background:#292c34;padding:3px 6px;border-radius:5px}.label{color:#aeb7c8;font-size:11px;margin:6px 0}.text{white-space:pre-wrap;overflow-wrap:anywhere;color:#f1f3f8;margin:9px 0;font-size:13px}.copy{background:#cfb672;color:#181b21;border:0;font-weight:650}.copy:hover{background:#e4cc89}.guard{display:block;color:#e6c785;font-size:11px;margin:10px 0}.guard input{margin-right:6px}footer{padding:10px 16px;border-top:1px solid #303642;color:#929bad;font-size:10px;display:flex;justify-content:space-between}.empty{padding:18px 6px;color:#acb5c6}a{color:inherit}
  </style><section><header><img alt=""/><div class="grow"><h1>Hızır Bey</h1><small>Sohbet Asistanı · 0.1.1</small></div><button class="icon" id="settings" title="Ayarlar">⚙</button><button class="icon" id="minimize" title="Küçült">−</button></header><div class="body"><span class="badge">YALNIZCA ÖNERİ VE KOPYALAMA</span><div class="status" id="status">Arşiv kontrol ediliyor…</div><div class="tools"><input type="search" id="search" placeholder="Kalıp veya kısayol ara…" aria-label="Kalıp ara"/><button id="review" title="Görüşmeyi yeniden değerlendir">Yenile</button></div><div class="notice" id="notice">Açık görüşme bekleniyor.</div><div class="cards" id="cards"></div></div><footer><span>Gönderme kontrolü sende</span><span id="mode">Hazır</span></footer></section>`;
  document.documentElement.append(host);
  const $ = (id) => shadow.getElementById(id);
  shadow.querySelector('img').src = chrome.runtime.getURL('logo.png');
  let minimized = false, timer, queryTimer, retryTimer, retryCount = 0, generation = 0, lastSignature = '', lastPath = '', lastStatus = '', snapshot = {messages: [], found: false}, copyContext = '';
  const ask = async (message) => {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || 'Eklenti bağlantısı yenilenmeli.');
    return response.data;
  };
  $('settings').onclick = () => ask({type: 'openOptions'}).catch(showError);
  $('minimize').onclick = () => {
    minimized = !minimized;
    shadow.querySelector('.body').hidden = minimized;
    $('minimize').textContent = minimized ? '+' : '−';
    if (minimized) { clearTimeout(retryTimer); generation++; ask({type: 'cancel'}).catch(() => {}); }
    else { lastSignature = ''; schedule(); }
  };
  function showError(error) { $('notice').textContent = error.message; $('mode').textContent = 'Kontrol gerekli'; }
  function clearCards() { $('cards').replaceChildren(); }
  function contextKey() { return `${location.pathname}|${JSON.stringify(globalThis.HizirReader.read().messages)}`; }
  function render(result, context) {
    clearCards(); copyContext = context;
    $('notice').textContent = result.notice || (result.items.length ? 'Öneriyi kullanmadan önce görüşmeye uygunluğunu kontrol et.' : 'Uygun kalıp bulunamadı. Arşivde arama yapabilirsin.');
    $('mode').textContent = ({ai: 'Yapay zekâ', local: 'Yerel eşleşme', search: 'Arşiv', empty: 'Arşiv gerekli'})[result.mode] || 'Hazır';
    if (result.elapsed) $('mode').textContent += ` · ${(result.elapsed / 1000).toFixed(1)} sn`;
    for (const item of result.items) {
      const card = document.createElement('article'); card.className = 'card';
      const top = document.createElement('div'); top.className = 'top';
      const code = document.createElement('code'); code.textContent = item.shortcut; top.append(code);
      const label = document.createElement('div'); label.className = 'label'; label.textContent = item.label;
      const text = document.createElement('div'); text.className = 'text'; text.textContent = item.text;
      const button = document.createElement('button'); button.className = 'copy'; button.textContent = 'Kopyala';
      card.append(top, label, text);
      if (item.guarded) {
        const guard = document.createElement('label'); guard.className = 'guard';
        const check = document.createElement('input'); check.type = 'checkbox';
        guard.append(check, document.createTextNode('Bu metindeki işlem ve bilgileri doğruladım.'));
        button.disabled = true; check.onchange = () => { button.disabled = !check.checked; };
        card.append(guard);
      }
      button.onclick = async () => {
        if (contextKey() !== copyContext) { showError(new Error('Görüşme değişti. Güncel öneriyi bekle veya Yenile’ye bas.')); clearCards(); schedule(); return; }
        try { await navigator.clipboard.writeText(item.text); button.textContent = 'Kopyalandı ✓'; setTimeout(() => { button.textContent = 'Kopyala'; }, 1400); }
        catch { showError(new Error('Panoya erişilemedi. Cevap metnini seçip Ctrl+C ile kopyalayabilirsin.')); }
      };
      card.append(button); $('cards').append(card);
    }
  }
  async function updateStatus(sync = false) {
    try {
      let status = await ask({type: 'status'});
      if (sync && status.autoSync) {
        try { await ask({type: 'sync'}); status = await ask({type: 'status'}); }
        catch { $('status').textContent = `${status.count} kalıp · FastKeys bağlantısı yok; son arşiv kullanılıyor`; return; }
      }
      const signature = JSON.stringify([status.count, status.updatedAt, status.aiEnabled]);
      $('status').textContent = `${status.count} kalıp · ${status.aiEnabled ? 'Yapay zekâ açık' : 'Yerel eşleşme'} · ${status.autoSync ? 'Otomatik dosya takibi' : 'İçe aktarılan arşiv'}`;
      if (signature !== lastStatus) { lastStatus = signature; lastSignature = ''; schedule(); }
    } catch (error) { showError(error); }
  }
  async function evaluate(force = false) {
    if (minimized || document.hidden) return;
    snapshot = globalThis.HizirReader.read();
    const path = location.pathname;
    if (path !== lastPath) { $('search').value = ''; clearCards(); lastPath = path; }
    const query = $('search').value.trim().slice(0, 150);
    const signature = `${path}|${query}|${JSON.stringify(snapshot.messages)}`;
    if (!force && signature === lastSignature) return;
    clearTimeout(retryTimer);
    if (signature !== lastSignature) retryCount = 0;
    lastSignature = signature;
    const mine = ++generation;
    clearCards();
    if (!snapshot.found) { ask({type: 'cancel'}).catch(() => {}); $('notice').textContent = 'Bir görüşme açıldığında öneriler burada görünecek.'; return; }
    const last = [...snapshot.messages].reverse().find((m) => m.role !== 'system');
    if (!force && !query && last?.role !== 'user') {
      ask({type: 'cancel'}).catch(() => {});
      $('notice').textContent = 'Son mesaj temsilciden veya bottan. Yeni üye mesajı bekleniyor. İstersen Yenile ile görüşmeyi değerlendirebilirsin.';
      $('mode').textContent = 'Bekleniyor'; return;
    }
    $('notice').textContent = query ? 'Arşiv aranıyor…' : 'Görüşme için kalıplar seçiliyor…';
    try {
      const result = await ask({type: 'suggest', messages: snapshot.messages, query, conversationId: path});
      if (mine !== generation || path !== location.pathname || signature !== `${location.pathname}|${$('search').value.trim().slice(0, 150)}|${JSON.stringify(globalThis.HizirReader.read().messages)}`) return;
      render(result, contextKey());
      if (!query && result.retryAfterMs > 0 && result.retryAfterMs <= 120000 && retryCount < 3) {
        retryCount++;
        const context = contextKey();
        retryTimer = setTimeout(() => {
          if (!document.hidden && !minimized && contextKey() === context) evaluate(true);
        }, result.retryAfterMs + 100);
      }
    } catch (error) { if (mine === generation) showError(error); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => evaluate(), 650); }
  $('review').onclick = () => evaluate(true);
  $('search').oninput = () => { generation++; clearTimeout(retryTimer); clearCards(); clearTimeout(queryTimer); queryTimer = setTimeout(() => evaluate(true), 300); };
  // Only react to changes near the conversation. Never write to LiveChat's editor.
  new MutationObserver((records) => {
    if (records.some((r) => {
      const n = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      return n && (n.closest?.('[data-testid="chat-feed"]') || [...r.addedNodes].some((a) => a.nodeType === 1 && (a.matches?.('[data-testid="chat-feed"]') || a.querySelector?.('[data-testid="chat-feed"]'))));
    })) schedule();
  }).observe(document.body, {subtree: true, childList: true, characterData: true});
  setInterval(() => { if (!document.hidden && !minimized) { if (location.pathname !== lastPath) schedule(); updateStatus(true); } }, 10000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastSignature = ''; schedule(); } });
  updateStatus(true); schedule();
})();
