/**
 * TODOROKI Equity Lab — US 10-year Treasury constant-maturity yield (DGS10).
 * Source: Federal Reserve Bank of St. Louis FRED, series DGS10.
 * The latest published observation is not necessarily today's observation.
 * This module does not modify existing valuation formulas or site routing.
 */
export const TREASURY_10Y_SERIES = 'DGS10';
export const TREASURY_10Y_SOURCE = 'https://fred.stlouisfed.org/series/DGS10';
export const TREASURY_10Y_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10';

export function parseTreasury10YYield(csv) {
  if (typeof csv !== 'string') return null;
  const rows = csv.trim().split(/\r?\n/);
  for (let i = rows.length - 1; i >= 1; i--) {
    const [date, raw] = rows[i].split(',');
    const annualPercent = Number(raw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !raw || raw.trim() === '.' ||
        !Number.isFinite(annualPercent) || annualPercent <= 0) continue;
    return { annualPercent, annualDecimal: annualPercent / 100, observationDate: date,
      source: TREASURY_10Y_SOURCE, series: TREASURY_10Y_SERIES };
  }
  return null;
}

export async function fetchTreasury10YYield(fetchImpl = fetch) {
  const response = await fetchImpl(TREASURY_10Y_CSV);
  if (!response.ok) throw new Error('Unable to retrieve DGS10 from FRED');
  const observation = parseTreasury10YYield(await response.text());
  if (!observation) throw new Error('No valid DGS10 observation available');
  return observation;
}

export function ownerEarningsCapitalizedByTreasuryYield(ownerEarnings, annualDecimal) {
  if (!Number.isFinite(ownerEarnings) || !Number.isFinite(annualDecimal) ||
      annualDecimal <= 0) return null;
  return ownerEarnings / annualDecimal;
}
