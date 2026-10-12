import {AiControl, headerWait, retryDelay, resetDuration} from './ai-control.js';

export const PROVIDERS = ['groq', 'gemini', 'openrouter'];
export const NAMES = {groq: 'Groq', gemini: 'Gemini', openrouter: 'OpenRouter'};
const MODELS = {groq: 'openai/gpt-oss-20b', gemini: 'gemini-2.5-flash-lite', openrouter: 'openrouter/free'};
export const isFreeRouter = model => model === 'openrouter/free' || model.endsWith(':free');
export function normalizeSettings(raw = {}) {
  const providers = Object.fromEntries(PROVIDERS.map(id => [id, {
    enabled: id === 'groq', model: MODELS[id], ...raw.providers?.[id],
    ...(id === 'groq' && !raw.providers?.groq ? {apiKey: raw.apiKey || '', model: raw.model || MODELS.groq} : {})
  }]));
  const order = [...new Set((Array.isArray(raw.providerOrder) ? raw.providerOrder : PROVIDERS).filter(id => PROVIDERS.includes(id)))];
  return {aiEnabled: Boolean(raw.aiEnabled), autoSync: Boolean(raw.autoSync), useFastKeys: raw.useFastKeys === true, learningEnabled: raw.learningEnabled !== false, useExamples: raw.useExamples !== false, learningEpoch: Number(raw.learningEpoch) || 0, providers, providerOrder: [...order, ...PROVIDERS.filter(id => !order.includes(id))], allowPaid: Boolean(raw.allowPaid), monthlyBudget: Number(raw.monthlyBudget) || 5};
}
export function mergeSettings(oldRaw, patch) {
  const old = normalizeSettings(oldRaw), value = normalizeSettings({...old, ...patch, providers: old.providers});
  // Legacy options pages can save without deleting new provider credentials.
  const changes = patch.providers || {groq: {apiKey: patch.apiKey, clearKey: patch.clearKey, model: patch.model}};
  for (const id of PROVIDERS) {
    const change = changes[id]; if (!change) continue;
    const target = value.providers[id] = {...old.providers[id]};
    if ('enabled' in change) target.enabled = Boolean(change.enabled);
    if (change.model) target.model = String(change.model).trim();
    if (change.clearKey) delete target.apiKey;
    else if (typeof change.apiKey === 'string' && change.apiKey.trim()) target.apiKey = change.apiKey.trim();
    if (target.apiKey && (target.apiKey.length > 512 || /\s/.test(target.apiKey))) throw new Error(`${NAMES[id]} anahtar biçimini kontrol et.`);
    if (id === 'groq' && !/^openai\/gpt-oss-(?:20b|120b)$/.test(target.model)) throw new Error('Desteklenen Groq modelini seç.');
    if (id === 'gemini' && !/^gemini-[a-z0-9.-]{3,80}$/.test(target.model)) throw new Error('Gemini model kimliğini kontrol et.');
    if (id === 'openrouter' && !/^[a-z0-9._-]+\/[a-z0-9._:+-]{1,100}$/i.test(target.model)) throw new Error('OpenRouter model kimliğini kontrol et.');
  }
  if (!Number.isFinite(value.monthlyBudget) || value.monthlyBudget < 1 || value.monthlyBudget > 100) throw new Error('Aylık bütçe 1–100 USD arasında olmalı.');
  const router = value.providers.openrouter;
  if (router.enabled && !isFreeRouter(router.model) && !value.allowPaid) throw new Error('Ücretli OpenRouter modeli için ücretli geçişi ve aylık sınırı açıkça etkinleştir.');
  return value;
}
export function publicSettings(raw) {
  const value = normalizeSettings(raw);
  return {...value, providers: Object.fromEntries(PROVIDERS.map(id => {
    const {apiKey, ...rest} = value.providers[id]; return [id, {...rest, hasKey: Boolean(apiKey)}];
  }))};
}
export function buildRequest(id, config, system, input, maxTokens) {
  const text = JSON.stringify(input);
  if (id === 'gemini') return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
    headers: {'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey},
    body: {systemInstruction: {parts: [{text: system}]}, contents: [{role: 'user', parts: [{text}]}], generationConfig: {temperature: 0.25, maxOutputTokens: maxTokens, responseMimeType: 'application/json'}}
  };
  return {
    url: id === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`},
    body: {model: config.model, temperature: 0.25, response_format: {type: 'json_object'}, messages: [{role: 'system', content: system}, {role: 'user', content: text}],
      ...(id === 'groq' ? {max_completion_tokens: maxTokens, reasoning_effort: 'low'} : {max_tokens: maxTokens, provider: {require_parameters: true}})}
  };
}
export function extractOutput(id, body) {
  const text = id === 'gemini' ? body.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') : body.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('empty');
  if ((id === 'gemini' ? body.candidates?.[0]?.finishReason : body.choices?.[0]?.finish_reason) === (id === 'gemini' ? 'MAX_TOKENS' : 'length')) throw new Error('truncated');
  return JSON.parse(text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''));
}
export async function verifyPaidKey(config, budget, signal, fetcher = fetch) {
  const r = await fetcher('https://openrouter.ai/api/v1/key', {signal, headers: {Authorization: `Bearer ${config.apiKey}`}});
  if (!r.ok) throw new Error('Ücretli OpenRouter anahtarının aylık sınırı doğrulanamadı.');
  const data = (await r.json()).data;
  if (!data || !Number.isFinite(data.limit) || data.limit <= 0 || data.limit > budget || data.limit_reset !== 'monthly' || !Number.isFinite(data.limit_remaining) || data.limit_remaining <= 0) throw new Error('OpenRouter’da bu anahtar için bütçeni aşmayan aylık kredi sınırı ayarla. Sınır yoksa ücretli geçiş kullanılmaz.');
}

export class ProviderPool {
  constructor({now = Date.now, fetcher = (...args) => fetch(...args), persist = async () => {}, timeout = 12000} = {}) {
    this.now = now; this.fetcher = fetcher; this.persist = persist; this.timeout = timeout;
    this.controls = Object.fromEntries(PROVIDERS.map(id => [id, new AiControl({now, interval: id === 'groq' ? 8000 : 4000, budget: id === 'groq' ? 7000 : 10000})]));
    this.errors = {}; this.cache = new AiControl({now});
  }
  restore(saved = {}) {
    for (const id of PROVIDERS) {
      const s = saved[id]; if (!s) continue;
      const c = this.controls[id]; c.nextAt = Number(s.nextAt) || 0; c.cooldownAt = Number(s.cooldownAt) || 0;
      c.usage = Array.isArray(s.usage) ? s.usage.filter(item => Number.isFinite(item.at) && Number.isFinite(item.cost)) : [];
      this.errors[id] = s.error || '';
    }
  }
  snapshot() { return Object.fromEntries(PROVIDERS.map(id => {const c = this.controls[id]; return [id, {nextAt: c.nextAt, cooldownAt: c.cooldownAt, usage: c.usage, error: this.errors[id] || ''}];})); }
  status(settings) { return PROVIDERS.map(id => ({id, name: NAMES[id], enabled: settings.providers[id].enabled, hasKey: Boolean(settings.providers[id].apiKey), waitMs: this.controls[id].waitMs(), error: this.errors[id] || ''})); }
  async run({settings, system, input, validate = value => value, maxTokens = 1800, signal}) {
    const failures = [], waits = [];
    const cost = Math.ceil((system.length + JSON.stringify(input).length) / 3) + maxTokens;
    const order = settings.providerOrder.filter(id => settings.providers[id].enabled && settings.providers[id].apiKey);
    for (const id of order) {
      if (signal?.aborted) throw new DOMException('İptal edildi', 'AbortError');
      const config = settings.providers[id], control = this.controls[id];
      if (id === 'openrouter' && !isFreeRouter(config.model) && !settings.allowPaid) { failures.push({id, reason: 'paid'}); continue; }
      if (!control.acquire(cost)) { waits.push(control.waitMs(cost)); continue; }
      const child = new AbortController();
      const abort = () => child.abort(); signal?.addEventListener('abort', abort, {once: true});
      const timer = setTimeout(abort, this.timeout);
      try {
        await this.persist(this.snapshot());
        if (id === 'openrouter' && !isFreeRouter(config.model)) await verifyPaidKey(config, settings.monthlyBudget, child.signal, this.fetcher);
        if (signal?.aborted) throw new DOMException('İptal edildi', 'AbortError');
        const request = buildRequest(id, config, system, input, maxTokens);
        const response = await this.fetcher(request.url, {method: 'POST', headers: request.headers, body: JSON.stringify(request.body), signal: child.signal});
        const wait = id === 'groq' ? headerWait(response, cost) : 0;
        if (wait) control.pause(wait);
        if (!response.ok) {
          let body; try { body = await response.json(); } catch { /* use status */ }
          const retry = body?.error?.details?.find(detail => detail.retryDelay)?.retryDelay;
          const reason = response.status === 429 ? 'quota' : [401, 403].includes(response.status) ? 'credentials' : response.status === 402 ? 'credit' : response.status === 400 || response.status === 404 ? 'configuration' : 'connection';
          control.pause(response.status === 429 ? Math.max(retryDelay(response, this.now()), retry ? resetDuration(retry) : 0) : ['credentials', 'credit', 'configuration'].includes(reason) ? 300000 : 15000);
          this.errors[id] = reason; failures.push({id, reason}); waits.push(control.waitMs(cost)); continue;
        }
        const body = await response.json();
        control.recordActual(id === 'gemini' ? body.usageMetadata?.totalTokenCount : body.usage?.total_tokens);
        const value = validate(extractOutput(id, body));
        if (signal?.aborted) throw new DOMException('İptal edildi', 'AbortError');
        this.errors[id] = '';
        return {ok: true, value, provider: id, model: body.model || config.model, switched: order[0] !== id};
      } catch (error) {
        if (signal?.aborted) throw new DOMException('İptal edildi', 'AbortError');
        const reason = child.signal.aborted ? 'timeout' : error?.message?.includes('OpenRouter') ? 'budget' : 'quality';
        control.pause(reason === 'budget' ? 300000 : reason === 'quality' ? 30000 : 15000);
        this.errors[id] = reason; failures.push({id, reason}); waits.push(control.waitMs(cost));
      } finally {
        clearTimeout(timer); signal?.removeEventListener('abort', abort); control.release();
        await this.persist(this.snapshot());
      }
    }
    const retryAfterMs = waits.length ? Math.min(...waits.filter(ms => ms > 0)) : 0;
    return {ok: false, failures, configured: order.length, retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : 0};
  }
}
