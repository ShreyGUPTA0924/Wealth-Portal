import { prisma } from '../lib/prisma';
import { GoalCategory, GoalHealthStatus } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === 'object' && 'toNumber' in d && typeof (d as { toNumber: unknown }).toNumber === 'function') {
    return (d as { toNumber(): number }).toNumber();
  }
  return Number(d) || 0;
}

function appError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

/**
 * PMT formula: SIP = (FV × r) / ((1+r)^n − 1)
 * FV = future value (target), r = monthly rate, n = months left
 */
function computeRecommendedSip(
  targetAmount:  number,
  currentAmount: number,
  monthsLeft:    number,
  annualReturn   = 0.12
): number {
  if (monthsLeft <= 0) return 0;
  const r  = annualReturn / 12;
  const fv = targetAmount - currentAmount * Math.pow(1 + r, monthsLeft);
  if (fv <= 0) return 0;
  const sip = (fv * r) / (Math.pow(1 + r, monthsLeft) - 1);
  return Math.max(0, Math.round(sip));
}

/**
 * Compares actual progress vs expected progress (based on time elapsed).
 * ON_TRACK: actual >= 90% of expected
 * AT_RISK:  actual >= 60% of expected
 * OFF_TRACK: else
 */
function computeHealthStatus(
  targetAmount:  number,
  currentAmount: number,
  targetDate:    Date,
  createdAt:     Date
): GoalHealthStatus {
  const now = new Date();
  const totalMs = targetDate.getTime() - createdAt.getTime();
  const elapsedMs = now.getTime() - createdAt.getTime();

  if (totalMs <= 0 || elapsedMs < 0) {
    return currentAmount >= targetAmount ? GoalHealthStatus.ON_TRACK : GoalHealthStatus.OFF_TRACK;
  }

  const expectedProgressPct = Math.min(100, (elapsedMs / totalMs) * 100);
  const actualProgressPct = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

  if (actualProgressPct >= expectedProgressPct * 0.9) return GoalHealthStatus.ON_TRACK;
  if (actualProgressPct >= expectedProgressPct * 0.6) return GoalHealthStatus.AT_RISK;
  return GoalHealthStatus.OFF_TRACK;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateGoalDto {
  name:        string;
  category:    GoalCategory;
  targetAmount: number;
  targetDate:  string;
  portfolioId?: string;
}

export interface UpdateGoalDto {
  name?:        string;
  targetAmount?: number;
  targetDate?:  string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function getGoals(userId: string, portfolioId?: string) {
  const goals = await prisma.goal.findMany({
    where: {
      userId,
      ...(portfolioId ? { portfolioId } : {}),
    },
    orderBy: { priority: 'asc' },
  });

  return goals.map((g) => {
    const target = toNum(g.targetAmount);
    const current = toNum(g.currentAmount);
    const healthStatus = computeHealthStatus(target, current, g.targetDate, g.createdAt);
    return {
      id:                    g.id,
      portfolioId:           g.portfolioId,
      name:                  g.name,
      category:              g.category,
      targetAmount:          target,
      currentAmount:         current,
      targetDate:            g.targetDate.toISOString(),
      recommendedMonthlySip: g.recommendedMonthlySip ? toNum(g.recommendedMonthlySip) : null,
      healthStatus,
      priority:              g.priority,
      progressPercent:      target > 0 ? Math.min((current / target) * 100, 100) : 0,
      createdAt:             g.createdAt.toISOString(),
    };
  });
}

export async function getGoalById(userId: string, goalId: string) {
  const goal = await prisma.goal.findFirst({
    where:   { id: goalId, userId },
    include: {
      goalHoldings: {
        include: {
          holding: {
            select: {
              id:           true,
              name:         true,
              symbol:       true,
              assetClass:   true,
              currentValue: true,
              pnlPercent:   true,
            },
          },
        },
      },
    },
  });

  if (!goal) throw appError('Goal not found', 404);

  const target  = toNum(goal.targetAmount);
  const current = toNum(goal.currentAmount);

  // Generate simple projected timeline data
  const now        = new Date();
  const monthsLeft = Math.max(1, monthsBetween(now, goal.targetDate));
  const monthlySip = toNum(goal.recommendedMonthlySip) || computeRecommendedSip(target, current, monthsLeft);
  const r          = 0.01; // 12% annual / 12

  const timelineData: { month: number; date: string; projected: number }[] = [];
  for (let m = 0; m <= Math.min(monthsLeft, 60); m++) {
    const date      = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const projected = current * Math.pow(1 + r, m) + (monthlySip * (Math.pow(1 + r, m) - 1)) / r;
    timelineData.push({ month: m, date: date.toISOString().slice(0, 7), projected: Math.round(projected) });
  }

  return {
    id:                    goal.id,
    portfolioId:           goal.portfolioId,
    name:                  goal.name,
    category:              goal.category,
    targetAmount:          target,
    currentAmount:         current,
    targetDate:            goal.targetDate.toISOString(),
    recommendedMonthlySip: goal.recommendedMonthlySip ? toNum(goal.recommendedMonthlySip) : monthlySip,
    healthStatus:          goal.healthStatus,
    priority:              goal.priority,
    progressPercent:
      target > 0 ? Math.min((current / target) * 100, 100) : 0,
    createdAt:             goal.createdAt.toISOString(),
    linkedHoldings:        goal.goalHoldings.map((gh) => ({
      id:                gh.id,
      holdingId:         gh.holdingId,
      allocationPercent: toNum(gh.allocationPercent),
      holding: {
        id:           gh.holding.id,
        name:         gh.holding.name,
        symbol:       gh.holding.symbol,
        assetClass:   gh.holding.assetClass,
        currentValue: toNum(gh.holding.currentValue),
        pnlPercent:   gh.holding.pnlPercent ? toNum(gh.holding.pnlPercent) : null,
      },
    })),
    timelineData,
    recommendedSip: monthlySip,
  };
}

export async function createGoal(userId: string, dto: CreateGoalDto) {
  // Find the portfolio
  let portfolio;
  if (dto.portfolioId) {
    portfolio = await prisma.portfolio.findFirst({ where: { id: dto.portfolioId, userId } });
  } else {
    portfolio = await prisma.portfolio.findFirst({ where: { userId, familyMemberId: null } });
  }
  if (!portfolio) throw appError('Portfolio not found', 404);

  const now = new Date();
  const targetDate  = new Date(dto.targetDate);
  const monthsLeft  = Math.max(1, monthsBetween(now, targetDate));
  const recommendedMonthlySip = computeRecommendedSip(dto.targetAmount, 0, monthsLeft);
  const healthStatus = computeHealthStatus(dto.targetAmount, 0, targetDate, now);

  // Determine next priority
  const maxPriority = await prisma.goal.aggregate({
    where:  { userId },
    _max:   { priority: true },
  });
  const priority = (maxPriority._max.priority ?? 0) + 1;

  const goal = await prisma.goal.create({
    data: {
      portfolioId:           portfolio.id,
      userId,
      name:                  dto.name,
      category:              dto.category,
      targetAmount:          dto.targetAmount,
      currentAmount:         0,
      targetDate,
      recommendedMonthlySip,
      healthStatus,
      priority,
    },
  });

  return getGoalById(userId, goal.id);
}

export async function updateGoal(userId: string, goalId: string, dto: UpdateGoalDto) {
  const existing = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!existing) throw appError('Goal not found', 404);

  const targetDate  = dto.targetDate ? new Date(dto.targetDate) : existing.targetDate;
  const targetAmount = dto.targetAmount ?? toNum(existing.targetAmount);
  const currentAmount = toNum(existing.currentAmount);
  const monthsLeft  = Math.max(1, monthsBetween(new Date(), targetDate));
  const recommendedMonthlySip = computeRecommendedSip(targetAmount, currentAmount, monthsLeft);
  const healthStatus = computeHealthStatus(targetAmount, currentAmount, targetDate, existing.createdAt);

  await prisma.goal.update({
    where: { id: goalId },
    data:  {
      ...(dto.name         ? { name: dto.name }                : {}),
      ...(dto.targetAmount ? { targetAmount: dto.targetAmount } : {}),
      ...(dto.targetDate   ? { targetDate }                     : {}),
      recommendedMonthlySip,
      healthStatus,
    },
  });

  return getGoalById(userId, goalId);
}

export async function deleteGoal(userId: string, goalId: string): Promise<void> {
  const existing = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!existing) throw appError('Goal not found', 404);

  await prisma.$transaction([
    prisma.goalHolding.deleteMany({ where: { goalId } }),
    prisma.goal.delete({ where: { id: goalId } }),
  ]);
}

