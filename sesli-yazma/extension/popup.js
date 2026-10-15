import {VERSION} from './lib/core.js';
const $ = id => document.getElementById(id);
const ask = async message => {const r = await chrome.runtime.sendMessage(message); if (!r?.ok) throw new Error(r?.error || 'Eklenti bağlantısı kurulamadı.'); return r.data;};
function showError(error) {$('error').hidden = false; $('error').textContent = error.message;}
function render(state) {
  $('status').textContent = (state.phase !== 'error' && !state.busy && state.warning) || state.message || 'LiveChat görüşmesinde başlat.';
  $('statusDot').classList.toggle('live', Boolean(state.recording || state.busy));
  $('toggle').textContent = state.phase === 'finishing' ? 'İptal' : state.sessionId ? 'Durdur' : 'Başlat';
  $('undo').disabled = !state.sessionId || state.busy || !state.canUndo;
  $('timer').textContent = `${String(Math.floor((state.seconds || 0) / 60)).padStart(2, '0')}:${String((state.seconds || 0) % 60).padStart(2, '0')}`;
  document.querySelectorAll('#meter i').forEach((item, i) => {item.style.height = `${4 + Math.round((state.level || 0) * (i === 2 ? 13 : i % 2 ? 9 : 5))}px`;});
  $('last').hidden = !state.lastText; $('lastText').value = state.lastText || '';
}
async function load() {const data = await ask({type: 'ui:get'}); render(data.status); $('shortcut').textContent = data.shortcut || 'Kısayol atanmalı'; $('setup').textContent = data.hasKey && data.settings.microphoneReady && data.settings.freeConfirmed && data.settings.cloudConsent ? 'Kurulum tamam' : 'Ayarları tamamla';}
$('version').textContent = VERSION;
$('toggle').onclick = async () => {$('toggle').disabled = true; $('error').hidden = true; try {await ask({type: 'ui:toggle'}); await load();} catch (error) {showError(error);} finally {$('toggle').disabled = false;}};
$('options').onclick = () => ask({type: 'ui:options'}).catch(showError);
$('undo').onclick = async () => {$('undo').disabled = true; try {await ask({type: 'ui:undo'}); await load();} catch (error) {showError(error);}};
$('copy').onclick = async () => {try {await navigator.clipboard.writeText($('lastText').value); $('copy').textContent = 'Kopyalandı';} catch {showError(new Error('Metni seçip Ctrl + C ile kopyalayabilirsin.'));}};
chrome.runtime.onMessage.addListener(message => {if (message?.target === 'ui' && message.type === 'voice:status') render(message.data);});
load().catch(showError);
