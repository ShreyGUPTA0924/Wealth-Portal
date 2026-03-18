import { Request, Response, NextFunction } from 'express';
import { Relationship } from '@prisma/client';
import * as familyService from '../services/family.service';
import { addHolding, addTransaction, updateHolding } from '../services/holdings.service';
import { recalculatePortfolio } from '../services/portfolio.service';
import { prisma } from '../lib/prisma';

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

export const getFamilyOverview = wrap(async (req, res) => {
  const overview = await familyService.getFamilyOverview(req.user!.id);
  ok(res, overview);
});

export const addMember = wrap(async (req, res) => {
  const dto = req.body as familyService.AddFamilyMemberDto;

  if (!dto.fullName || !dto.relationship) {
    res.status(400).json({ success: false, message: 'fullName and relationship are required' });
    return;
  }

  if (!Object.values(Relationship).includes(dto.relationship)) {
    res.status(400).json({
      success: false,
      message: `Invalid relationship. Valid: ${Object.values(Relationship).join(', ')}`,
    });
    return;
  }

  const result = await familyService.addFamilyMember(req.user!.id, dto);
  ok(res, result, 201);
});

export const updateMember = wrap(async (req, res) => {
  const memberId = [req.params['id']].flat()[0]!;
  const dto      = req.body as familyService.UpdateFamilyMemberDto;

  const member = await familyService.updateFamilyMember(req.user!.id, memberId, dto);
  ok(res, { member });
});

export const deleteMember = wrap(async (req, res) => {
  const memberId = [req.params['id']].flat()[0]!;
  await familyService.deleteFamilyMember(req.user!.id, memberId);
  ok(res, { message: 'Family member archived' });
});

export const getMemberPortfolio = wrap(async (req, res) => {
  const memberId = [req.params['id']].flat()[0]!;
  const result   = await familyService.getMemberPortfolio(req.user!.id, memberId);
  ok(res, result);
});

export const addMemberHolding = wrap(async (req, res) => {
  const memberId = [req.params['id']].flat()[0]!;
  const member   = await familyService.getMemberWithPortfolio(req.user!.id, memberId);
  if (member.userId !== req.user!.id) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }
  if (member.isMinor) {
    res.status(403).json({ success: false, message: "Cannot add holdings to a minor's portfolio" });
    return;
  }
  const portfolio = member.portfolio;
  if (!portfolio) {
    res.status(404).json({ success: false, message: 'Member portfolio not found' });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const result = await addHolding(req.user!.id, {
    ...body,
    portfolioId: portfolio.id,
  } as Parameters<typeof addHolding>[1]);
  ok(res, result, 201);
});

export const updateMemberHolding = wrap(async (req, res) => {
  const memberId   = [req.params['id']].flat()[0]!;
  const holdingId  = [req.params['holdingId']].flat()[0]!;
  const member     = await familyService.getMemberWithPortfolio(req.user!.id, memberId);
  if (member.userId !== req.user!.id) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }
  const portfolio = member.portfolio;
  if (!portfolio) {
    res.status(404).json({ success: false, message: 'Member portfolio not found' });
    return;
  }
  const holding = await prisma.holding.findFirst({
    where: { id: holdingId, portfolioId: portfolio.id, isActive: true },
  });
  if (!holding) {
    res.status(404).json({ success: false, message: 'Holding not found' });
    return;
  }
  const body = req.body as { notes?: string; manualPrice?: number; quantity?: number };
  const updated = await updateHolding(req.user!.id, holdingId, body);
  ok(res, updated);
});

export const deleteMemberHolding = wrap(async (req, res) => {
  const memberId   = [req.params['id']].flat()[0]!;
  const holdingId  = [req.params['holdingId']].flat()[0]!;
  const member     = await familyService.getMemberWithPortfolio(req.user!.id, memberId);
  if (member.userId !== req.user!.id) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }
  const portfolio = member.portfolio;
  if (!portfolio) {
    res.status(404).json({ success: false, message: 'Member portfolio not found' });
    return;
  }
  const holding = await prisma.holding.findFirst({
    where: { id: holdingId, portfolioId: portfolio.id, isActive: true },
  });
  if (!holding) {
    res.status(404).json({ success: false, message: 'Holding not found' });
    return;
  }
  await prisma.holding.update({
    where: { id: holdingId },
    data: { isActive: false },
  });
  await recalculatePortfolio(portfolio.id);
  ok(res, { success: true, message: 'Holding removed' });
});

export const addMemberTransaction = wrap(async (req, res) => {
  const memberId   = [req.params['id']].flat()[0]!;
  const holdingId = [req.params['holdingId']].flat()[0]!;
  const member     = await familyService.getMemberWithPortfolio(req.user!.id, memberId);
  if (member.userId !== req.user!.id) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }
  const portfolio = member.portfolio;
  if (!portfolio) {
    res.status(404).json({ success: false, message: 'Member portfolio not found' });
    return;
  }
  const holding = await prisma.holding.findFirst({
    where: { id: holdingId, portfolioId: portfolio.id, isActive: true },
  });
  if (!holding) {
    res.status(404).json({ success: false, message: 'Holding not found' });
    return;
  }
  const body = req.body as Parameters<typeof addTransaction>[2];
  const result = await addTransaction(req.user!.id, holdingId, body);
  ok(res, result, 201);
});
