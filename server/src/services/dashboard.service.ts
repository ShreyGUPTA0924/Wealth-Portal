import { prisma } from '../lib/prisma';
import { AssetClass } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === 'object' && 'toNumber' in d && typeof (d as { toNumber: unknown }).toNumber === 'function') {
    return (d as { toNumber(): number }).toNumber();
  }
  return Number(d) || 0;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardData {
  netWorth: {
    current:     number;
    invested:    number;
    pnlAbsolute: number;
    pnlPercent:  number;
    change: {
      today:    number;
      oneWeek:  number;
      oneMonth: number;
      oneYear:  number;
    };
  };
  allocation: Array<{ assetClass: string; value: number; percent: number }>;
  topGainers: Array<{ id: string; name: string; symbol: string | null; pnlPercent: number; currentValue: number }>;
  topLosers:  Array<{ id: string; name: string; symbol: string | null; pnlPercent: number; currentValue: number }>;
  upcomingReminders: Array<{ type: string; name: string; date: string; amount: number | null }>;
  recentTransactions: Array<{ id: string; holdingName: string; type: string; amount: number; date: string }>;
  goalsSummary: Array<{
    id:              string;
    name:            string;
    targetAmount:    number;
    currentAmount:   number;
    progressPercent: number;
    healthStatus:    string;
  }>;
  checklist: {
    items: Array<{
      templateId:   string;
      label:        string;
      category:     string;
      amount:       number | null;
      dueDayOfMonth: number;
      isPaid:       boolean;
      paidAt:       string | null;
    }>;
    totalItems: number;
    paidItems:  number;
  };
  aiInsights: string[];
}

// ─── AI Insights (rule-based) ─────────────────────────────────────────────────

function generateInsights(
  holdings:    { name: string; pnlPercent: number | null; assetClass: AssetClass }[],
  totalValue:  number,
  reminders:   { name: string; daysUntil: number }[]
): string[] {
  const insights: string[] = [];

  // Rule 1: Strong performer
  const topPerformer = holdings
    .filter((h) => (h.pnlPercent ?? 0) > 20)
    .sort((a, b) => (b.pnlPercent ?? 0) - (a.pnlPercent ?? 0))[0];
  if (topPerformer) {
    insights.push(
      `${topPerformer.name} is up ${(topPerformer.pnlPercent ?? 0).toFixed(1)}% — strong performer`
    );
  }

  // Rule 2: Upcoming maturity
  const upcoming = reminders[0];
  if (upcoming) {
    insights.push(`${upcoming.name} matures in ${upcoming.daysUntil} days — plan your next move`);
  }

  // Rule 3: Equity concentration
  const equityClasses: AssetClass[] = ['STOCK', 'MUTUAL_FUND'];
  let equityValue = 0;
  for (const h of holdings) {
    if (equityClasses.includes(h.assetClass)) {
      equityValue += totalValue > 0 ? 1 : 0; // counting done via percent below
    }
  }
  // Recalculate properly
  const equityHoldings = holdings.filter((h) => equityClasses.includes(h.assetClass));
  const equityPct = totalValue > 0
    ? (equityHoldings.length / Math.max(holdings.length, 1)) * 100
    : 0;
  void equityValue; // suppress unused warning
  if (equityPct > 75) {
    insights.push('Your equity allocation is high — consider diversifying into debt or gold');
  }

  // Fallback insights
  const fallbacks = [
    'Review your portfolio monthly to stay on track with your financial goals',
    'Consider setting up SIPs to automate your investments',
    'Diversification across asset classes reduces overall portfolio risk',
  ];

  while (insights.length < 3) {
    insights.push(fallbacks[insights.length] ?? fallbacks[0]!);
  }

  return insights.slice(0, 3);
}

// ─── Net-worth change simulation ──────────────────────────────────────────────

function mockChangePercent(seed: number, multiplier: number): number {
  return Math.round((seed % 5) * multiplier * 10) / 10;
}

