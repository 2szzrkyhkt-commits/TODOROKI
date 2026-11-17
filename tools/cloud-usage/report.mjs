// Offline operational evidence: never connects to Cloudflare or changes schedules.
export function assess(snapshot) {
  const {period, workers, d1, plan} = snapshot;
  const start = Date.parse(period?.start), end = Date.parse(period?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) ||
      end - start !== 86400000 || start % 86400000 !== 0) {
    throw new Error('A complete UTC day is required');
  }
  if (!Array.isArray(workers) || !workers.length) throw new Error('Worker observations required');
  const names = new Set();
  let requests = 0, errors = 0;
  const count = v => {
    if (!Number.isSafeInteger(v) || v < 0) throw new Error('Missing or invalid counter');
    return v;
  };
  for (const w of workers) {
    if (typeof w.name !== 'string' || !w.name || names.has(w.name)) throw new Error('Duplicate or invalid worker');
    names.add(w.name);
    requests += count(w.requests); errors += count(w.errors);
    if (w.errors > w.requests) throw new Error('Errors exceed invocations');
  }
  if (!Number.isSafeInteger(requests) || !Number.isSafeInteger(errors)) throw new Error('Counter overflow');
  const d1Usage = d1 == null ? null : {
    rowsRead: count(d1.rowsRead), rowsWritten: count(d1.rowsWritten), storageBytes: count(d1.storageBytes)
  };
  // Reference limits are dated in the evidence file; comparison is not a bill.
  const complete = d1Usage !== null && plan === 'free' && snapshot.kvVerified === true && snapshot.r2Verified === true;
  return {
    period, observedWorkers: names.size, requests, errors,
    workersFreeReference: {dailyRequests: 100000, percent: requests / 1000, within: requests <= 100000},
    d1: d1Usage && {...d1Usage, readPercent: d1Usage.rowsRead / 50000,
      writePercent: d1Usage.rowsWritten / 1000, storageLimitBytes: 5e9},
    contractVerified: plan === 'free' || plan === 'paid',
    freeUsageAssessmentComplete: complete,
    billingConclusion: 'not_assessed',
    absentWorkers: 'unobserved_not_zero',
    limits: ['Adaptive analytics may be sampled; invocations are not schedule-fire counts.',
      'Worker success does not prove upstream collection success.',
      'Reference comparison does not establish the current plan, invoice or future usage.']
  };
}
