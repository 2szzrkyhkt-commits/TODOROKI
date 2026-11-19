/** TODOROKI: 10 annual EPS observations, oldest to newest. */
export function evaluateEpsGrowth(eps) {
  if (!Array.isArray(eps) || eps.length !== 10 || eps.some(v => typeof v !== 'number' || !Number.isFinite(v))) {
    return { eligible: false, reason: '10年分の通期EPSが必要', pastAverage: null, recentAverage: null, growthPercent: null, passes33Percent: null };
  }
  const lossYears = eps.reduce((a, v, i) => v < 0 ? [...a, i] : a, []);
  if (lossYears.length > 2) return { eligible: false, reason: '赤字が3回以上', lossYears: lossYears.length, pastAverage: null, recentAverage: null, growthPercent: null, passes33Percent: null };
  if (lossYears.some((v, i) => i > 0 && v === lossYears[i - 1] + 1)) return { eligible: false, reason: '2年連続赤字', lossYears: lossYears.length, pastAverage: null, recentAverage: null, growthPercent: null, passes33Percent: null };
  const profitable = eps.map((value, index) => ({ value, index })).filter(x => x.value > 0);
  if (profitable.length < 6) return { eligible: false, reason: '黒字年度不足', lossYears: lossYears.length, pastAverage: null, recentAverage: null, growthPercent: null, passes33Percent: null };
  const first = profitable.slice(0, 3);
  const last = profitable.slice(-3);
  const average = rows => rows.reduce((sum, x) => sum + x.value, 0) / rows.length;
  const pastAverage = average(first);
  const recentAverage = average(last);
  const growthPercent = (recentAverage / pastAverage - 1) * 100;
  return { eligible: true, reason: null, lossYears: lossYears.length, pastAverage, recentAverage, growthPercent, passes33Percent: growthPercent >= 33, pastYearIndices: first.map(x => x.index), recentYearIndices: last.map(x => x.index) };
}