export async function linkHolding(
  userId:            string,
  goalId:            string,
  holdingId:         string,
  allocationPercent: number
) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw appError('Goal not found', 404);

  const holding = await prisma.holding.findFirst({ where: { id: holdingId, userId, isActive: true } });
  if (!holding) throw appError('Holding not found', 404);

  const goalHolding = await prisma.goalHolding.upsert({
    where:  { goalId_holdingId: { goalId, holdingId } },
    create: { goalId, holdingId, allocationPercent },
    update: { allocationPercent },
  });

  // Recompute currentAmount from linked holdings
  const allLinked = await prisma.goalHolding.findMany({
    where:   { goalId },
    include: { holding: { select: { currentValue: true } } },
  });
  const newCurrentAmount = allLinked.reduce(
    (sum, gh) => sum + (toNum(gh.holding.currentValue) * toNum(gh.allocationPercent)) / 100,
    0
  );

  const targetAmount = toNum(goal.targetAmount);
  const healthStatus = computeHealthStatus(targetAmount, newCurrentAmount, goal.targetDate, goal.createdAt);

  await prisma.goal.update({
    where: { id: goalId },
    data:  { currentAmount: newCurrentAmount, healthStatus },
  });

  const updatedGoal = await getGoalById(userId, goalId);
  return { goalHolding, updatedGoal };
}