// ─── Main dashboard aggregation ──────────────────────────────────────────────

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const now = new Date();

  // Fetch all in parallel
  const [portfolio, goals, checklistTemplates, recentTxns] = await Promise.all([
    prisma.portfolio.findFirst({
      where:   { userId, familyMemberId: null },
      include: {
        holdings: {
          where:  { isActive: true },
          select: {
            id:            true,
            name:          true,
            symbol:        true,
            assetClass:    true,
            currentValue:  true,
            totalInvested: true,
            pnlAbsolute:   true,
            pnlPercent:    true,
            maturityDate:  true,
          },
        },
      },
    }),
    prisma.goal.findMany({
      where:   { userId },
      orderBy: { priority: 'asc' },
    }),
    prisma.checklistTemplate.findMany({
      where:   { userId, isActive: true },
      include: {
        entries: {
          where: {
            monthYear: {
              gte: new Date(now.getFullYear(), now.getMonth(), 1),
              lt:  new Date(now.getFullYear(), now.getMonth() + 1, 1),
            },
          },
          take: 1,
        },
      },
      orderBy: { dueDayOfMonth: 'asc' },
    }),
    prisma.transaction.findMany({
      where:   { userId },
      orderBy: { transactionDate: 'desc' },
      take:    5,
      include: { holding: { select: { name: true } } },
    }),
  ]);

  // ── Net worth ──────────────────────────────────────────────────────────────
  const holdings      = portfolio?.holdings ?? [];
  const totalInvested = holdings.reduce((s, h) => s + toNum(h.totalInvested), 0);
  const currentValue  = holdings.reduce((s, h) => s + toNum(h.currentValue),  0);
  const pnlAbsolute   = currentValue - totalInvested;
  const pnlPercent    = totalInvested > 0 ? (pnlAbsolute / totalInvested) * 100 : 0;

  // Mock intra-day & period changes derived from portfolio seed
  const seed = Math.floor(totalInvested / 1000) % 10;
  const change = {
    today:    mockChangePercent(seed + 1, 0.3),
    oneWeek:  mockChangePercent(seed + 2, 0.8),
    oneMonth: mockChangePercent(seed + 3, 2.0),
    oneYear:  mockChangePercent(seed + 4, 8.0),
  };

  // ── Allocation ────────────────────────────────────────────────────────────
  const byClass = new Map<string, number>();
  for (const h of holdings) {
    const cls = h.assetClass as string;
    byClass.set(cls, (byClass.get(cls) ?? 0) + toNum(h.currentValue));
  }
  const allocation = Array.from(byClass.entries()).map(([assetClass, value]) => ({
    assetClass,
    value,
    percent: currentValue > 0 ? (value / currentValue) * 100 : 0,
  })).sort((a, b) => b.value - a.value);

  // ── Top Gainers / Losers ──────────────────────────────────────────────────
  const withPnl = holdings.filter((h) => h.pnlPercent != null);
  const byPnl   = [...withPnl].sort((a, b) => toNum(b.pnlPercent) - toNum(a.pnlPercent));
  const mapHolding = (h: typeof holdings[number]) => ({
    id:           h.id,
    name:         h.name,
    symbol:       h.symbol,
    pnlPercent:   toNum(h.pnlPercent),
    currentValue: toNum(h.currentValue),
  });
  const topGainers = byPnl.slice(0, 3).map(mapHolding);
  const topLosers  = byPnl.reverse().slice(0, 3).map(mapHolding);

  // ── Upcoming reminders (FD/SGB maturing within 30 days) ──────────────────
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const maturingHoldings = holdings.filter(
    (h) => h.maturityDate && h.maturityDate >= now && h.maturityDate <= thirtyDaysLater
  );
  const upcomingReminders = maturingHoldings.map((h) => ({
    type:   h.assetClass as string,
    name:   h.name,
    date:   h.maturityDate!.toISOString(),
    amount: toNum(h.currentValue) || null,
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // ── Recent transactions ───────────────────────────────────────────────────
  const recentTransactions = recentTxns.map((t) => ({
    id:          t.id,
    holdingName: t.holding.name,
    type:        t.type,
    amount:      toNum(t.totalAmount),
    date:        t.transactionDate.toISOString(),
  }));

  // ── Goals summary ─────────────────────────────────────────────────────────
  const goalsSummary = goals.map((g) => {
    const target  = toNum(g.targetAmount);
    const current = toNum(g.currentAmount);
    const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    return {
      id:              g.id,
      name:            g.name,
      targetAmount:    target,
      currentAmount:   current,
      progressPercent: Math.round(progress * 10) / 10,
      healthStatus:    g.healthStatus,
    };
  });

  // ── Checklist ─────────────────────────────────────────────────────────────
  const checklistItems = checklistTemplates.map((t) => {
    const entry = t.entries[0];
    return {
      templateId:    t.id,
      label:         t.label,
      category:      t.category,
      amount:        t.amount ? toNum(t.amount) : null,
      dueDayOfMonth: t.dueDayOfMonth,
      isPaid:        entry?.isPaid ?? false,
      paidAt:        entry?.paidAt?.toISOString() ?? null,
    };
  });
  const paidItems = checklistItems.filter((i) => i.isPaid).length;

  // ── AI Insights ───────────────────────────────────────────────────────────
  const insightHoldings = holdings.map((h) => ({
    name:       h.name,
    pnlPercent: h.pnlPercent ? toNum(h.pnlPercent) : null,
    assetClass: h.assetClass,
  }));
  const reminderSeeds = maturingHoldings.map((h) => ({
    name:       h.name,
    daysUntil:  daysBetween(now, h.maturityDate!),
  }));
  const aiInsights = generateInsights(insightHoldings, currentValue, reminderSeeds);

  return {
    netWorth: { current: currentValue, invested: totalInvested, pnlAbsolute, pnlPercent, change },
    allocation,
    topGainers,
    topLosers,
    upcomingReminders,
    recentTransactions,
    goalsSummary,
    checklist: { items: checklistItems, totalItems: checklistItems.length, paidItems },
    aiInsights,
  };
}

// ─── Checklist ────────────────────────────────────────────────────────────────

export async function getChecklist(userId: string) {
  const now = new Date();
  const templates = await prisma.checklistTemplate.findMany({
    where:   { userId, isActive: true },
    include: {
      entries: {
        where: {
          monthYear: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lt:  new Date(now.getFullYear(), now.getMonth() + 1, 1),
          },
        },
        take: 1,
      },
    },
    orderBy: { dueDayOfMonth: 'asc' },
  });

  return templates.map((t) => {
    const entry = t.entries[0];
    return {
      templateId:    t.id,
      label:         t.label,
      category:      t.category,
      amount:        t.amount ? toNum(t.amount) : null,
      dueDayOfMonth: t.dueDayOfMonth,
      isPaid:        entry?.isPaid ?? false,
      paidAt:        entry?.paidAt?.toISOString() ?? null,
      entryId:       entry?.id ?? null,
    };
  });
}

export async function toggleChecklistItem(
  userId:     string,
  templateId: string,
  isPaid:     boolean,
  actualAmount?: number
) {
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, userId, isActive: true },
  });
  if (!template) {
    throw Object.assign(new Error('Checklist item not found'), { statusCode: 404 });
  }

  const now       = new Date();
  const monthYear = new Date(now.getFullYear(), now.getMonth(), 1);

  const entry = await prisma.checklistEntry.upsert({
    where:  { templateId_monthYear: { templateId, monthYear } },
    create: {
      templateId,
      userId,
      monthYear,
      isPaid,
      actualAmount: actualAmount ?? null,
      paidAt:       isPaid ? new Date() : null,
    },
    update: {
      isPaid,
      actualAmount: actualAmount ?? undefined,
      paidAt:       isPaid ? new Date() : null,
    },
  });

  return entry;
}

