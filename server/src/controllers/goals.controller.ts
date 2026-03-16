import { Request, Response, NextFunction } from 'express';
import { GoalCategory } from '@prisma/client';
import * as goalsService from '../services/goals.service';

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

export const listGoals = wrap(async (req, res) => {
  const portfolioId = [req.query['portfolioId']].flat()[0] as string | undefined;
  const goals = await goalsService.getGoals(req.user!.id, portfolioId);
  ok(res, { goals });
});

export const getGoal = wrap(async (req, res) => {
  const goalId = [req.params['id']].flat()[0]!;
  const goal   = await goalsService.getGoalById(req.user!.id, goalId);
  ok(res, { goal });
});

export const createGoal = wrap(async (req, res) => {
  const dto = req.body as goalsService.CreateGoalDto;

  if (!dto.name || !dto.category || !dto.targetAmount || !dto.targetDate) {
    res.status(400).json({ success: false, message: 'name, category, targetAmount, targetDate are required' });
    return;
  }

  if (!Object.values(GoalCategory).includes(dto.category)) {
    res.status(400).json({ success: false, message: `Invalid category. Valid: ${Object.values(GoalCategory).join(', ')}` });
    return;
  }

  const goal = await goalsService.createGoal(req.user!.id, dto);
  ok(res, { goal }, 201);
});

export const updateGoal = wrap(async (req, res) => {
  const goalId = [req.params['id']].flat()[0]!;
  const dto    = req.body as goalsService.UpdateGoalDto;
  const goal   = await goalsService.updateGoal(req.user!.id, goalId, dto);
  ok(res, { goal });
});

export const deleteGoal = wrap(async (req, res) => {
  const goalId = [req.params['id']].flat()[0]!;
  await goalsService.deleteGoal(req.user!.id, goalId);
  ok(res, { message: 'Goal deleted' });
});

export const linkHolding = wrap(async (req, res) => {
  const goalId = [req.params['id']].flat()[0]!;
  const { holdingId, allocationPercent } = req.body as { holdingId: string; allocationPercent: number };

  if (!holdingId || allocationPercent == null) {
    res.status(400).json({ success: false, message: 'holdingId and allocationPercent are required' });
    return;
  }

  const result = await goalsService.linkHolding(req.user!.id, goalId, holdingId, allocationPercent);
  ok(res, result, 201);
});

export const simulateGoal = wrap(async (req, res) => {
  const goalId = [req.params['id']].flat()[0]!;
  const { monthlySip, expectedReturnPercent } = req.body as {
    monthlySip:           number;
    expectedReturnPercent?: number;
  };

  if (monthlySip == null) {
    res.status(400).json({ success: false, message: 'monthlySip is required' });
    return;
  }

  const result = await goalsService.simulateGoal(
    req.user!.id, goalId, monthlySip, expectedReturnPercent
  );
  ok(res, result);
});

export const reorderGoals = wrap(async (req, res) => {
  const { orderedIds } = req.body as { orderedIds: string[] };

  if (!Array.isArray(orderedIds)) {
    res.status(400).json({ success: false, message: 'orderedIds array is required' });
    return;
  }

  await goalsService.reorderGoals(req.user!.id, orderedIds);
  ok(res, { message: 'Goals reordered' });
});