export async function simulateGoal(
  userId:                string,
  goalId:                string,
  monthlySip:            number,
  expectedReturnPercent  = 12
) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw appError('Goal not found', 404);

  const target   = toNum(goal.targetAmount);
  const current  = toNum(goal.currentAmount);
  const r        = expectedReturnPercent / 100 / 12;
  const now      = new Date();

  // Find months until corpus reaches target
  let corpus = current;
  let months = 0;
  const maxMonths = 600; // 50 years cap

  while (corpus < target && months < maxMonths) {
    corpus = corpus * (1 + r) + monthlySip;
    months++;
  }

  const projectedCompletionDate = new Date(now.getFullYear(), now.getMonth() + months, 1);

  // Corpus at original target date
  const monthsToTarget  = Math.max(0, monthsBetween(now, goal.targetDate));
  let corpusAtTarget    = current;
  for (let m = 0; m < monthsToTarget; m++) {
    corpusAtTarget = corpusAtTarget * (1 + r) + monthlySip;
  }

  const shortfallOrSurplus = corpusAtTarget - target;

  return {
    projectedCompletionDate: projectedCompletionDate.toISOString(),
    corpusAtTarget:          Math.round(corpusAtTarget),
    shortfallOrSurplus:      Math.round(shortfallOrSurplus),
    monthsToComplete:        months,
  };
}

export async function reorderGoals(userId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.goal.updateMany({
        where: { id, userId },
        data:  { priority: index + 1 },
      })
    )
  );
}

/** Sync goal currentAmount from linked holdings (call after price sync) */
export async function syncGoalCurrentAmounts(): Promise<void> {
  const goals = await prisma.goal.findMany({
    include: {
      goalHoldings: {
        include: { holding: { select: { currentValue: true } } },
      },
    },
  });
  for (const g of goals) {
    const newCurrent = g.goalHoldings.reduce(
      (sum, gh) =>
        sum + (toNum(gh.holding.currentValue) * toNum(gh.allocationPercent)) / 100,
      0
    );
    const target = toNum(g.targetAmount);
    const health = computeHealthStatus(target, newCurrent, g.targetDate, g.createdAt);
    await prisma.goal.update({
      where: { id: g.id },
      data: { currentAmount: newCurrent, healthStatus: health },
    });
  }
}
