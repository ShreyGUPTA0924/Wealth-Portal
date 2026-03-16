import { Request, Response, NextFunction } from 'express';
import { AssetClass, TransactionType }     from '@prisma/client';
import { parse }                           from 'csv-parse/sync';

import * as holdingsService from '../services/holdings.service';
import * as portfolioService from '../services/portfolio.service';
import type { CsvHoldingRow } from '../services/holdings.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export const getPortfolioSummary = wrap(async (req, res) => {
  const summary = await portfolioService.getPortfolioSummary(req.user!.id);
  ok(res, summary);
});

// ─── Holdings CRUD ────────────────────────────────────────────────────────────

export const listHoldings = wrap(async (req, res) => {
  const assetClass = [req.query['assetClass']].flat()[0] as AssetClass | undefined;
  const sortBy     = [req.query['sortBy']].flat()[0]     as string     | undefined;
  const holdings   = await holdingsService.getHoldings(req.user!.id, assetClass, sortBy);
  ok(res, holdings);
});

export const getHolding = wrap(async (req, res) => {
  const id = [req.params['id']].flat()[0]!;
  const holding = await holdingsService.getHoldingById(req.user!.id, id);
  ok(res, holding);
});

export const createHolding = wrap(async (req, res) => {
  const dto = req.body as holdingsService.AddHoldingDto;
  const holding = await holdingsService.addHolding(req.user!.id, dto);
  ok(res, holding, 201);
});

export const updateHolding = wrap(async (req, res) => {
  const id  = [req.params['id']].flat()[0]!;
  const dto = req.body as holdingsService.UpdateHoldingDto;
  const holding = await holdingsService.updateHolding(req.user!.id, id, dto);
  ok(res, holding);
});

export const removeHolding = wrap(async (req, res) => {
  const id = [req.params['id']].flat()[0]!;
  await holdingsService.deleteHolding(req.user!.id, id);
  ok(res, { message: 'Holding deleted' });
});

// ─── Transactions ─────────────────────────────────────────────────────────────

export const createTransaction = wrap(async (req, res) => {
  const id  = [req.params['id']].flat()[0]!;
  const dto = req.body as holdingsService.AddTransactionDto;
  const holding = await holdingsService.addTransaction(req.user!.id, id, dto);
  ok(res, holding, 201);
});

// ─── CSV Import ───────────────────────────────────────────────────────────────

export const importCsv = wrap(async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, message: 'No CSV file uploaded' });
    return;
  }

  let rows: CsvHoldingRow[];
  try {
    rows = parse(file.buffer, {
      columns:          true,
      skip_empty_lines: true,
      trim:             true,
    }) as CsvHoldingRow[];
  } catch {
    res.status(400).json({ success: false, message: 'Invalid CSV format' });
    return;
  }

  const result = await holdingsService.importCsvHoldings(req.user!.id, rows);
  ok(res, result, 201);
});

// ─── Broker Sync (placeholder) ────────────────────────────────────────────────

export const syncBroker = wrap(async (_req, res) => {
  ok(res, { message: 'Broker sync coming soon' });
});
