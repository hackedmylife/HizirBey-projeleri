// Bound optional language correction, including quota wait and ignored aborts.
// Speech recognition keeps its separate connection/retry policy.
export async function withTimeBudget(task, milliseconds, parentSignal) {
  if (parentSignal?.aborted) throw new DOMException('İptal edildi.', 'AbortError');
  const controller = new AbortController();
  const parentAbort = () => controller.abort(new DOMException('İptal edildi.', 'AbortError'));
  parentSignal?.addEventListener('abort', parentAbort, {once: true});
  let rejectAbort;
  const aborted = new Promise((_resolve, reject) => {rejectAbort = reject;});
  const onAbort = () => rejectAbort(controller.signal.reason);
  controller.signal.addEventListener('abort', onAbort, {once: true});
  const timer = setTimeout(() => controller.abort(new DOMException('Dil düzeltmesi için ayrılan süre doldu.', 'TimeoutError')), milliseconds);
  try {return await Promise.race([task(controller.signal), aborted]);}
  finally {clearTimeout(timer); parentSignal?.removeEventListener('abort', parentAbort); controller.signal.removeEventListener('abort', onAbort);}
}
