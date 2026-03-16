import { Request, Response, NextFunction } from 'express';
import * as dashboardService from '../services/dashboard.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export const getDashboard = wrap(async (req, res) => {
  const data = await dashboardService.getDashboardData(req.user!.id);
  ok(res, data);
});

export const getChecklist = wrap(async (req, res) => {
  const items = await dashboardService.getChecklist(req.user!.id);
  ok(res, { items });
});

export const toggleChecklist = wrap(async (req, res) => {
  const templateId    = [req.params['templateId']].flat()[0]!;
  const { isPaid, actualAmount } = req.body as { isPaid: boolean; actualAmount?: number };

  if (typeof isPaid !== 'boolean') {
    res.status(400).json({ success: false, message: 'isPaid (boolean) is required' });
    return;
  }

  const entry = await dashboardService.toggleChecklistItem(
    req.user!.id,
    templateId,
    isPaid,
    actualAmount
  );
  ok(res, entry);
});

export const getNetWorthHistory = wrap(async (req, res) => {
  const period = ([req.query['period']].flat()[0] as string) ?? '1M';
  const data   = await dashboardService.getNetWorthHistory(req.user!.id, period);
  ok(res, data);
});
