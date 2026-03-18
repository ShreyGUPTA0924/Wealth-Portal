// ─── XIRR via Newton-Raphson ─────────────────────────────────────────────────

const MAX_ITERATIONS = 200;
const TOLERANCE      = 1e-8;
const YEAR_MS        = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Calculate XIRR (Extended Internal Rate of Return) for irregular cash flows.
 *
 * @param cashflows  Array of cash-flow amounts. Investments are negative,
 *                   redemptions/current value are positive.
 * @param dates      Matching array of Date objects for each cash flow.
 * @returns          Annual rate as a percentage (e.g. 12.5 means 12.5 % p.a.)
 *                   Returns NaN if the calculation did not converge.
 */
export function xirr(cashflows: number[], dates: Date[]): number {
  if (cashflows.length !== dates.length || cashflows.length < 2) return NaN;

  // Year-fractions relative to the first date
  const t0    = dates[0]!.getTime();
  const years = dates.map((d) => (d.getTime() - t0) / YEAR_MS);

  // NPV and its derivative at a given rate
  const npv = (r: number): number =>
    cashflows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + r, years[i]!), 0);

  const dnpv = (r: number): number =>
    cashflows.reduce(
      (sum, cf, i) => sum - (years[i]! * cf) / Math.pow(1 + r, years[i]! + 1),
      0
    );

  // Try multiple starting guesses in case of non-convergence
  for (const guess of [0.1, 0.0, -0.1, 0.5, -0.5]) {
    let rate = guess;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const f  = npv(rate);
      const df = dnpv(rate);

      if (Math.abs(df) < 1e-12) break; // avoid division by zero

      const next = rate - f / df;

      if (Math.abs(next - rate) < TOLERANCE && Math.abs(npv(next)) < TOLERANCE) {
        return next * 100; // convert to percentage
      }

      rate = next;

      // Guard against divergence
      if (!isFinite(rate) || rate < -0.9999) break;
    }
  }

  return NaN;
}

// ─── Portfolio P&L helpers ────────────────────────────────────────────────────

export interface PnlResult {
  pnlAbsolute: number;
  pnlPercent:  number;
}

export function calculatePnl(invested: number, currentValue: number): PnlResult {
  const pnlAbsolute = currentValue - invested;
  const pnlPercent  = invested !== 0 ? (pnlAbsolute / invested) * 100 : 0;
  return { pnlAbsolute, pnlPercent };
}

/**
 * Recalculate weighted-average buy price after a BUY transaction.
 */
export function newAvgBuyPrice(
  existingQty: number,
  existingAvg: number,
  addedQty:    number,
  addedPrice:  number
): number {
  const total = existingQty + addedQty;
  if (total === 0) return 0;
  return (existingQty * existingAvg + addedQty * addedPrice) / total;
}

/**
 * Compute current value for fixed-income assets (PPF, FD, RD, EPF) using compound interest.
 * Formula: A = P * (1 + r/100)^t
 */
export function compoundInterestValue(
  principal: number,
  ratePerAnnum: number,
  years: number
): number {
  if (principal <= 0) return 0;
  if (years <= 0) return principal;
  return principal * Math.pow(1 + ratePerAnnum / 100, years);
}

// ─── INR formatting helper (server-side) ─────────────────────────────────────

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency:              'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
