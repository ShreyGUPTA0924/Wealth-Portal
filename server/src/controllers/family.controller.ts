import { Request, Response, NextFunction } from 'express';
import { Relationship } from '@prisma/client';
import * as familyService from '../services/family.service';

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
