import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { apiLimiter } from '../middleware/rateLimit.middleware';
import * as MarketController from '../controllers/market.controller';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const priceQuerySchema = z.object({
  assetClass: z
    .enum(['STOCK', 'MUTUAL_FUND', 'CRYPTO', 'GOLD', 'SGB'])
    .optional()
    .default('STOCK'),
});

const searchQuerySchema = z.object({
  q:          z.string().min(2, 'Query must be at least 2 characters'),
  assetClass: z.enum(['STOCK', 'MUTUAL_FUND', 'CRYPTO']).optional().default('STOCK'),
});

const historyQuerySchema = z.object({
  assetClass: z
    .enum(['STOCK', 'MUTUAL_FUND', 'CRYPTO', 'GOLD', 'SGB'])
    .optional()
    .default('STOCK'),
  period: z
    .enum(['1M', '3M', '6M', '1Y', 'MAX'])
    .optional()
    .default('1Y'),
});

const netWorthQuerySchema = z.object({
  period: z.enum(['1M', '3M', '1Y', 'ALL']).optional().default('1Y'),
});

// ─── Public routes ────────────────────────────────────────────────────────────

// Market index data — no auth required, cached aggressively
router.get('/indices', MarketController.getIndices);

// Live price for a single symbol
// GET /api/market/price/RELIANCE?assetClass=STOCK
// GET /api/market/price/119551?assetClass=MUTUAL_FUND
// GET /api/market/price/BTC?assetClass=CRYPTO
router.get(
  '/price/:symbol',
  apiLimiter,
  validate({ query: priceQuerySchema }),
  MarketController.getSymbolPrice
);

// Symbol autocomplete search
// GET /api/market/search?q=REL&assetClass=STOCK
router.get(
  '/search',
  apiLimiter,
  validate({ query: searchQuerySchema }),
  MarketController.searchMarket
);

// Historical OHLC / NAV data
// GET /api/market/history/INFY?assetClass=STOCK&period=1Y
router.get(
  '/history/:symbol',
  apiLimiter,
  validate({ query: historyQuerySchema }),
  MarketController.getHistory
);

// ─── Protected routes ─────────────────────────────────────────────────────────

// User-specific net worth chart
// GET /api/market/net-worth-history?period=1Y
router.get(
  '/net-worth-history',
  authenticate,
  validate({ query: netWorthQuerySchema }),
  MarketController.getNetWorthHistory
);

export default router;
