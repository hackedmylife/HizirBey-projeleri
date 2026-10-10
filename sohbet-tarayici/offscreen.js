const audio = new Audio(chrome.runtime.getURL('ding.wav'));
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.target !== 'audio' || message.type !== 'play') return;
  audio.currentTime = 0;
  audio.play().then(() => respond({ ok: true }), (error) => respond({ ok: false, error: error.message }));
  return true;
});
