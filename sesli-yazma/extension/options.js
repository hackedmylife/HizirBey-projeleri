import {VERSION, STORE, MEMORY_LIMIT} from './lib/core.js';
import {boostSample} from './lib/audio.js';
const $ = id => document.getElementById(id);
let micStream = null, audioContext = null, micFrame = null, micTimer = null, toastTimer;
const ask = async message => {const result = await chrome.runtime.sendMessage(message); if (!result?.ok) throw new Error(result?.error || 'Eklentiyle bağlantı kurulamadı.'); return result.data;};
function toast(text, error = false) {clearTimeout(toastTimer); $('toast').textContent = text; $('toast').classList.toggle('error', error); $('toast').hidden = false; toastTimer = setTimeout(() => {$('toast').hidden = true;}, error ? 8000 : 4000);}
function settings() {return {model: $('model').value, correction: $('correction').checked, freeConfirmed: $('freeConfirmed').checked, cloudConsent: $('cloudConsent').checked, deviceId: $('deviceId').value, sensitivity: Number($('sensitivity').value), micGain: Number($('micGain').value), pauseMs: Number($('pauseMs').value), learn: $('learn').checked};}
function renderMetadata(data) {
  const ready = data.hasKey && data.settings.freeConfirmed && data.settings.cloudConsent && data.settings.microphoneReady;
  $('setupChip').textContent = ready ? 'Kurulum tamam · LiveChat’e geçebilirsin' : 'Kurulum bekleniyor'; $('setupChip').classList.toggle('ready', ready);
  $('stepKey').classList.toggle('done', data.hasKey && data.settings.freeConfirmed && data.settings.cloudConsent);
  $('stepMic').classList.toggle('done', data.settings.microphoneReady); $('stepReady').classList.toggle('done', ready);
  $('keyHint').textContent = data.hasKey ? 'Anahtar kayıtlı. Bu alanı boş bırakırsan mevcut anahtarın korunur.' : 'Anahtarın yalnızca bu eklentinin yerel ayarlarında saklanır.';
  $('apiKey').placeholder = data.hasKey ? 'Anahtar kayıtlı · değiştirmek için yenisini yapıştır' : 'Ücretsiz hesabının API anahtarını yapıştır';
  $('shortcutState').textContent = data.shortcut ? `Etkin kısayol: ${data.shortcut}` : 'Kısayol atanmamış. Yukarıdan Alt + H olarak ayarla.';
  $('memoryCount').textContent = `${data.memory.count.toLocaleString('tr-TR')} düzeltme`;
  $('memoryBytes').textContent = `${(data.memory.bytes / 1_000_000).toLocaleString('tr-TR', {maximumFractionDigits: 2})} / 10 MB`;
  $('memoryProgress').style.width = `${Math.min(100, data.memory.bytes / data.memory.maxBytes * 100)}%`;
  const today = new Date().toISOString().slice(0, 10), usage = data.usage.day === today ? data.usage : {};
  $('usage').textContent = `Bu eklentinin bugün ayırdığı istekler: ${usage.speech || 0} ses · ${usage.text || 0} metin. Diğer uygulamalar ve sağlayıcı kotası için Groq panelini kontrol et.`;
  $('removeKey').disabled = !data.hasKey;
}
async function load() {
  const data = await ask({type: 'ui:get'});
  renderMetadata(data);
  for (const name of ['model', 'deviceId', 'pauseMs', 'sensitivity', 'micGain']) {
    const control = $(name), value = String(data.settings[name]);
    if (name === 'deviceId' && value && ![...control.options].some(x => x.value === value)) control.add(new Option('Kaydedilmiş mikrofon', value));
    control.value = value;
  }
  for (const name of ['correction', 'freeConfirmed', 'cloudConsent', 'learn']) $(name).checked = data.settings[name];
  $('terms').value = data.terms.join('\n');
  $('sensitivityValue').textContent = Number($('sensitivity').value).toFixed(3);
  $('micGainValue').textContent = `%${Math.round(Number($('micGain').value) * 100)}`;
  if (data.settings.microphoneReady) $('micTitle').textContent = 'Mikrofon izni daha önce alındı.';
}
async function save() {
  await ask({type: 'ui:save', key: $('apiKey').value, settings: settings()});
  $('apiKey').value = ''; $('apiKey').type = 'password'; $('showKey').textContent = 'Göster'; $('showKey').setAttribute('aria-pressed', 'false');
  const data = await ask({type: 'ui:get'}); renderMetadata(data); $('saveState').textContent = 'Ayarlar kaydedildi.'; return data;
}
$('settingsForm').onsubmit = async event => {event.preventDefault(); $('save').disabled = true; try {await save(); toast('Ayarların kaydedildi.');} catch (error) {toast(error.message, true);} finally {$('save').disabled = false;}};
$('showKey').onclick = () => {const visible = $('apiKey').type === 'password'; $('apiKey').type = visible ? 'text' : 'password'; $('showKey').textContent = visible ? 'Gizle' : 'Göster'; $('showKey').setAttribute('aria-pressed', String(visible));};
$('shortcuts').onclick = () => ask({type: 'ui:shortcuts'}).catch(error => toast(error.message, true));
$('sensitivity').oninput = () => {$('sensitivityValue').textContent = Number($('sensitivity').value).toFixed(3);};
$('micGain').oninput = () => {$('micGainValue').textContent = `%${Math.round(Number($('micGain').value) * 100)}`;};
$('settingsForm').oninput = () => {$('saveState').textContent = 'Kaydedilmemiş değişiklikler var.';};
$('learn').onchange = () => {$('saveState').textContent = 'Öğrenme tercihini kaydet.';};
$('checkConnection').onclick = async () => {
  $('checkConnection').disabled = true; $('connectionResult').textContent = 'Kontrol ediliyor…';
  try {await save(); const result = await ask({type: 'ui:check'}); $('connectionResult').textContent = result.message; $('connectionResult').classList.remove('error-text'); toast(result.correctionAvailable ? result.message : 'Konuşma modeli hazır; metin modeli bu hesapta görünmüyor.', !result.correctionAvailable);}
  catch (error) {$('connectionResult').textContent = error.message; $('connectionResult').classList.add('error-text');}
  finally {$('checkConnection').disabled = false;}
};
async function stopMic() {
  cancelAnimationFrame(micFrame); clearTimeout(micTimer);
  for (const track of micStream?.getTracks() || []) track.stop(); micStream = null;
  if (audioContext?.state !== 'closed') await audioContext?.close().catch(() => {}); audioContext = null;
  $('testMic').textContent = 'Mikrofonu dene'; $('micLevel').style.width = '0%'; $('levelMeter').setAttribute('aria-valuenow', '0');
  $('micDescription').textContent = 'Test tamamlandı. Ses kaydedilmedi veya gönderilmedi.';
}
$('testMic').onclick = async () => {
  if (micStream) {await stopMic(); return;}
  $('testMic').disabled = true;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...($('deviceId').value ? {deviceId: {exact: $('deviceId').value}} : {})}});
    if (document.hidden) {for (const track of micStream.getTracks()) track.stop(); micStream = null; throw new Error('Mikrofon testi için ayarlar sekmesini açık tut.');}
    audioContext = new AudioContext(); const analyser = audioContext.createAnalyser(); analyser.fftSize = 256; audioContext.createMediaStreamSource(micStream).connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    const draw = () => {
      if (!micStream) return;
      analyser.getFloatTimeDomainData(buffer);
      const gain = Number($('micGain').value), rawRms = Math.sqrt(buffer.reduce((n, x) => n + x * x, 0) / buffer.length);
      const rms = Math.sqrt(buffer.reduce((n, x) => n + boostSample(x, gain) ** 2, 0) / buffer.length);
      const level = Math.min(100, Math.round(rms * 700));
      $('micLevel').style.width = `${level}%`; $('levelMeter').setAttribute('aria-valuenow', String(level));
      const title = rawRms >= Number($('sensitivity').value) ? 'Konuşman algılanıyor.' : 'Ses bekleniyor · normal sesinle konuş.';
      if ($('micTitle').textContent !== title) $('micTitle').textContent = title;
      micFrame = requestAnimationFrame(draw);
    }; draw();
    await ask({type: 'ui:microphone'}); renderMetadata(await ask({type: 'ui:get'}));
    const devices = await navigator.mediaDevices.enumerateDevices(), selected = $('deviceId').value;
    $('deviceId').replaceChildren(new Option('Sistem varsayılanı', ''));
    for (const device of devices.filter(x => x.kind === 'audioinput' && x.deviceId !== 'default')) $('deviceId').add(new Option(device.label || 'Mikrofon', device.deviceId));
    if ([...$('deviceId').options].some(x => x.value === selected)) $('deviceId').value = selected;
    $('micDescription').textContent = 'Seviye, seçtiğin güçlendirmeyi gösterir. Test yereldir; 15 saniyede kapanır.'; $('testMic').textContent = 'Testi bitir'; micTimer = setTimeout(stopMic, 15000);
  } catch (error) {await stopMic(); toast(error.name === 'NotAllowedError' ? 'Mikrofona izin verilmedi. Chrome site izinlerinden bu eklentiye mikrofon erişimi ver.' : 'Mikrofon açılamadı. Sistem mikrofonunu kontrol et.', true);}
  finally {$('testMic').disabled = false;}
};
$('saveTerms').onclick = async () => {try {const terms = $('terms').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean); if (terms.length > 300 || terms.some(x => x.length > 80)) throw new Error('En fazla 300 terim, terim başına 80 karakter kullan.'); await ask({type: 'ui:terms', terms}); renderMetadata(await ask({type: 'ui:get'})); toast('Özel terimlerin kaydedildi.');} catch (error) {toast(error.message, true);}};
$('export').onclick = async () => {try {const data = await ask({type: 'ui:export'}); const url = URL.createObjectURL(new Blob([data], {type: 'application/json'})); const a = document.createElement('a'); a.href = url; a.download = `Hizir-Bey-Dikte-Yedek-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Anahtar içermeyen sözlük yedeği indirildi.');} catch (error) {toast(error.message, true);}};
$('import').onchange = async event => {const file = event.target.files?.[0]; if (!file) return; try {if (file.size > MEMORY_LIMIT) throw new Error('Yedek 10 MB sınırını aşıyor.'); if (!confirm('Bu yedek mevcut terim ve düzeltme hafızasının yerini alacak. Devam edilsin mi?')) return; await ask({type: 'ui:import', data: await file.text()}); await load(); toast('Sözlük yedeği yüklendi. API anahtarın korundu.');} catch (error) {toast(error.message, true);} finally {event.target.value = '';}};
$('clearMemory').onclick = async () => {if (!confirm('Öğrenilen düzeltmeler silinsin mi? Özel terimlerin ve API anahtarın korunur.')) return; try {await ask({type: 'ui:clearMemory'}); renderMetadata(await ask({type: 'ui:get'})); toast('Öğrenilen düzeltmeler silindi.');} catch (error) {toast(error.message, true);}};
$('removeKey').onclick = async () => {if (!confirm('Kaydedilmiş API anahtarı kaldırılsın mı?')) return; try {await ask({type: 'ui:removeKey'}); renderMetadata(await ask({type: 'ui:get'})); toast('API anahtarı kaldırıldı.');} catch (error) {toast(error.message, true);}};
document.querySelectorAll('[data-version]').forEach(x => {x.textContent = VERSION;});
const sections = [...document.querySelectorAll('main section[id]')];
const observer = new IntersectionObserver(entries => {const selected = entries.filter(x => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (!selected) return; document.querySelectorAll('nav a').forEach(x => x.classList.toggle('active', x.hash === '#' + selected.target.id));}, {rootMargin: '-10% 0px -65% 0px'}); sections.forEach(x => observer.observe(x));
document.addEventListener('visibilitychange', () => {if (document.hidden && micStream) void stopMic();});
addEventListener('pagehide', () => {for (const track of micStream?.getTracks() || []) track.stop();});
chrome.storage.onChanged.addListener((changes, area) => {if (area === 'local' && changes[STORE.usage]) ask({type: 'ui:get'}).then(renderMetadata).catch(() => {});});
load().catch(error => toast(error.message, true));
