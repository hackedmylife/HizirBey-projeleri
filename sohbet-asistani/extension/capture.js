(() => {
  function fingerprint(text) {
    let value = 2166136261;
    for (const char of text) {value ^= char.charCodeAt(0); value = Math.imul(value, 16777619);}
    return (value >>> 0).toString(16);
  }
  class CaptureTracker {
    constructor() {this.epoch = null; this.views = new Map(); this.viewEpochs = new Map();}
    observe(snapshot, enabled, epoch) {
      const messages = snapshot.messages || [], key = snapshot.conversationId || '';
      if (!snapshot.found || !key) return [];
      const epochChanged = this.epoch !== null && this.epoch !== epoch;
      const needsBaseline = epochChanged || (epoch > 0 && this.viewEpochs.get(key) !== epoch);
      this.epoch = epoch;
      let seen = this.views.get(key);
      if (!seen) {seen = new Set(); this.views.set(key, seen);}
      const records = [];
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        const marker = fingerprint(`${m.id || ''}|${m.role}|${m.text}`);
        if (!seen.has(marker) && enabled && !needsBaseline && m.role === 'agent') records.push({marker, context: messages.slice(Math.max(0, i - 20), i), response: m.text});
        seen.add(marker);
      }
      this.viewEpochs.set(key, epoch);
      while (seen.size > 300) seen.delete(seen.values().next().value);
      if (this.views.size > 60) {const old = this.views.keys().next().value; this.views.delete(old); this.viewEpochs.delete(old);}
      return records;
    }
    retry(snapshot, records) {const seen = this.views.get(snapshot.conversationId || ''); if (seen) for (const record of records) seen.delete(record.marker);}
    baseline(snapshot, epoch) {this.observe(snapshot, false, epoch);}
  }
  globalThis.HizirCapture = {CaptureTracker};
})();
