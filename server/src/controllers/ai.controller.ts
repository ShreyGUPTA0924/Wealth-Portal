import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { getPortfolioSummary } from '../services/portfolio.service';
import { getGoals } from '../services/goals.service';
import { NudgeType, NudgeSeverity } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AI_SERVICE_URL = process.env['AI_SERVICE_URL'] ?? 'http://localhost:8000';

function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

async function buildUserContext(userId: string) {
  try {
    const [portfolioSummary, goals, user] = await Promise.all([
      getPortfolioSummary(userId).catch(() => null),
      getGoals(userId).catch(() => []),
      prisma.user.findUnique({
        where: { id: userId },
        select: { riskProfile: true, fullName: true },
      }),
    ]);

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const checklistHistory = await prisma.checklistEntry.findMany({
      where: {
        userId,
        monthYear: { gte: threeMonthsAgo },
      },
      include: {
        template: { select: { label: true, category: true, amount: true } },
      },
      orderBy: { monthYear: 'desc' },
    }).catch(() => []);

    return {
    portfolio: portfolioSummary,
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      progressPercent: g.progressPercent,
      healthStatus: g.healthStatus,
      targetDate: g.targetDate,
    })),
    risk_profile: user?.riskProfile ?? 'MODERATE',
    checklist_history: checklistHistory
      .filter((e) => e.template)
      .map((e) => ({
        label: e.template!.label,
        category: e.template!.category,
        amount: e.template!.amount ? Number(e.template!.amount) : null,
        monthYear: e.monthYear,
        isPaid: e.isPaid,
      })),
  };
  } catch {
    return { portfolio: null, goals: [], risk_profile: 'MODERATE', checklist_history: [] };
  }
}

// ─── Chat Sessions ─────────────────────────────────────────────────────────────

export const listChatSessions = wrap(async (req, res) => {
  const userId = req.user!.id;

  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    include: {
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  ok(res, {
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title ?? 'New Chat',
      messageCount: s._count.messages,
      createdAt: s.createdAt.toISOString(),
    })),
  });
});

export const getChatSession = wrap(async (req, res) => {
  const userId    = req.user!.id;
  const sessionId = [req.params['id']].flat()[0]!;

  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!session) {
    res.status(404).json({ success: false, message: 'Session not found' });
    return;
  }

  ok(res, {
    session: {
      id: session.id,
      title: session.title ?? 'New Chat',
      createdAt: session.createdAt.toISOString(),
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    },
  });
});

// ─── Chat (SSE Streaming) ─────────────────────────────────────────────────────

