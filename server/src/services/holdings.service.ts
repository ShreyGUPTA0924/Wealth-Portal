import { prisma }                              from '../lib/prisma';
import { AssetClass, BrokerSource, TransactionType } from '@prisma/client';
import { getPrice }                            from './market.service';
import { xirr, calculatePnl, newAvgBuyPrice } from '../lib/calculations';
import { recalculatePortfolio }                from './portfolio.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_SCORES: Record<AssetClass, number> = {
  STOCK:        7,
  MUTUAL_FUND:  5,
  CRYPTO:       9,
  GOLD:         3,
  SGB:          3,
  FD:           2,
  RD:           2,
  PPF:          2,
  EPF:          2,
  NPS:          2,
  REAL_ESTATE:  4,
};

/** Asset classes that have live market prices we can fetch */
const PRICEABLE: AssetClass[] = ['STOCK', 'MUTUAL_FUND', 'CRYPTO', 'GOLD', 'SGB'];

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface AddHoldingDto {
  assetClass:   AssetClass;
  symbol?:      string;
  name:         string;
  quantity:     number;
  buyPrice:     number;
  buyDate:      string; // ISO date string
  maturityDate?: string;
  interestRate?: number;
  notes?:       string;
  portfolioId?: string; // When provided, use this portfolio instead of user's main one
}

export interface UpdateHoldingDto {
  quantity?:     number;
  manualPrice?:  number;
  notes?:        string;
}

export interface AddTransactionDto {
  type:         TransactionType;
  quantity:     number;
  pricePerUnit: number;
  date:         string; // ISO date string
  brokerage?:   number;
  notes?:       string;
}

