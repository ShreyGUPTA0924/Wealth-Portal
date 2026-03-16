import { Request, Response } from 'express';
import {
  getPrice,
  searchSymbols,
  getPriceHistory,
  type AssetClass,
} from '../services/market.service';
import { prisma } from '../lib/prisma';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handleError(res: Response, err: unknown): void {
  const error = err as Error & { statusCode?: number };
  const status = error.statusCode ?? 500;
  const isProd = process.env['NODE_ENV'] === 'production';
  res.status(status).json({
    success: false,
    error: isProd && status === 500 ? 'Internal server error' : error.message,
  });
}

const VALID_ASSET_CLASSES: AssetClass[] = ['STOCK', 'MUTUAL_FUND', 'CRYPTO', 'GOLD', 'SGB'];
const VALID_PERIODS = ['1M', '3M', '6M', '1Y', 'MAX'];

// ─── GET /api/market/price/:symbol ───────────────────────────────────────────
// Query: ?assetClass=STOCK|MUTUAL_FUND|CRYPTO|GOLD

export async function getSymbolPrice(req: Request, res: Response): Promise<void> {
  try {
    const { symbol } = req.params as { symbol: string };
    const assetClass = (req.query['assetClass'] as string ?? 'STOCK').toUpperCase() as AssetClass;

    if (!VALID_ASSET_CLASSES.includes(assetClass)) {
      res.status(400).json({
        success: false,
        error: `Invalid assetClass. Must be one of: ${VALID_ASSET_CLASSES.join(', ')}`,
      });
      return;
    }

    const result = await getPrice(symbol, assetClass);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    handleError(res, err);
  }
}

// ─── GET /api/market/search ───────────────────────────────────────────────────
// Query: ?q=RELIANCE&assetClass=STOCK

export async function searchMarket(req: Request, res: Response): Promise<void> {
  try {
    const q = (req.query['q'] as string ?? '').trim();
    const assetClass = (req.query['assetClass'] as string ?? 'STOCK').toUpperCase();

    if (q.length < 2) {
      res.status(400).json({ success: false, error: 'Query must be at least 2 characters' });
      return;
    }

    const results = await searchSymbols(q, assetClass);
    res.status(200).json({ success: true, data: { results } });
  } catch (err) {
    handleError(res, err);
  }
}

// ─── GET /api/market/history/:symbol ─────────────────────────────────────────
// Query: ?period=1M|3M|6M|1Y|MAX&assetClass=STOCK

export async function getHistory(req: Request, res: Response): Promise<void> {
  try {
    const { symbol } = req.params as { symbol: string };
    const assetClass = (req.query['assetClass'] as string ?? 'STOCK').toUpperCase() as AssetClass;
    const period = (req.query['period'] as string ?? '1Y').toUpperCase();

    if (!VALID_PERIODS.includes(period)) {
      res.status(400).json({
        success: false,
        error: `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`,
      });
      return;
    }

    if (!VALID_ASSET_CLASSES.includes(assetClass)) {
      res.status(400).json({ success: false, error: 'Invalid assetClass' });
      return;
    }

    const data = await getPriceHistory(symbol, assetClass, period);
    res.status(200).json({ success: true, data: { symbol, period, points: data } });
  } catch (err) {
    handleError(res, err);
  }
}

// ─── GET /api/market/net-worth-history  [protected] ──────────────────────────
// Query: ?period=1M|3M|1Y|ALL
// Uses transaction history to reconstruct portfolio value over time

export async function getNetWorthHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const period = (req.query['period'] as string ?? '1Y').toUpperCase();

    // Determine the start date cutoff
    const cutoff = new Date();
    switch (period) {
      case '1M':  cutoff.setMonth(cutoff.getMonth() - 1);      break;
      case '3M':  cutoff.setMonth(cutoff.getMonth() - 3);      break;
      case '1Y':  cutoff.setFullYear(cutoff.getFullYear() - 1); break;
      case 'ALL': cutoff.setFullYear(2000);                     break;
      default:    cutoff.setFullYear(cutoff.getFullYear() - 1);
    }

    // Get all transactions for the user within the period
    const transactions = await prisma.transaction.findMany({
      where: { userId, transactionDate: { gte: cutoff } },
      orderBy: { transactionDate: 'asc' },
      select: {
        transactionDate: true,
        type:           true,
        totalAmount:    true,
      },
    });

    // Build cumulative invested value per day
    const dailyMap = new Map<string, number>();
    let runningInvested = 0;

    for (const tx of transactions) {
      const date = tx.transactionDate.toISOString().split('T')[0] as string;
      const amount = parseFloat(tx.totalAmount.toString());

      if (tx.type === 'BUY' || tx.type === 'SIP') {
        runningInvested += amount;
      } else if (tx.type === 'SELL') {
        runningInvested -= amount;
      }

      dailyMap.set(date, runningInvested);
    }

    // Also include portfolio's current value as the latest data point
    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
      select: { currentValue: true },
    });

    const totalCurrentValue = portfolios.reduce(
      (sum, p) => sum + parseFloat(p.currentValue.toString()),
      0
    );

    const today = new Date().toISOString().split('T')[0] as string;
    if (totalCurrentValue > 0) dailyMap.set(today, totalCurrentValue);

    // Convert map to sorted array
    const data = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, netWorth]) => ({ date, netWorth: Math.round(netWorth * 100) / 100 }));

    res.status(200).json({ success: true, data: { period, data } });
  } catch (err) {
    handleError(res, err);
  }
}

// ─── GET /api/market/indices ──────────────────────────────────────────────────
// Returns key Indian market indices (NIFTY 50, SENSEX, NIFTY BANK)

export async function getIndices(_req: Request, res: Response): Promise<void> {
  try {
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

    const indexList = [
      { ticker: '^NSEI',    name: 'NIFTY 50'   },
      { ticker: '^BSESN',   name: 'SENSEX'     },
      { ticker: '^NSEBANK', name: 'NIFTY Bank' },
    ];

    interface MinQuote {
      regularMarketPrice?: number | null;
      regularMarketChangePercent?: number | null;
      regularMarketChange?: number | null;
    }

    const settled = await Promise.allSettled(
      indexList.map(async (idx) => {
        const raw  = await yahooFinance.quote(idx.ticker);
        const q    = raw as unknown as MinQuote;
        return {
          symbol:           idx.name,
          price:            q.regularMarketPrice ?? 0,
          dayChangePercent: q.regularMarketChangePercent ?? 0,
          dayChangeAbs:     q.regularMarketChange ?? 0,
        };
      })
    );

    const data = settled
      .filter((r): r is PromiseFulfilledResult<{ symbol: string; price: number; dayChangePercent: number; dayChangeAbs: number }> =>
        r.status === 'fulfilled'
      )
      .map((r) => r.value);

    res.status(200).json({ success: true, data: { indices: data } });
  } catch (err) {
    handleError(res, err);
  }
}