export const chat = wrap(async (req, res) => {
  const userId = req.user!.id;
  const { message, sessionId } = req.body as { message: string; sessionId?: string };

  if (!message?.trim()) {
    res.status(400).json({ success: false, message: 'message is required' });
    return;
  }

  // Resolve or create session
  let session = sessionId
    ? await prisma.chatSession.findFirst({ where: { id: sessionId, userId } })
    : null;

  const isNewSession = !session;

  if (!session) {
    session = await prisma.chatSession.create({
      data: {
        userId,
        title: message.slice(0, 60),
      },
    });
  }

  // Save user message
  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: 'USER',
      content: message,
    },
  });

  // Build context
  const userContext = await buildUserContext(userId);

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send session info first
  res.write(`data: ${JSON.stringify({ sessionId: session.id, isNewSession })}\n\n`);

  let assistantContent = '';

  try {
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/ai/chat`,
      {
        message,
        session_id: session.id,
        user_context: userContext,
      },
      { responseType: 'stream', timeout: 120_000 }
    );

    await new Promise<void>((resolve, reject) => {
      let buffer = '';

      (aiResponse.data as NodeJS.ReadableStream).on('data', (raw: Buffer) => {
        buffer += raw.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;

          try {
            const parsed = JSON.parse(payload) as { chunk?: string; done?: boolean; error?: string };
            if (parsed.chunk) {
              assistantContent += parsed.chunk;
              res.write(`data: ${JSON.stringify({ chunk: parsed.chunk })}\n\n`);
            } else if (parsed.done) {
              res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            } else if (parsed.error) {
              res.write(`data: ${JSON.stringify({ error: parsed.error })}\n\n`);
            }
          } catch {
            // skip malformed lines
          }
        }
      });

      (aiResponse.data as NodeJS.ReadableStream).on('end', resolve);
      (aiResponse.data as NodeJS.ReadableStream).on('error', reject);
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: 'AI service unavailable' })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    assistantContent =
      'The AI advisor is temporarily unavailable. Please start the ai-service (see README) and try again.';
  }

  // Save assistant response
  if (assistantContent) {
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'ASSISTANT',
        content: assistantContent,
      },
    });

    // Update session title if it's the first user message
    if (isNewSession) {
      await prisma.chatSession.update({
        where: { id: session.id },
        data:  { title: message.slice(0, 60) },
      });
    }
  }

  res.end();
});

// ─── Nudges ────────────────────────────────────────────────────────────────────

export const listNudges = wrap(async (req, res) => {
  const userId = req.user!.id;
  const { type, is_read, limit = '20' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = { userId, isDismissed: false };
  if (type) where['nudgeType'] = type;
  if (is_read !== undefined) where['isRead'] = is_read === 'true';

  const [nudges, unreadCount] = await Promise.all([
    prisma.aiNudge.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: parseInt(limit, 10),
    }),
    prisma.aiNudge.count({
      where: { userId, isRead: false, isDismissed: false },
    }),
  ]);

  ok(res, { nudges, unread_count: unreadCount });
});

export const updateNudge = wrap(async (req, res) => {
  const userId  = req.user!.id;
  const nudgeId = [req.params['id']].flat()[0]!;
  const { isRead, isDismissed } = req.body as { isRead?: boolean; isDismissed?: boolean };

  const existing = await prisma.aiNudge.findFirst({ where: { id: nudgeId, userId } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Nudge not found' });
    return;
  }

  const nudge = await prisma.aiNudge.update({
    where: { id: nudgeId },
    data: {
      ...(isRead      !== undefined ? { isRead }      : {}),
      ...(isDismissed !== undefined ? { isDismissed } : {}),
    },
  });

  ok(res, { nudge });
});

// ─── Analyse (generate nudges + health score) ─────────────────────────────────

export const analyse = wrap(async (req, res) => {
  const userId = req.user!.id;

  // Fetch portfolio with holdings for the AI service
  const portfolio = await prisma.portfolio.findFirst({
    where: { userId, familyMemberId: null },
    include: {
      holdings: {
        where: { isActive: true },
        select: {
          id: true,
          assetClass: true,
          name: true,
          symbol: true,
          totalInvested: true,
          currentValue: true,
          pnlAbsolute: true,
          pnlPercent: true,
          maturityDate: true,
          interestRate: true,
          notes: true,
        },
      },
    },
  });

  const goals    = await getGoals(userId);
  const user     = await prisma.user.findUnique({ where: { id: userId }, select: { riskProfile: true } });

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const checklistHistory = await prisma.checklistEntry.findMany({
    where: { userId, monthYear: { gte: threeMonthsAgo } },
  });

  if (!portfolio) {
    ok(res, { new_nudges: [], health_score: null });
    return;
  }

  // Build allocation breakdown by asset class
  const allocationMap = new Map<string, number>();
  for (const h of portfolio.holdings) {
    const cls = h.assetClass as string;
    allocationMap.set(cls, (allocationMap.get(cls) ?? 0) + Number(h['currentValue'] ?? 0));
  }
  const totalCurrentValue = Number(portfolio.currentValue) || 0;
  const allocationArray = Array.from(allocationMap.entries()).map(([assetClass, value]) => ({
    assetClass,
    value,
    currentValue: value,
    percent: totalCurrentValue > 0 ? (value / totalCurrentValue) * 100 : 0,
  }));

  const portfolioPayload = {
    holdings: (portfolio.holdings as Array<Record<string, unknown>>).map((h) => ({
      ...h,
      totalInvested: Number(h['totalInvested'] ?? 0),
      currentValue:  Number(h['currentValue']  ?? 0),
      pnlAbsolute:   Number(h['pnlAbsolute']   ?? 0),
      pnlPercent:    Number(h['pnlPercent']    ?? 0),
    })),
    currentValue:  totalCurrentValue,
    totalInvested: Number(portfolio.totalInvested),
    allocation:    allocationArray,
  };

  const goalsPayload = goals.map((g) => ({
    id:              g.id,
    name:            g.name,
    progressPercent: g.progressPercent,
    healthStatus:    g.healthStatus,
    targetDate:      g.targetDate,
  }));

  try {
    const [nudgesResp, scoreResp] = await Promise.all([
      axios.post(`${AI_SERVICE_URL}/ai/nudges/analyse`, {
        portfolio: portfolioPayload,
        goals:     goalsPayload,
        risk_profile: user?.riskProfile ?? 'MODERATE',
      }),
      axios.post(`${AI_SERVICE_URL}/ai/health-score`, {
        portfolio:         portfolioPayload,
        goals:             goalsPayload,
        checklist_history: checklistHistory.map((e) => ({
          monthYear: e.monthYear,
          isPaid:    e.isPaid,
        })),
      }),
    ]);

    const rawNudges = (nudgesResp.data as { nudges: Array<{
      nudgeType: string;
      title: string;
      message: string;
      severity: string;
      relatedHoldingId?: string;
      relatedGoalId?: string;
    }> }).nudges;

    const nudgeTypeMap: Record<string, NudgeType> = {
      REBALANCE:       'REBALANCE',
      EXPENSE_RATIO:   'EXPENSE_RATIO',
      CONCENTRATION:   'CONCENTRATION',
      SIP_UNDERPERFORM: 'SIP_UNDERPERFORM',
      PANIC_SELL:      'PANIC_SELL',
      HEALTH_REPORT:   'HEALTH_REPORT',
    };
    const severityMap: Record<string, NudgeSeverity> = {
      INFO:    'INFO',
      WARNING: 'WARNING',
      URGENT:  'URGENT',
    };

    const savedNudges = await Promise.all(
      rawNudges.map((n) =>
        prisma.aiNudge.create({
          data: {
            userId,
            nudgeType:        nudgeTypeMap[n.nudgeType] ?? 'HEALTH_REPORT',
            title:            n.title,
            message:          n.message,
            severity:         severityMap[n.severity] ?? 'INFO',
            relatedHoldingId: n.relatedHoldingId ?? null,
            relatedGoalId:    n.relatedGoalId    ?? null,
          },
        })
      )
    );

    ok(res, {
      new_nudges:   savedNudges,
      health_score: scoreResp.data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI service error';
    res.status(502).json({ success: false, message: `AI service error: ${msg}` });
  }
});

// ─── Health Score ─────────────────────────────────────────────────────────────

export const getHealthScore = wrap(async (req, res) => {
  const userId = req.user!.id;

  const portfolio = await prisma.portfolio.findFirst({
    where: { userId, familyMemberId: null },
    include: {
      holdings: {
        where: { isActive: true },
        select: {
          id: true, assetClass: true, totalInvested: true,
          currentValue: true, pnlPercent: true,
        },
      },
    },
  });

  const goals = await getGoals(userId);
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const checklistHistory = await prisma.checklistEntry.findMany({
    where: { userId, monthYear: { gte: threeMonthsAgo } },
  });

  if (!portfolio || portfolio.holdings.length === 0) {
    ok(res, { overall: 0, breakdown: { diversification: 0, goals: 0, quality: 0, discipline: 0 }, summary: 'Add your first holding to start computing your financial health score.' });
    return;
  }

  // Build allocation breakdown by asset class
  const allocationMap2 = new Map<string, number>();
  for (const h of portfolio.holdings) {
    const cls = h.assetClass as string;
    allocationMap2.set(cls, (allocationMap2.get(cls) ?? 0) + Number(h['currentValue'] ?? 0));
  }
  const totalCV = Number(portfolio.currentValue) || 0;
  const allocationArray2 = Array.from(allocationMap2.entries()).map(([assetClass, value]) => ({
    assetClass,
    value,
    currentValue: value,
    percent: totalCV > 0 ? (value / totalCV) * 100 : 0,
  }));

  const portfolioPayload = {
    holdings: (portfolio.holdings as Array<Record<string, unknown>>).map((h) => ({
      ...h,
      totalInvested: Number(h['totalInvested'] ?? 0),
      currentValue:  Number(h['currentValue']  ?? 0),
      pnlPercent:    Number(h['pnlPercent']    ?? 0),
    })),
    currentValue: totalCV,
    allocation:   allocationArray2,
  };

  try {
    const scoreResp = await axios.post(`${AI_SERVICE_URL}/ai/health-score`, {
      portfolio:         portfolioPayload,
      goals:             goals.map((g) => ({
        id:              g.id,
        progressPercent: g.progressPercent,
        healthStatus:    g.healthStatus,
      })),
      checklist_history: checklistHistory.map((e) => ({
        monthYear: e.monthYear,
        isPaid:    e.isPaid,
      })),
    });

    ok(res, scoreResp.data);
  } catch {
    ok(res, { overall: 0, breakdown: { diversification: 0, goals: 0, quality: 0, discipline: 0 }, summary: 'Unable to compute health score at this time.' });
  }
});
