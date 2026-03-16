import { prisma } from '../lib/prisma';
import { AssetClass } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AllocationItem {
  assetClass:     AssetClass;
  invested:       number;
  currentValue:   number;
  pnlAbsolute:    number;
  pnlPercent:     number;
  weight:         number; // % of total current value
  holdingsCount:  number;
}

export interface PortfolioSummary {
  portfolioId:    string;
  totalInvested:  number;
  currentValue:   number;
  pnlAbsolute:    number;
  pnlPercent:     number;
  allocation:     AllocationItem[];
  lastUpdated:    string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === 'object' && 'toNumber' in d && typeof (d as { toNumber: unknown }).toNumber === 'function') {
    return (d as { toNumber(): number }).toNumber();
  }
  return Number(d) || 0;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Return the portfolio summary for the primary portfolio of a user.
 * Allocation is grouped by asset class.
 */
export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const portfolio = await prisma.portfolio.findFirst({
    where:   { userId, familyMemberId: null },
    include: {
      holdings: {
        where: { isActive: true },
        select: {
          assetClass:   true,
          totalInvested: true,
          currentValue:  true,
          pnlAbsolute:   true,
        },
      },
    },
  });

  if (!portfolio) {
    throw Object.assign(new Error('Portfolio not found'), { statusCode: 404 });
  }

  const holdings = portfolio.holdings;

  // Aggregate totals
  let totalInvested = 0;
  let totalCurrent  = 0;

  for (const h of holdings) {
    totalInvested += toNum(h.totalInvested);
    totalCurrent  += toNum(h.currentValue);
  }

  // Group by asset class
  const byClass = new Map<AssetClass, { invested: number; current: number; count: number }>();

  for (const h of holdings) {
    const cls = h.assetClass;
    const inv = toNum(h.totalInvested);
    const cur = toNum(h.currentValue);

    const entry = byClass.get(cls) ?? { invested: 0, current: 0, count: 0 };
    entry.invested += inv;
    entry.current  += cur;
    entry.count    += 1;
    byClass.set(cls, entry);
  }

  const allocation: AllocationItem[] = Array.from(byClass.entries()).map(
    ([assetClass, data]) => ({
      assetClass,
      invested:      data.invested,
      currentValue:  data.current,
      pnlAbsolute:   data.current - data.invested,
      pnlPercent:    data.invested !== 0
                       ? ((data.current - data.invested) / data.invested) * 100
                       : 0,
      weight:        totalCurrent !== 0 ? (data.current / totalCurrent) * 100 : 0,
      holdingsCount: data.count,
    })
  );

  // Sort by current value descending
  allocation.sort((a, b) => b.currentValue - a.currentValue);

  const pnlAbsolute = totalCurrent - totalInvested;
  const pnlPercent  = totalInvested !== 0 ? (pnlAbsolute / totalInvested) * 100 : 0;

  return {
    portfolioId:   portfolio.id,
    totalInvested,
    currentValue:  totalCurrent,
    pnlAbsolute,
    pnlPercent,
    allocation,
    lastUpdated:   portfolio.updatedAt.toISOString(),
  };
}

/**
 * Recalculate and persist totalInvested + currentValue on the portfolio.
 * Called after every holding mutation.
 */
export async function recalculatePortfolio(portfolioId: string): Promise<void> {
  const result = await prisma.holding.aggregate({
    where: { portfolioId, isActive: true },
    _sum:  { totalInvested: true, currentValue: true },
  });

  await prisma.portfolio.update({
    where: { id: portfolioId },
    data:  {
      totalInvested: result._sum.totalInvested ?? 0,
      currentValue:  result._sum.currentValue  ?? 0,
    },
  });
}
