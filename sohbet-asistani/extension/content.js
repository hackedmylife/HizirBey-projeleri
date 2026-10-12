(() => {
  if (document.getElementById('hizir-assistant-host')) return;
  const host = document.createElement('div');
  host.id = 'hizir-assistant-host';
  host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147483000;';
  const shadow = host.attachShadow({mode: 'closed'});
  shadow.innerHTML = `<style>
    :host{all:initial}*{box-sizing:border-box}section{font:13px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#edeef3;width:380px;max-width:calc(100vw - 32px);background:#14171e;border:1px solid #414034;border-radius:18px;box-shadow:0 20px 70px #0008;overflow:hidden}
    header{display:flex;align-items:center;gap:10px;padding:13px 16px;background:linear-gradient(120deg,#22252e,#191b22);border-bottom:1px solid #343641}header img{width:44px;height:44px;object-fit:contain}h1{font-size:15px;margin:0;font-weight:700}small{font-size:11px;color:#aaaebd}.grow{flex:1}button,input{font:inherit}button{cursor:pointer;border:1px solid #444753;border-radius:9px;background:#272b35;color:#f2f3f7;padding:7px 11px}button:hover{background:#353b48}button:disabled{opacity:.4;cursor:default}.icon{padding:5px 9px}.body{padding:14px}.body[hidden]{display:none}.badge{display:inline-block;background:#302e22;color:#e8ce84;font-size:10px;letter-spacing:.4px;border:1px solid #59503b;padding:3px 8px;border-radius:20px}.status{color:#aeb6c7;font-size:11px;margin:9px 0}.notice{color:#d2d7e1;font-size:12px;padding:10px;border-radius:10px;background:#202530;margin:10px 0;white-space:pre-wrap}.tools{display:flex;gap:8px}input[type=search]{min-width:0;flex:1;background:#0e1118;border:1px solid #353b49;color:#fff;border-radius:9px;padding:9px;outline:none}input:focus{border-color:#d2b66d}.cards{max-height:min(48vh,460px);overflow-y:auto;scrollbar-width:thin;margin-top:10px}.card{padding:13px;border:1px solid #363d4b;background:#1b202b;border-radius:12px;margin-bottom:10px}.top{display:flex;align-items:center;gap:8px}code{font-size:11px;color:#e3c981;background:#292c34;padding:3px 6px;border-radius:5px}.label{color:#aeb7c8;font-size:11px;margin:6px 0}.text{white-space:pre-wrap;overflow-wrap:anywhere;color:#f1f3f8;margin:9px 0;font-size:13px}.copy{background:#cfb672;color:#181b21;border:0;font-weight:650}.copy:hover{background:#e4cc89}.guard{display:block;color:#e6c785;font-size:11px;margin:10px 0}.guard input{margin-right:6px}footer{padding:10px 16px;border-top:1px solid #303642;color:#929bad;font-size:10px;display:flex;justify-content:space-between}.empty{padding:18px 6px;color:#acb5c6}a{color:inherit}
    .learningbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 14px;border-bottom:1px solid #343641;font-size:11px;color:#b9d4c6;background:#18221e}.learningbar button{font-size:11px;padding:5px 9px}.feedback{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.feedback button{font-size:11px;padding:5px 8px}.teach{margin-top:12px;padding-top:10px;border-top:1px solid #363d4b}.teach textarea{width:100%;min-height:110px;resize:vertical;background:#10151e;color:#fff;border:1px solid #485369;border-radius:8px;padding:9px;font:12px/1.5 system-ui}.teach small{display:block;margin:6px 0}
  
    section.panel{position:fixed;pointer-events:auto;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;max-width:calc(100vw - 24px);border-radius:16px}section.panel[hidden]{display:none}.body{min-height:0;overflow-y:auto;scrollbar-width:thin;overscroll-behavior:contain}.cards{max-height:none;overflow:visible}.panel header{padding:10px 14px}.panel header img{width:36px;height:36px}.panel footer{font-size:10px}.dock{position:fixed;pointer-events:auto;display:flex;align-items:center;gap:6px;width:264px;height:36px;font:12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;color:#edeef3}.dock button{margin:0;height:36px;white-space:nowrap;padding:5px 9px;border-radius:8px}.launcher{flex:0 0 140px;display:flex;align-items:center;gap:7px;background:#252922;border-color:#73633a;font-weight:650}.launcher img{width:22px;height:22px;object-fit:contain}.launcher .chevron{font-size:10px;color:#d4bc7f}.launcher[aria-expanded=true] .chevron{transform:rotate(180deg)}.dot{width:6px;height:6px;border-radius:50%;background:#9ba4b2}.dot[data-enabled=true]{background:#82c7a0}#dockLearning{flex:1;font-size:10px;color:#c7d0de;background:#1d232c;border-color:#364353}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #d2b66d;outline-offset:2px}.learningbar button{white-space:nowrap}
  </style><div id="dock" class="dock" role="group" aria-label="Hızır Bey asistan kontrolleri"><button id="launcher" class="launcher" aria-expanded="true" aria-controls="panel" title="Asistan panelini aç veya kapat"><img alt=""/><span>Hızır Bey</span><span id="learningDot" class="dot" aria-hidden="true"></span><span class="chevron" aria-hidden="true">▾</span></button><button id="dockLearning" disabled title="Panel kapalıyken de bütün görüşmelerden otomatik öğrenmeyi durdurabilir veya başlatabilirsin">Öğrenme</button></div><section id="panel" class="panel" aria-label="Hızır Bey yanıt önerileri"><header><img alt=""/><div class="grow"><h1>Hızır Bey</h1><small>Sohbet Asistanı · 0.3.2</small></div><button class="icon" id="settings" title="Ayarlar">⚙</button><button class="icon" id="close" title="Görüşmeyi kapatmadan asistanı gizle. Öğrenme ayarı korunur" aria-label="Asistan panelini kapat">×</button></header><div class="learningbar"><span id="learningState">Öğrenme durumu kontrol ediliyor…</span><button id="learningToggle" disabled title="Tüm LiveChat sekmelerinde yeni örnek toplamayı durdur veya başlat">Durdur</button></div><div class="body"><span class="badge">YALNIZCA ÖNERİ VE KOPYALAMA</span><div class="status" id="status">Arşiv kontrol ediliyor…</div><div class="tools"><input type="search" id="search" placeholder="Kalıp veya kısayol ara…" aria-label="Kalıp ara"/><button id="review" title="Görüşmeyi yeniden değerlendir">Yenile</button></div><div class="notice" id="notice">Açık görüşme bekleniyor.</div><div class="cards" id="cards"></div></div><footer><span>Gönderme kontrolü sende</span><span id="mode">Hazır</span></footer></section>`;
  document.documentElement.append(host);
  const $ = (id) => shadow.getElementById(id);
  let panelOpen = true;
  try {panelOpen = sessionStorage.getItem('hizir.assistant.panel.open') !== 'false';} catch { /* panel state is optional */ }
  let timer, queryTimer, retryTimer, retryCount = 0, generation = 0, lastSignature = '', lastPath = '', lastStatus = '', snapshot = {messages: [], found: false}, copyContext = '';
  shadow.querySelectorAll('img').forEach(img => {img.src = chrome.runtime.getURL('logo.png');});
  const dock = new globalThis.HizirDock.Dock({toolbar: $('dock'), panel: $('panel')});
  let learning = null, captureTimer, captureBusy = false, captureAgain = false;
  const tracker = new globalThis.HizirCapture.CaptureTracker();
  const ask = async (message) => {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || 'Eklenti bağlantısı yenilenmeli.');
    return response.data;
  };
  function currentView() {const view = globalThis.HizirReader.read(); return {...view, conversationId: view.conversationId || location.pathname};}
  function allViews() {return globalThis.HizirReader.readAll ? globalThis.HizirReader.readAll() : [currentView()];}
  function applyLearning(state, reset = false) {
    if (!state || (learning && state.epoch < learning.epoch)) return;
    if (reset || (learning && state.epoch !== learning.epoch)) for (const view of allViews()) tracker.baseline(view, state.epoch);
    learning = state;
    $('learningState').textContent = `${state.enabled ? 'Öğrenme açık' : 'Öğrenme durduruldu'} · ${state.count} örnek`;
    $('learningToggle').textContent = state.enabled ? 'Durdur' : 'Başlat';
    $('learningToggle').disabled = false;
    $('dockLearning').textContent = state.enabled ? 'Öğrenmeyi durdur' : 'Öğrenmeyi başlat';
    $('dockLearning').disabled = false;
    $('dockLearning').title = 'Tüm LiveChat sekmelerinde otomatik öğrenmeyi durdur veya başlat. Paneli kapatmak bu ayarı değiştirmez.';
    $('learningDot').dataset.enabled = String(state.enabled);
    $('launcher').title = `${state.enabled ? 'Öğrenme açık' : 'Öğrenme durduruldu'} · ${state.count} örnek. Asistan panelini aç veya kapat.`;
  }
  function scheduleCapture() {clearTimeout(captureTimer); captureTimer = setTimeout(collectLearning, 450);}
  async function collectLearning() {
    if (!learning) return;
    if (captureBusy) {captureAgain = true; return;}
    const batches = allViews().map(view => ({view, records: tracker.observe(view, learning.enabled, learning.epoch)})).filter(batch => batch.records.length);
    if (!batches.length) return;
    captureBusy = true;
    const epoch = learning.epoch;
    try {
      for (const {view, records} of batches) {
        const result = await ask({type: 'observeLearning', records, epoch, conversationId: view.conversationId});
        applyLearning(result.learning, result.resetBaseline);
        if (result.resetBaseline) break;
      }
    } catch {
      if (learning.epoch === epoch) for (const batch of batches) tracker.retry(batch.view, batch.records);
      $('learningState').textContent = 'Örnek kaydı yapılamadı · Yeniden denenecek';
      clearTimeout(captureTimer); captureTimer = setTimeout(collectLearning, 10000);
    }
    finally {captureBusy = false; if (captureAgain) {captureAgain = false; scheduleCapture();}}
  }
  const toggleLearning = async () => {
    if (!learning) return;
    $('learningToggle').disabled = $('dockLearning').disabled = true;
    try {applyLearning(await ask({type: 'setLearning', enabled: !learning.enabled}), true);}
    catch (error) {showError(error); $('dockLearning').textContent = 'Yeniden dene'; $('dockLearning').title = error.message; $('learningToggle').disabled = $('dockLearning').disabled = false;}
  };
  $('learningToggle').onclick = $('dockLearning').onclick = toggleLearning;
  $('settings').onclick = () => ask({type: 'openOptions'}).catch(showError);
  function setPanelOpen(open) {
    panelOpen = open;
    $('panel').hidden = !open;
    $('launcher').setAttribute('aria-expanded', String(open));
    try {sessionStorage.setItem('hizir.assistant.panel.open', String(open));} catch { /* keep working if page storage is unavailable */ }
    dock.update();
    if (!open) {clearTimeout(timer); clearTimeout(queryTimer); clearTimeout(retryTimer); generation++; ask({type: 'cancel'}).catch(() => {});}
    else {lastSignature = ''; schedule();}
  }
  $('launcher').onclick = () => setPanelOpen(!panelOpen);
  $('close').onclick = () => {setPanelOpen(false); $('launcher').focus();};
  shadow.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panelOpen) {event.preventDefault(); event.stopPropagation(); setPanelOpen(false); $('launcher').focus();}
    else if (!((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) event.stopPropagation();
  });
  setPanelOpen(panelOpen);
  function showError(error) { $('notice').textContent = error.message; $('mode').textContent = 'Kontrol gerekli'; }
  function clearCards() { $('cards').replaceChildren(); }
  function contextKey() { const view = currentView(); return `${view.conversationId}|${JSON.stringify(view.messages)}`; }
  function render(result, context) {
    clearCards(); copyContext = context;
    $('notice').textContent = result.notice || (result.items.length ? 'Öneriyi kullanmadan önce görüşmeye uygunluğunu kontrol et.' : 'Yanıt hazırlanamadı. Yenile ile tekrar deneyebilirsin.');
    $('mode').textContent = ({ai: result.provider || 'Yapay zekâ', prepared: 'Hazır destek yanıtı', local: 'Yerel eşleşme', search: 'Arşiv', empty: 'Arşiv gerekli'})[result.mode] || 'Hazır';
    if (result.elapsed) $('mode').textContent += ` · ${(result.elapsed / 1000).toFixed(1)} sn`;
    for (const item of result.items) {
      const card = document.createElement('article'); card.className = 'card';
      const top = document.createElement('div'); top.className = 'top';
      const code = document.createElement('code'); code.textContent = item.shortcut || 'Yanıt'; top.append(code);
      const label = document.createElement('div'); label.className = 'label'; label.textContent = item.label || '';
      const text = document.createElement('div'); text.className = 'text'; text.textContent = item.text;
      const button = document.createElement('button'); button.className = 'copy'; button.textContent = 'Kopyala';
      card.append(top, label, text);
      if (item.guarded) {
        const guard = document.createElement('label'); guard.className = 'guard';
        const check = document.createElement('input'); check.type = 'checkbox';
        guard.append(check, document.createTextNode(item.verificationNote ? `${item.verificationNote} Kontrol ettim.` : 'Bu metindeki işlem ve bilgileri doğruladım.'));
        button.disabled = true; check.onchange = () => { button.disabled = !check.checked; };
        card.append(guard);
      }
      button.onclick = async () => {
        if (contextKey() !== copyContext) { showError(new Error('Görüşme değişti. Güncel öneriyi bekle veya Yenile’ye bas.')); clearCards(); schedule(); return; }
        try { await navigator.clipboard.writeText(item.text); button.textContent = 'Kopyalandı ✓'; setTimeout(() => { button.textContent = 'Kopyala'; }, 1400); }
        catch { showError(new Error('Panoya erişilemedi. Cevap metnini seçip Ctrl+C ile kopyalayabilirsin.')); }
      };
      card.append(button);
      if (result.mode !== 'search') {
        const feedback = document.createElement('div'); feedback.className = 'feedback';
        const approve = document.createElement('button'); approve.textContent = 'Beğendim';
        const reject = document.createElement('button'); reject.textContent = 'Uygun değil';
        const edit = document.createElement('button'); edit.textContent = 'Düzelt ve öğret';
        const captured = currentView();
        const checkView = () => {if (contextKey() !== context) throw new Error('Görüşme değişti. Güncel yanıt üzerinden devam et.');};
        approve.onclick = async () => {
          approve.disabled = true;
          try {checkView(); const r = await ask({type: 'teachReply', messages: captured.messages, text: item.text, origin: 'approved'}); applyLearning(r.learning); approve.textContent = 'Örnek kaydedildi';}
          catch (error) {showError(error); approve.disabled = false;}
        };
        reject.onclick = async () => {
          reject.disabled = true;
          try {checkView(); const r = await ask({type: 'rejectReply', messages: captured.messages, text: item.text}); applyLearning(r.learning); $('notice').textContent = r.notice; reject.textContent = 'Kaydedildi';}
          catch (error) {showError(error); reject.disabled = false;}
        };
        edit.onclick = () => {
          if (card.querySelector('.teach')) return;
          const editor = document.createElement('div'); editor.className = 'teach';
          const hint = document.createElement('small'); hint.textContent = 'İstediğin yanıtı yaz. Bu alan öğrenme içindir; LiveChat mesajı göndermez.';
          const input = document.createElement('textarea'); input.value = item.text; input.maxLength = 1800; input.setAttribute('aria-label', 'Öğrenilecek düzeltilmiş yanıt');
          const save = document.createElement('button'); save.textContent = 'Düzeltmeyi kaydet';
          const cancel = document.createElement('button'); cancel.textContent = 'Vazgeç'; cancel.onclick = () => editor.remove();
          save.onclick = async () => {
            save.disabled = true;
            try {checkView(); const r = await ask({type: 'teachReply', messages: captured.messages, text: input.value, origin: 'correction'}); applyLearning(r.learning); editor.remove(); $('notice').textContent = r.notice;}
            catch (error) {showError(error); save.disabled = false;}
          };
          editor.append(hint, input, save, cancel); card.append(editor); input.focus();
        };
        feedback.append(approve, reject, edit); card.append(feedback);
      }
      $('cards').append(card);
    }
  }
  async function updateStatus(sync = false) {
    try {
      let status = await ask({type: 'status'});
      let syncFailed = false;
      if (sync && status.autoSync) {
        try { await ask({type: 'sync'}); status = await ask({type: 'status'}); }
        catch {syncFailed = true;}
      }
      applyLearning(status.learning); scheduleCapture();
      const signature = JSON.stringify([status.count, status.updatedAt, status.aiEnabled, status.revision]);
      const k = status.knowledge || {}, connections = (status.providers || []).filter(p => p.enabled && p.hasKey).length;
      $('status').textContent = `${status.useFastKeys ? `${status.count} FastKeys metni` : `Öğrenme hafızası · ${status.learning?.count || 0} örnek`} · ${status.aiEnabled ? `${connections} AI bağlantısı` : 'AI kapalı'}${status.useFastKeys && k.total && k.done < k.total ? ` · Arşiv analizi ${k.done}/${k.total}` : ''} · ${status.useFastKeys ? 'FastKeys kaynak olarak açık' : 'FastKeys otomatik yanıtlarda kapalı'}`;
      if (syncFailed) $('status').textContent += ' · FastKeys bağlantısı yok; son arşiv kullanılıyor';
      if (signature !== lastStatus) { lastStatus = signature; lastSignature = ''; schedule(); }
    } catch (error) { showError(error); }
  }
  async function evaluate(force = false) {
    if (!panelOpen || document.hidden) return;
    snapshot = currentView();
    const path = snapshot.conversationId;
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
    $('notice').textContent = query ? 'Arşiv aranıyor…' : 'Görüşme için üç yanıt hazırlanıyor…';
    try {
      const result = await ask({type: 'suggest', messages: snapshot.messages, query, conversationId: path});
      if (!panelOpen || mine !== generation || path !== currentView().conversationId || signature !== `${currentView().conversationId}|${$('search').value.trim().slice(0, 150)}|${JSON.stringify(currentView().messages)}`) return;
      render(result, contextKey());
      if (!query && result.retryAfterMs > 0 && result.retryAfterMs <= 120000 && retryCount < 3) {
        retryCount++;
        const context = contextKey();
        retryTimer = setTimeout(() => {
          if (!document.hidden && panelOpen && contextKey() === context) evaluate(true);
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
    })) {scheduleCapture(); schedule();}
  }).observe(document.body, {subtree: true, childList: true, characterData: true});
  setInterval(() => { dock.update(); scheduleCapture(); updateStatus(!document.hidden); if (!document.hidden && panelOpen && currentView().conversationId !== lastPath) schedule(); }, 10000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastSignature = ''; schedule(); } });
  updateStatus(!document.hidden); if (panelOpen) schedule();
})();
