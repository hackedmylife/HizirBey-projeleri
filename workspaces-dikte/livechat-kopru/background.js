'use strict';
async function prepare(reset = false) {
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const url = new URL(tab?.url || 'about:blank');
    if (url.protocol !== 'https:' || !['my.livechatinc.com', 'my.livechat.com'].includes(url.hostname)) throw new Error('Önce açık LiveChat görüşmesini seç.');
    const result = await chrome.tabs.sendMessage(tab.id, {type: reset ? 'hb:reset' : 'hb:prepare'});
    await chrome.action.setBadgeText({text: result?.ok ? 'HAZ' : '!'});
    await chrome.action.setBadgeBackgroundColor({color: result?.ok ? '#237A5A' : '#B54731'});
    await chrome.action.setTitle({title: result?.ok ? 'LiveChat alanı hazır. Yerel pano bağlantısı ayrıca doğrulanır.' : 'Görüşme veya yazı alanı değişti. Metni koruyup köprü simgesine tıklayarak yeniden bağlan.'});
  } catch {
    await chrome.action.setBadgeText({text: '!'});
    await chrome.action.setTitle({title: 'LiveChat görüşmesini açıp sayfayı yenile. Köprü kısayolu: Ctrl+Shift+Y.'});
  }
}
chrome.commands.onCommand.addListener(command => { if (command === 'prepare-transfer') void prepare(); });
chrome.action.onClicked.addListener(() => { void prepare(true); });
