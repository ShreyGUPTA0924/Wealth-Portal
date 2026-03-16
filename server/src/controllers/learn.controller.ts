import { Request, Response } from 'express';

// ─── Daily Tips ────────────────────────────────────────────────────────────────

const TIPS: { tip: string; category: string }[] = [
  { tip: "Start a SIP of even ₹500/month. In 20 years at 12% returns, it becomes ₹49,000+.", category: "SIP" },
  { tip: "Direct mutual funds save 0.5–1% expense ratio vs regular plans. Switch today.", category: "Mutual Funds" },
  { tip: "ELSS funds give 80C tax benefit up to ₹1.5L and have only 3-year lock-in.", category: "Tax" },
  { tip: "Emergency fund = 6 months expenses. Keep it in liquid fund, not savings account.", category: "Emergency" },
  { tip: "LTCG on equity > ₹1L is taxed at 10%. Hold for 1+ year to qualify.", category: "Tax" },
  { tip: "Step up your SIP by 10% every year. It can double your final corpus.", category: "SIP" },
  { tip: "Index funds beat 70–80% of active funds over 10+ years. Low cost, high discipline.", category: "Mutual Funds" },
  { tip: "PPF gives guaranteed 7.1% returns + EEE tax benefit. Max ₹1.5L/year.", category: "Tax" },
  { tip: "Never keep more than ₹1L idle in savings account. Move excess to liquid funds.", category: "Mutual Funds" },
  { tip: "Rebalance your portfolio once a year to maintain your target asset allocation.", category: "Stocks" },
  { tip: "NPS gives additional ₹50,000 deduction under 80CCD(1B) over the ₹1.5L 80C limit.", category: "Retirement" },
  { tip: "Sovereign Gold Bonds earn 2.5% interest per year + gold price appreciation. Better than physical gold.", category: "Gold" },
  { tip: "A term insurance cover of 20× annual income protects your family adequately.", category: "Insurance" },
  { tip: "Debt funds held > 3 years qualify for indexation benefit, reducing your tax outgo.", category: "Tax" },
  { tip: "The 50-30-20 rule: 50% needs, 30% wants, 20% investments. Adjust for India's cost reality.", category: "Goals" },
  { tip: "Don't time the market — time IN the market matters. Stay invested through volatility.", category: "Stocks" },
  { tip: "FD interest is fully taxable. Compare post-tax returns before choosing over debt funds.", category: "FD" },
  { tip: "Diversify across equity, debt, gold, and real estate. Never put all eggs in one basket.", category: "Stocks" },
  { tip: "Exit load is charged if you redeem within 1 year in most equity funds. Plan your exit.", category: "Mutual Funds" },
  { tip: "Health insurance premium paid is deductible under 80D — up to ₹25,000 for self, ₹50,000 for parents.", category: "Insurance" },
  { tip: "STCG on equity sold within 1 year is taxed at 15%. Hold longer to save tax.", category: "Tax" },
  { tip: "Hybrid funds automatically rebalance equity-debt mix. Great for first-time investors.", category: "Mutual Funds" },
  { tip: "Your EPF is a debt instrument giving ~8.25% tax-free. Don't withdraw it prematurely.", category: "Retirement" },
  { tip: "Goal-based investing works better than returns-chasing. Link every investment to a purpose.", category: "Goals" },
  { tip: "SGB (Sovereign Gold Bond) has zero making charges and capital gains are tax-free at maturity.", category: "Gold" },
  { tip: "A 1% lower expense ratio on ₹50L corpus means ₹50,000 more in your pocket every year.", category: "Mutual Funds" },
  { tip: "Start retirement planning at 25. Waiting till 35 requires 3× the monthly investment.", category: "Retirement" },
  { tip: "Liquid funds outperform savings accounts and have T+1 redemption. Use them for short-term parking.", category: "FD" },
  { tip: "Parag Parikh Flexi Cap and Mirae Asset Large Cap are consistently top-rated direct funds.", category: "Mutual Funds" },
  { tip: "Avoid over-insurance through endowment/ULIP plans. Separate insurance and investment always wins.", category: "Insurance" },
];

// ─── Handler ───────────────────────────────────────────────────────────────────

export function getDailyTip(req: Request, res: Response): void {
  const now        = new Date();
  const start      = new Date(now.getFullYear(), 0, 0);
  const diff       = now.getTime() - start.getTime();
  const oneDay     = 1000 * 60 * 60 * 24;
  const dayOfYear  = Math.floor(diff / oneDay);

  const tip = TIPS[dayOfYear % TIPS.length]!;

  res.status(200).json({
    success: true,
    data: tip,
  });
}
