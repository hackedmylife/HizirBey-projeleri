export class AiControl {
  constructor({now = Date.now, interval = 8000} = {}) {
    this.now = now;
    this.interval = interval;
    this.nextAt = 0;
    this.cooldownAt = 0;
    this.active = false;
    this.usage = [];
    this.cache = new Map();
  }
  get(key) {
    const item = this.cache.get(key);
    if (!item || this.now() - item.at >= 300000) { this.cache.delete(key); return; }
    return item.value;
  }
  put(key, value) {
    this.cache.delete(key);
    this.cache.set(key, {at: this.now(), value});
    if (this.cache.size > 100) this.cache.delete(this.cache.keys().next().value);
  }
  waitMs(cost = 0) {
    const now = this.now();
    this.usage = this.usage.filter((item) => item.at > now - 60000);
    let used = this.usage.reduce((n, item) => n + item.cost, 0), budgetWait = 0;
    for (const item of this.usage) {
      if (used + cost <= 7000) break;
      budgetWait = item.at + 60000 - now;
      used -= item.cost;
    }
    return Math.max(this.active ? 1000 : 0, this.nextAt - now, this.cooldownAt - now, budgetWait, 0);
  }
  acquire(cost = 0) {
    if (this.waitMs(cost)) return false;
    this.active = true;
    this.nextAt = this.now() + this.interval;
    if (cost) this.usage.push({at: this.now(), cost});
    return true;
  }
  recordActual(tokens) {
    if (this.usage.length && Number.isFinite(tokens) && tokens > 0) this.usage[this.usage.length - 1].cost = tokens;
  }
  release() { this.active = false; }
  pause(ms) { this.cooldownAt = Math.max(this.cooldownAt, this.now() + ms); }
}

export function resetDuration(value) {
  if (typeof value !== 'string' || !value) return 60000;
  const units = {h: 3600000, m: 60000, s: 1000, ms: 1};
  const matches = [...value.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)];
  return matches.length ? Math.min(matches.reduce((n, match) => n + Number(match[1]) * units[match[2]], 0) + 1000, 86400000) : 60000;
}
export function headerWait(response, estimatedCost) {
  const headers = response.headers;
  const tokens = headers?.get('x-ratelimit-remaining-tokens');
  const requests = headers?.get('x-ratelimit-remaining-requests');
  let wait = 0;
  if (tokens != null && tokens !== '' && Number(tokens) < estimatedCost) wait = resetDuration(headers.get('x-ratelimit-reset-tokens'));
  if (requests != null && requests !== '' && Number(requests) <= 0) wait = Math.max(wait, resetDuration(headers.get('x-ratelimit-reset-requests')));
  return wait;
}

export function retryDelay(response, now = Date.now()) {
  const header = response.headers?.get('retry-after');
  if (header) {
    const seconds = Number(header);
    const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now;
    if (Number.isFinite(ms) && ms >= 0) return Math.min(Math.max(ms + 1000, 1000), 86400000);
  }
  return 60000;
}

export function compactInput(messages, candidates) {
  // Character ceilings bound Turkish input without requiring a tokenizer install.
  const conversation = messages.filter((m) => m.role !== 'system').slice(-12).map((m) => ({...m, text: m.text.slice(0, 280)}));
  const compact = candidates.slice(0, 12).map(t => ({
    id: t.id,
    title: `${t.label || ''} ${t.shortcut || ''}`.slice(0, 70),
    text: t.text.slice(0, 180),
    conditions: (t.profile?.conditions || []).slice(0, 3).map(s => s.slice(0, 130)),
    topics: t.profile?.primary || [],
    singleUse: Boolean(t.profile?.singleUse),
    requiresVerification: Boolean(t.guarded)
  }));
  // Cap the whole candidate payload while preserving conditions separately.
  while (JSON.stringify(compact).length > 5600 && compact.length > 1) compact.pop();
  return {conversation, candidates: compact};
}
