import {normalize} from './core.js';

// These are output checks, never instructions sent to the speech model.
// Reject the entire chunk rather than deleting words and inventing a new meaning.
export function dictationTextRisk(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Boş veya geçersiz dikte.';
  const text = normalize(value.normalize('NFKC').replace(/\p{Cf}/gu, ''));
  if (/(?<![\p{L}\p{N}])(?:m[\p{P}\p{Z}\s_]*k|amk|aq|siktir|orospu)(?![\p{L}\p{N}])/u.test(text)) return 'Yanlış anlaşılabilecek ifade algılandı.';
  if (/\b(?:erisim\s+ve\s+altyazi|ceviri\s+(?:ve\s+)?altyazi|altyazi\s*[:=]|(?:translated|subtitles)\s+by\b|amara\s*\.\s*org\b)/u.test(text)) return 'Uydurma altyazı veya çeviri kalıbı algılandı.';
  if (/\b(?:izlediginiz\s+icin\s+tesekkur\w*|abone\s+olmayi\s+unutmayin|kanalima\s+abone)\b/u.test(text)) return 'Dikteye ait olmayabilecek video kapanış kalıbı algılandı.';
  return '';
}

export function inspectTranscription(result) {
  const text = typeof result?.text === 'string' ? result.text.trim() : '';
  if (!text) return {ok: true, text: ''};
  if (text.length > 10000) return {ok: false, reason: 'Geçersiz dikte uzunluğu.'};
  const risk = dictationTextRisk(text);
  if (risk) return {ok: false, reason: risk};
  const segments = result.segments;
  if (!Array.isArray(segments) || !segments.length || segments.some(s => !s || !['avg_logprob', 'no_speech_prob', 'compression_ratio'].every(key => Number.isFinite(s[key])) || s.no_speech_prob < 0 || s.no_speech_prob > 1 || s.compression_ratio <= 0)) return {ok: false, reason: 'Ses tanıma güven ölçümleri alınamadı.'};
  // Whisper's silence rule combines no-speech probability with weak decoding.
  if (segments.every(s => s.no_speech_prob > 0.6 && s.avg_logprob < -1)) return {ok: true, text: ''};
  // no_speech_prob alone is not a voice-activity verdict. Whisper itself
  // accepts a confident decode despite a high no-speech score. Compression
  // also needs corroboration: normal repetitive support wording can compress well.
  if (segments.some(s => s.avg_logprob < -1)) return {ok: false, reason: 'Ses tanıma güveni düşük; bu bölüm net anlaşılamadı.'};
  if (segments.some(s => s.compression_ratio > 2.4 && (s.avg_logprob < -0.5 || repetitionLoop(s.text || text)))) return {ok: false, reason: 'Ses tanımada düşük güvenli veya döngü halinde tekrarlanan metin algılandı.'};
  // Check each segment too: an unsafe suffix must not hide inside valid speech.
  if (segments.some(s => typeof s.text === 'string' && s.text.trim() && dictationTextRisk(s.text))) return {ok: false, reason: 'Ses parçasında şüpheli içerik algılandı.'};
  return {ok: true, text};
}

function repetitionLoop(value) {
  const tokens = normalize(value).match(/[\p{L}\p{N}]+/gu) || [];
  for (let size = 1; size <= Math.min(8, Math.floor(tokens.length / 3)); size++) {
    for (let start = 0; start + size * 3 <= tokens.length; start++) {
      let length = size;
      while (start + length < tokens.length && tokens[start + length] === tokens[start + length % size]) length++;
      if (length >= Math.max(6, size * 3) && length >= tokens.length * 0.6) return true;
    }
  }
  return false;
}

export const REJECTED_DICTATION = 'Şüpheli dikte yazılmadı; mikrofon kapatıldı. Mevcut metni kontrol et, ardından yeniden dikte başlat.';
