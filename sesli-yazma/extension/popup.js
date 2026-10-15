import {VERSION} from './lib/core.js';
const $ = id => document.getElementById(id);
const ask = async message => {const r = await chrome.runtime.sendMessage(message); if (!r?.ok) throw new Error(r?.error || 'Eklenti bağlantısı kurulamadı.'); return r.data;};
function showError(error) {$('error').hidden = false; $('error').textContent = error.message;}
function render(state) {
  $('status').textContent = state.message || 'LiveChat görüşmesinde Alt + H ile başlat.';
  $('statusDot').classList.toggle('live', state.recording);
  $('toggle').textContent = state.phase === 'finishing' ? 'İşlemi iptal et' : state.sessionId ? 'Dinlemeyi bitir' : 'Dikteyi başlat';
  $('last').hidden = !state.lastText; $('lastText').value = state.lastText || '';
}
async function load() {const data = await ask({type: 'ui:get'}); render(data.status); $('shortcut').textContent = data.shortcut || 'Kısayol atanmalı'; $('setup').textContent = data.hasKey && data.settings.microphoneReady && data.settings.freeConfirmed && data.settings.cloudConsent ? 'Kurulum tamam' : 'Ayarları tamamla';}
$('version').textContent = VERSION;
$('toggle').onclick = async () => {$('toggle').disabled = true; $('error').hidden = true; try {await ask({type: 'ui:toggle'}); await load();} catch (error) {showError(error);} finally {$('toggle').disabled = false;}};
$('options').onclick = () => ask({type: 'ui:options'}).catch(showError);
$('copy').onclick = async () => {try {await navigator.clipboard.writeText($('lastText').value); $('copy').textContent = 'Kopyalandı';} catch {showError(new Error('Metni seçip Ctrl + C ile kopyalayabilirsin.'));}};
chrome.runtime.onMessage.addListener(message => {if (message?.target === 'ui' && message.type === 'voice:status') render(message.data);});
load().catch(showError);
