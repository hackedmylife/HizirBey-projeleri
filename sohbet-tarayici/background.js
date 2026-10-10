let creating;
async function playAlert() {
  if (!(await chrome.offscreen.hasDocument())) {
    if (!creating) {
      creating = chrome.offscreen.createDocument({
        url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'],
        justification: 'Sohbet süresi uyarı sesini çalmak.'
      }).finally(() => { creating = undefined; });
    }
    await creating;
  }
  const result = await chrome.runtime.sendMessage({ target: 'audio', type: 'play' });
  if (!result?.ok) throw new Error(result?.error || 'Ses oynatıcısı yanıt vermedi.');
  return { ok: true };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'play-alert') return;
  playAlert().then(respond, (error) => respond({ ok: false, error: error.message }));
  return true;
});
