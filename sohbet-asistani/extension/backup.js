import {MEMORY_VERSION, MAX_EXAMPLES, MAX_BYTES, emptyMemory, makeExample, addExamples, exampleBytes} from './learning.js';

export const BACKUP_FORMAT = 'hizir-bey-learning-backup';
export const MAX_BACKUP_BYTES = 25000000;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const timestamp = value => Number.isFinite(value) && value >= 0 && value <= 8640000000000000;
const row = e => ({id: e.id, context: e.context.map(m => ({role: m.role, text: m.text})), request: e.request, response: e.response, category: e.category, origin: e.origin, createdAt: e.createdAt, updatedAt: e.updatedAt});

export function exportMemory(raw, now = Date.now()) {
  const m = raw?.version === MEMORY_VERSION ? raw : emptyMemory();
  return {format: BACKUP_FORMAT, schemaVersion: 1, exportedAt: new Date(now).toISOString(), memory: {version: MEMORY_VERSION, examples: m.examples.map(row), rejected: m.rejected.map(row), blocked: [...m.blocked], updatedAt: m.updatedAt}};
}
export async function parseBackup(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Öğrenme yedeği en fazla 25 MB olabilir.');
  let file; try {file = JSON.parse(text);} catch {throw new Error('Yedek geçerli bir JSON dosyası değil.');}
  if (file?.format !== BACKUP_FORMAT || file.schemaVersion !== 1 || file.memory?.version !== MEMORY_VERSION) throw new Error('Bu dosya desteklenen bir Hızır Bey öğrenme yedeği değil.');
  const m = file.memory;
  if (!Array.isArray(m.examples) || m.examples.length > MAX_EXAMPLES || !Array.isArray(m.rejected) || m.rejected.length > 100 || !Array.isArray(m.blocked) || m.blocked.length > 2000 || !m.blocked.every(hash)) throw new Error('Yedekteki kayıt yapısı veya sayısı geçersiz.');
  const ids = new Map();
  const restore = async (sample, index) => {
    if (!hash(sample?.id) || !Array.isArray(sample.context) || !sample.context.length || sample.context.length > 8 || sample.context.some(message => !['user', 'agent'].includes(message?.role) || typeof message.text !== 'string' || message.text.length > 350) || typeof sample.response !== 'string' || sample.response.length > 1200 || !['automatic', 'correction', 'approved'].includes(sample.origin) || !timestamp(sample.createdAt) || !timestamp(sample.updatedAt)) throw new Error(`Yedekteki ${index + 1}. örnek geçersiz. Hiçbir kayıt değiştirilmedi.`);
    const normalized = await makeExample(sample.context, sample.response, sample.origin, sample.createdAt);
    if (!normalized) throw new Error(`Yedekteki ${index + 1}. örnek kullanılabilir bir üye talebi ve yanıt içermiyor. Hiçbir kayıt değiştirilmedi.`);
    ids.set(sample.id, normalized.id);
    return {...normalized, updatedAt: sample.updatedAt};
  };
  const examples = [], rejected = [];
  for (const [index, sample] of m.examples.entries()) examples.push(await restore(sample, index));
  for (const [index, sample] of m.rejected.entries()) rejected.push(await restore(sample, index));
  if (exampleBytes(examples) > MAX_BYTES) throw new Error('Yedekteki olumlu örnekler 10 MB sınırını aşıyor.');
  return {version: MEMORY_VERSION, examples, rejected, blocked: [...new Set(m.blocked.map(id => ids.get(id) || id))], updatedAt: timestamp(m.updatedAt) ? m.updatedAt : null};
}
export function mergeBackup(raw, restored, now = Date.now()) {
  const current = raw?.version === MEMORY_VERSION ? raw : emptyMemory();
  const known = new Set([...current.examples.map(e => e.id), ...current.rejected.map(e => e.id), ...current.blocked]);
  const importedRejected = restored.rejected.filter(e => !known.has(e.id));
  const blocked = [...new Set([...restored.blocked.filter(id => !known.has(id)), ...importedRejected.map(e => e.id), ...current.blocked])].slice(-2000);
  const denied = new Set([...blocked, ...current.rejected.map(e => e.id), ...importedRejected.map(e => e.id)]);
  const incoming = restored.examples.filter(e => !known.has(e.id) && !denied.has(e.id));
  const merged = addExamples({...current, blocked}, incoming, now);
  const rejected = [...new Map([...importedRejected, ...current.rejected].map(e => [e.id, e])).values()].sort((a, b) => a.updatedAt - b.updatedAt).slice(-100);
  const memory = {...merged, rejected, updatedAt: now};
  return {memory, added: memory.examples.filter(e => !known.has(e.id)).length, rejectedAdded: rejected.filter(e => !known.has(e.id)).length};
}