// ─── Net Worth History (mock) ─────────────────────────────────────────────────

export async function getNetWorthHistory(userId: string, period: string) {
  const portfolio = await prisma.portfolio.findFirst({
    where: { userId, familyMemberId: null },
  });
  const currentValue  = toNum(portfolio?.currentValue);
  const totalInvested = toNum(portfolio?.totalInvested);

  const periodMap: Record<string, { days: number; label: string }> = {
    '1M':  { days: 30,  label: '1M' },
    '3M':  { days: 90,  label: '3M' },
    '6M':  { days: 180, label: '6M' },
    '1Y':  { days: 365, label: '1Y' },
    'ALL': { days: 730, label: 'ALL' },
  };

  const cfg  = periodMap[period] ?? periodMap['1M']!;
  const days = cfg.days;
  const now  = new Date();

  // Generate smooth growth curve from invested → current
  const dataPoints: { date: string; value: number }[] = [];
  const startValue = totalInvested * 0.9;
  const endValue   = currentValue;
  const steps      = Math.min(days, 60);

  for (let i = 0; i <= steps; i++) {
    const t     = i / steps;
    const date  = new Date(now.getTime() - (days - t * days) * 24 * 60 * 60 * 1000);
    // S-curve growth with small noise
    const noise = 1 + ((((i * 7 + 3) % 11) - 5) / 100) * 0.5;
    const value = startValue + (endValue - startValue) * (t * t * (3 - 2 * t)) * noise;
    dataPoints.push({
      date:  date.toISOString().slice(0, 10),
      value: Math.round(value),
    });
  }

  return { period: cfg.label, dataPoints };
}
