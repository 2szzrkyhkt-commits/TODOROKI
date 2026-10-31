/**
 * TODOROKI Equity Lab — market capitalization derivation helper.
 * Pure module; does not alter the website, auth gateway or existing records.
 * Monetary inputs must use the same unit (e.g. JPY millions).
 * Share price is JPY/share; sharesOutstanding is number of shares.
 */
export function deriveMarketCap(input = {}) {
  const positive = value => {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : Number(String(value).replaceAll(',', ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const price = positive(input.sharePriceJPY);
  const shares = positive(input.sharesOutstanding);
  const per = positive(input.per);
  const earnings = positive(input.netIncome);
  const pbr = positive(input.pbr);
  const equity = positive(input.shareholdersEquity);
  const unit = input.monetaryUnit === 'JPY' ? 1 : input.monetaryUnit === 'JPY_million' ? 1e6 : null;
  if (price !== null && shares !== null) {
    return { valueJPY: price * shares, method: 'share_price_x_shares', estimated: false };
  }
  if (unit === null) return null;
  if (per !== null && earnings !== null) {
    return { valueJPY: per * earnings * unit, method: 'per_x_net_income', estimated: true };
  }
  if (pbr !== null && equity !== null) {
    return { valueJPY: pbr * equity * unit, method: 'pbr_x_shareholders_equity', estimated: true };
  }
  return null;
}