export interface CsvHoldingRow {
  assetClass:   string;
  symbol?:      string;
  name:         string;
  quantity:     string;
  buyPrice:     string;
  buyDate:      string;
  notes?:       string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(d: unknown): number {
  if (d == null) return 0;
  // Prisma Decimal objects have a toNumber() method
  if (typeof d === 'object' && 'toNumber' in d && typeof (d as { toNumber: unknown }).toNumber === 'function') {
    return (d as { toNumber(): number }).toNumber();
  }
  return Number(d) || 0;
}

function appError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

/** Derive P&L from stored value or compute from currentValue - totalInvested */
function derivePnl(
  stored:        unknown,
  currentValue:  unknown,
  totalInvested: unknown
): number | null {
  const s  = toNum(stored);
  if (s !== 0) return s;                               // trust stored non-zero value
  const cv = toNum(currentValue);
  const ti = toNum(totalInvested);
  if (cv > 0 && ti > 0) return cv - ti;               // compute on-the-fly
  return null;
}

function derivePnlPct(
  stored:        unknown,
  currentValue:  unknown,
  totalInvested: unknown
): number | null {
  const s  = toNum(stored);
  if (s !== 0) return s;
  const cv = toNum(currentValue);
  const ti = toNum(totalInvested);
  if (cv > 0 && ti > 0) return ((cv - ti) / ti) * 100;
  return null;
}

/** Fetch a live price for the holding; returns null for non-priceable assets. */
async function fetchLivePrice(
  assetClass: AssetClass,
  symbol:     string | null | undefined
): Promise<number | null> {
  if (!PRICEABLE.includes(assetClass)) return null;
  if (assetClass !== 'GOLD' && !symbol) return null;

  try {
    const result = await getPrice(
      assetClass === 'GOLD' ? 'GOLD' : symbol!,
      assetClass as Parameters<typeof getPrice>[1]
    );
    return result.price;
  } catch {
    return null;
  }
}

/**
 * Compute XIRR for a holding given its transactions + current value.
 * Buys are negative cash flows, sells/current value are positive.
 * Exported for use by price sync job.
 */
export async function computeXirr(holdingId: string, currentValue: number): Promise<number | null> {
  const txns = await prisma.transaction.findMany({
    where:   { holdingId },
    orderBy: { transactionDate: 'asc' },
  });

  if (txns.length === 0) return null;

  const cashflows: number[] = [];
  const dates:     Date[]   = [];

  for (const t of txns) {
    const amount = toNum(t.totalAmount);
    if (t.type === 'BUY' || t.type === 'SIP') {
      cashflows.push(-amount);
    } else if (t.type === 'SELL' || t.type === 'DIVIDEND') {
      cashflows.push(amount);
    }
    // BONUS/SPLIT don't affect cash flow
    if (t.type !== 'BONUS' && t.type !== 'SPLIT') {
      dates.push(new Date(t.transactionDate));
    }
  }

  if (cashflows.length === 0) return null;

  // Add current value as the terminal positive cash flow at today
  cashflows.push(currentValue);
  dates.push(new Date());

  const rate = xirr(cashflows, dates);
  return isNaN(rate) ? null : Math.round(rate * 100) / 100;
}

// ─── Service Functions ────────────────────────────────────────────────────────

export async function getHoldings(
  userId:     string,
  assetClass?: AssetClass,
  sortBy?:     string
) {
  const orderBy = (() => {
    switch (sortBy) {
      case 'pnl':   return { pnlAbsolute: 'desc' as const };
      case 'value': return { currentValue: 'desc' as const };
      case 'risk':  return { riskScore: 'desc' as const };
      default:      return { createdAt: 'desc' as const };
    }
  })();

  const holdings = await prisma.holding.findMany({
    where: {
      userId,
      isActive: true,
      ...(assetClass ? { assetClass } : {}),
    },
    orderBy,
    include: {
      _count: { select: { transactions: true } },
    },
  });

  const portfolio = await prisma.portfolio.findFirst({
    where: { userId, familyMemberId: null },
  });

  const totalCurrentValue = toNum(portfolio?.currentValue);

  return holdings.map((h) => ({
    id:            h.id,
    assetClass:    h.assetClass,
    symbol:        h.symbol,
    name:          h.name,
    quantity:      toNum(h.quantity),
    avgBuyPrice:   toNum(h.avgBuyPrice),
    totalInvested: toNum(h.totalInvested),
    currentPrice:  h.currentPrice ? toNum(h.currentPrice) : null,
    currentValue:  h.currentValue ? toNum(h.currentValue) : null,
    pnlAbsolute:   derivePnl(h.pnlAbsolute, h.currentValue, h.totalInvested),
    pnlPercent:    derivePnlPct(h.pnlPercent, h.currentValue, h.totalInvested),
    xirr:          h.xirr ? toNum(h.xirr) : null,
    riskScore:     h.riskScore,
    brokerSource:  h.brokerSource,
    maturityDate:  h.maturityDate?.toISOString() ?? null,
    interestRate:  h.interestRate ? toNum(h.interestRate) : null,
    notes:         h.notes,
    firstBuyDate:  h.firstBuyDate?.toISOString() ?? null,
    createdAt:     h.createdAt.toISOString(),
    transactionCount: h._count.transactions,
    weight: totalCurrentValue > 0 && h.currentValue
      ? (toNum(h.currentValue) / totalCurrentValue) * 100
      : 0,
  }));
}

export async function getHoldingById(userId: string, holdingId: string) {
  const holding = await prisma.holding.findFirst({
    where: { id: holdingId, userId, isActive: true },
    include: {
      transactions: {
        orderBy: { transactionDate: 'desc' },
        take:    20,
      },
      goalHoldings: {
        include: {
          goal: {
            select: { id: true, name: true, category: true, targetAmount: true, currentAmount: true },
          },
        },
      },
    },
  });

  if (!holding) throw appError('Holding not found', 404);

  const portfolio = await prisma.portfolio.findFirst({
    where: { userId, familyMemberId: null },
  });
  const totalCurrentValue = toNum(portfolio?.currentValue);

  return {
    id:            holding.id,
    assetClass:    holding.assetClass,
    symbol:        holding.symbol,
    name:          holding.name,
    quantity:      toNum(holding.quantity),
    avgBuyPrice:   toNum(holding.avgBuyPrice),
    totalInvested: toNum(holding.totalInvested),
    currentPrice:  holding.currentPrice ? toNum(holding.currentPrice) : null,
    currentValue:  holding.currentValue ? toNum(holding.currentValue) : null,
    pnlAbsolute:   derivePnl(holding.pnlAbsolute, holding.currentValue, holding.totalInvested),
    pnlPercent:    derivePnlPct(holding.pnlPercent, holding.currentValue, holding.totalInvested),
    xirr:          holding.xirr ? toNum(holding.xirr) : null,
    riskScore:     holding.riskScore,
    brokerSource:  holding.brokerSource,
    maturityDate:  holding.maturityDate?.toISOString() ?? null,
    interestRate:  holding.interestRate ? toNum(holding.interestRate) : null,
    notes:         holding.notes,
    firstBuyDate:  holding.firstBuyDate?.toISOString() ?? null,
    createdAt:     holding.createdAt.toISOString(),
    weight: totalCurrentValue > 0 && holding.currentValue
      ? (toNum(holding.currentValue) / totalCurrentValue) * 100
      : 0,
    transactions: holding.transactions.map((t) => ({
      id:              t.id,
      type:            t.type,
      quantity:        toNum(t.quantity),
      pricePerUnit:    toNum(t.pricePerUnit),
      totalAmount:     toNum(t.totalAmount),
      brokerage:       t.brokerage ? toNum(t.brokerage) : null,
      transactionDate: t.transactionDate.toISOString(),
      notes:           t.notes,
    })),
    linkedGoals: holding.goalHoldings.map((gh) => ({
      goalId:            gh.goal.id,
      name:              gh.goal.name,
      category:          gh.goal.category,
      targetAmount:      toNum(gh.goal.targetAmount),
      currentAmount:     toNum(gh.goal.currentAmount),
      allocationPercent: toNum(gh.allocationPercent),
    })),
  };
}

export async function addHolding(userId: string, dto: AddHoldingDto) {
  const portfolio = dto.portfolioId
    ? await prisma.portfolio.findFirst({ where: { id: dto.portfolioId, userId } })
    : await prisma.portfolio.findFirst({ where: { userId, familyMemberId: null } });
  if (!portfolio) throw appError('Portfolio not found', 404);

  const riskScore    = RISK_SCORES[dto.assetClass] ?? 5;
  const livePrice    = await fetchLivePrice(dto.assetClass, dto.symbol);
  const currentPrice = livePrice ?? dto.buyPrice;
  const currentValue = currentPrice * dto.quantity;
  const { pnlAbsolute, pnlPercent } = calculatePnl(dto.buyPrice * dto.quantity, currentValue);

  const holding = await prisma.$transaction(async (tx) => {
    const h = await tx.holding.create({
      data: {
        portfolioId:   portfolio.id,
        userId,
        assetClass:    dto.assetClass,
        symbol:        dto.symbol ?? null,
        name:          dto.name,
        quantity:      dto.quantity,
        avgBuyPrice:   dto.buyPrice,
        totalInvested: dto.quantity * dto.buyPrice,
        currentPrice,
        currentValue,
        pnlAbsolute,
        pnlPercent,
        riskScore,
        notes:         dto.notes ?? null,
        maturityDate:  dto.maturityDate ? new Date(dto.maturityDate) : null,
        interestRate:  dto.interestRate ?? null,
        firstBuyDate:  new Date(dto.buyDate),
      },
    });

    await tx.transaction.create({
      data: {
        holdingId:       h.id,
        userId,
        type:            'BUY',
        quantity:        dto.quantity,
        pricePerUnit:    dto.buyPrice,
        totalAmount:     dto.quantity * dto.buyPrice,
        transactionDate: new Date(dto.buyDate),
        notes:           'Initial purchase',
      },
    });

    return h;
  }, { timeout: 15_000 });

  // Recompute portfolio totals outside the main transaction
  await recalculatePortfolio(portfolio.id);

  // Compute XIRR with the newly created transaction
  const xirrVal = await computeXirr(holding.id, currentValue);
  if (xirrVal !== null) {
    await prisma.holding.update({ where: { id: holding.id }, data: { xirr: xirrVal } });
  }

  return getHoldingById(userId, holding.id);
}

export async function updateHolding(
  userId:    string,
  holdingId: string,
  dto:       UpdateHoldingDto
) {
  const holding = await prisma.holding.findFirst({
    where: { id: holdingId, userId, isActive: true },
  });
  if (!holding) throw appError('Holding not found', 404);

  const currentPrice = dto.manualPrice ?? toNum(holding.currentPrice) ?? toNum(holding.avgBuyPrice);
  const qty          = dto.quantity    ?? toNum(holding.quantity);
  const invested     = qty * toNum(holding.avgBuyPrice);
  const currentValue = qty * currentPrice;
  const { pnlAbsolute, pnlPercent } = calculatePnl(invested, currentValue);

  const updated = await prisma.holding.update({
    where: { id: holdingId },
    data:  {
      ...(dto.quantity    !== undefined ? { quantity: dto.quantity, totalInvested: invested }    : {}),
      ...(dto.manualPrice !== undefined ? { currentPrice, currentValue, pnlAbsolute, pnlPercent } : {}),
      ...(dto.notes       !== undefined ? { notes: dto.notes } : {}),
    },
  });

  await recalculatePortfolio(updated.portfolioId);

  return getHoldingById(userId, holdingId);
}

export async function deleteHolding(userId: string, holdingId: string): Promise<void> {
  const holding = await prisma.holding.findFirst({
    where: { id: holdingId, userId, isActive: true },
  });
  if (!holding) throw appError('Holding not found', 404);

  await prisma.holding.update({
    where: { id: holdingId },
    data:  { isActive: false },
  });

  await recalculatePortfolio(holding.portfolioId);
}

export async function addTransaction(
  userId:    string,
  holdingId: string,
  dto:       AddTransactionDto
) {
  const holding = await prisma.holding.findFirst({
    where: { id: holdingId, userId, isActive: true },
  });
  if (!holding) throw appError('Holding not found', 404);

  const totalAmount   = dto.quantity * dto.pricePerUnit;
  const currentQty    = toNum(holding.quantity);
  const currentAvg    = toNum(holding.avgBuyPrice);
  const currentPrice  = toNum(holding.currentPrice) || dto.pricePerUnit;

  let newQty        = currentQty;
  let newAvg        = currentAvg;
  let totalInvested = toNum(holding.totalInvested);

  if (dto.type === 'BUY' || dto.type === 'SIP') {
    newAvg  = newAvgBuyPrice(currentQty, currentAvg, dto.quantity, dto.pricePerUnit);
    newQty  = currentQty + dto.quantity;
    totalInvested += totalAmount;
  } else if (dto.type === 'SELL') {
    if (dto.quantity > currentQty) {
      throw appError('Cannot sell more than available quantity', 400);
    }
    newQty = currentQty - dto.quantity;
    totalInvested = newQty * currentAvg;
  }

  const newCurrentValue = newQty * currentPrice;
  const { pnlAbsolute, pnlPercent } = calculatePnl(totalInvested, newCurrentValue);

  await prisma.$transaction(async (tx) => {
    await tx.transaction.create({
      data: {
        holdingId,
        userId,
        type:            dto.type,
        quantity:        dto.quantity,
        pricePerUnit:    dto.pricePerUnit,
        totalAmount,
        brokerage:       dto.brokerage ?? null,
        transactionDate: new Date(dto.date),
        notes:           dto.notes ?? null,
      },
    });

    await tx.holding.update({
      where: { id: holdingId },
      data:  {
        quantity:      newQty,
        avgBuyPrice:   newAvg,
        totalInvested,
        currentValue:  newCurrentValue,
        pnlAbsolute,
        pnlPercent,
      },
    });
  }, { timeout: 15_000 });

  await recalculatePortfolio(holding.portfolioId);

  const xirrVal = await computeXirr(holdingId, newCurrentValue);
  if (xirrVal !== null) {
    await prisma.holding.update({ where: { id: holdingId }, data: { xirr: xirrVal } });
  }

  return getHoldingById(userId, holdingId);
}

export async function importCsvHoldings(
  userId: string,
  rows:   CsvHoldingRow[]
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const portfolio = await prisma.portfolio.findFirst({
    where: { userId, familyMemberId: null },
  });
  if (!portfolio) throw appError('Portfolio not found', 404);

  let imported = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;

    try {
      const assetClass = row.assetClass.toUpperCase() as AssetClass;
      if (!Object.keys(RISK_SCORES).includes(assetClass)) {
        errors.push(`Row ${i + 2}: invalid assetClass "${row.assetClass}"`);
        skipped++;
        continue;
      }

      const qty      = parseFloat(row.quantity);
      const buyPrice = parseFloat(row.buyPrice);

      if (isNaN(qty) || isNaN(buyPrice)) {
        errors.push(`Row ${i + 2}: invalid quantity or buyPrice`);
        skipped++;
        continue;
      }

      // Duplicate check — same user + name + assetClass + approx buy date
      const existing = await prisma.holding.findFirst({
        where: { userId, name: row.name, assetClass, isActive: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const livePrice    = await fetchLivePrice(assetClass, row.symbol);
      const currentPrice = livePrice ?? buyPrice;
      const currentValue = currentPrice * qty;
      const { pnlAbsolute, pnlPercent } = calculatePnl(buyPrice * qty, currentValue);

      await prisma.$transaction(async (tx) => {
        const h = await tx.holding.create({
          data: {
            portfolioId:   portfolio.id,
            userId,
            assetClass,
            symbol:        row.symbol ?? null,
            name:          row.name,
            quantity:      qty,
            avgBuyPrice:   buyPrice,
            totalInvested: qty * buyPrice,
            currentPrice,
            currentValue,
            pnlAbsolute,
            pnlPercent,
            riskScore:     RISK_SCORES[assetClass],
            notes:         row.notes ?? null,
            firstBuyDate:  new Date(row.buyDate),
            brokerSource:  BrokerSource.CSV_IMPORT,
          },
        });

        await tx.transaction.create({
          data: {
            holdingId:       h.id,
            userId,
            type:            'BUY',
            quantity:        qty,
            pricePerUnit:    buyPrice,
            totalAmount:     qty * buyPrice,
            transactionDate: new Date(row.buyDate),
            notes:           'CSV import',
          },
        });
      }, { timeout: 15_000 });

      imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Row ${i + 2}: ${msg}`);
      skipped++;
    }
  }

  if (imported > 0) {
    await recalculatePortfolio(portfolio.id);
  }

  return { imported, skipped, errors };
}
