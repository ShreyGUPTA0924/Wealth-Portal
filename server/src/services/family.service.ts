import { prisma } from '../lib/prisma';
import { Relationship } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(d: unknown): number {
  if (d == null) return 0;
  if (
    typeof d === 'object' &&
    'toNumber' in d &&
    typeof (d as { toNumber: unknown }).toNumber === 'function'
  ) {
    return (d as { toNumber(): number }).toNumber();
  }
  return Number(d) || 0;
}

function appError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

function calculateAge(dateOfBirth: Date): number {
  const now  = new Date();
  let age    = now.getFullYear() - dateOfBirth.getFullYear();
  const m    = now.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dateOfBirth.getDate())) age--;
  return age;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface AddFamilyMemberDto {
  fullName:         string;
  relationship:     Relationship;
  dateOfBirth?:     string;
  monthlyAllowance?: number;
}

export interface UpdateFamilyMemberDto {
  fullName?:         string;
  relationship?:     Relationship;
  monthlyAllowance?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function getFamilyOverview(userId: string) {
  const members = await prisma.familyMember.findMany({
    where:   { userId },
    include: {
      portfolio: {
        include: {
          holdings: {
            where:  { isActive: true },
            select: {
              assetClass:    true,
              totalInvested: true,
              currentValue:  true,
              pnlAbsolute:   true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  let familyNetWorth = 0;
  let totalInvested  = 0;

  const enriched = members.map((m) => {
    const holdings      = m.portfolio?.holdings ?? [];
    const memberInvested = holdings.reduce((s, h) => s + toNum(h.totalInvested), 0);
    const memberCurrent  = holdings.reduce((s, h) => s + toNum(h.currentValue),  0);
    const memberPnl      = memberCurrent - memberInvested;
    const memberPnlPct   = memberInvested > 0 ? (memberPnl / memberInvested) * 100 : 0;

    familyNetWorth += memberCurrent;
    totalInvested  += memberInvested;

    const age = m.dateOfBirth ? calculateAge(m.dateOfBirth) : null;

    return {
      id:              m.id,
      fullName:        m.fullName,
      relationship:    m.relationship,
      dateOfBirth:     m.dateOfBirth?.toISOString() ?? null,
      age,
      isMinor:         m.isMinor,
      monthlyAllowance: m.monthlyAllowance ? toNum(m.monthlyAllowance) : null,
      createdAt:       m.createdAt.toISOString(),
      portfolio: m.portfolio
        ? {
            id:            m.portfolio.id,
            totalInvested: memberInvested,
            currentValue:  memberCurrent,
            pnlAbsolute:   memberPnl,
            pnlPercent:    memberPnlPct,
            holdingsCount: holdings.length,
          }
        : null,
    };
  });

  const familyPnl    = familyNetWorth - totalInvested;
  const familyPnlPct = totalInvested > 0 ? (familyPnl / totalInvested) * 100 : 0;

  // Allocation by member (as percent of family net worth)
  const allocationByMember = enriched.map((m) => ({
    memberId:     m.id,
    fullName:     m.fullName,
    currentValue: m.portfolio?.currentValue ?? 0,
    percent:
      familyNetWorth > 0
        ? ((m.portfolio?.currentValue ?? 0) / familyNetWorth) * 100
        : 0,
  }));

  return {
    members:             enriched,
    familyNetWorth,
    totalInvested,
    familyPnlAbsolute:   familyPnl,
    familyPnlPercent:    familyPnlPct,
    allocationByMember,
  };
}

export async function addFamilyMember(userId: string, dto: AddFamilyMemberDto) {
  const dob     = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
  const isMinor = dob ? calculateAge(dob) < 18 : false;

  const member = await prisma.familyMember.create({
    data: {
      userId,
      fullName:         dto.fullName,
      relationship:     dto.relationship,
      dateOfBirth:      dob ?? undefined,
      isMinor,
      monthlyAllowance: dto.monthlyAllowance ?? null,
    },
  });

  const portfolio = await prisma.portfolio.create({
    data: {
      userId,
      familyMemberId: member.id,
      name:           `${dto.fullName}'s Portfolio`,
      totalInvested:  0,
      currentValue:   0,
    },
  });

  const age = dob ? calculateAge(dob) : null;

  return {
    familyMember: {
      id:              member.id,
      fullName:        member.fullName,
      relationship:    member.relationship,
      dateOfBirth:     member.dateOfBirth?.toISOString() ?? null,
      age,
      isMinor:         member.isMinor,
      monthlyAllowance: member.monthlyAllowance ? toNum(member.monthlyAllowance) : null,
      createdAt:       member.createdAt.toISOString(),
    },
    portfolio: {
      id:   portfolio.id,
      name: portfolio.name,
    },
  };
}

export async function updateFamilyMember(
  userId:   string,
  memberId: string,
  dto:      UpdateFamilyMemberDto
) {
  const existing = await prisma.familyMember.findFirst({ where: { id: memberId, userId } });
  if (!existing) throw appError('Family member not found', 404);

  const member = await prisma.familyMember.update({
    where: { id: memberId },
    data:  {
      ...(dto.fullName         ? { fullName: dto.fullName }                         : {}),
      ...(dto.relationship     ? { relationship: dto.relationship }                 : {}),
      ...(dto.monthlyAllowance !== undefined ? { monthlyAllowance: dto.monthlyAllowance } : {}),
    },
  });

  const age = member.dateOfBirth ? calculateAge(member.dateOfBirth) : null;

  return {
    id:              member.id,
    fullName:        member.fullName,
    relationship:    member.relationship,
    dateOfBirth:     member.dateOfBirth?.toISOString() ?? null,
    age,
    isMinor:         member.isMinor,
    monthlyAllowance: member.monthlyAllowance ? toNum(member.monthlyAllowance) : null,
    createdAt:       member.createdAt.toISOString(),
  };
}

export async function deleteFamilyMember(userId: string, memberId: string) {
  const existing = await prisma.familyMember.findFirst({
    where:   { id: memberId, userId },
    include: { portfolio: true },
  });
  if (!existing) throw appError('Family member not found', 404);

  // Soft delete: deactivate all holdings in their portfolio
  if (existing.portfolio) {
    await prisma.holding.updateMany({
      where: { portfolioId: existing.portfolio.id },
      data:  { isActive: false },
    });
  }

  // Hard delete the member record (portfolio cascades but holdings stay inactive)
  await prisma.familyMember.delete({ where: { id: memberId } });
}

export async function getMemberPortfolio(userId: string, memberId: string) {
  const member = await prisma.familyMember.findFirst({ where: { id: memberId, userId } });
  if (!member) throw appError('Family member not found', 404);

  const portfolio = await prisma.portfolio.findFirst({
    where:   { familyMemberId: memberId, userId },
    include: {
      holdings: {
        where:   { isActive: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id:           true,
          assetClass:   true,
          name:         true,
          symbol:       true,
          quantity:     true,
          avgBuyPrice:  true,
          totalInvested: true,
          currentPrice: true,
          currentValue: true,
          pnlAbsolute:  true,
          pnlPercent:   true,
          maturityDate: true,
          interestRate: true,
          brokerSource: true,
          createdAt:    true,
        },
      },
      goals: {
        orderBy: { priority: 'asc' },
        select: {
          id:            true,
          name:          true,
          category:      true,
          targetAmount:  true,
          currentAmount: true,
          targetDate:    true,
          healthStatus:  true,
        },
      },
    },
  });

  if (!portfolio) throw appError('Portfolio not found', 404);

  const holdings = portfolio.holdings;
  const totalInvested = holdings.reduce((s, h) => s + toNum(h.totalInvested), 0);
  const currentValue  = holdings.reduce((s, h) => s + toNum(h.currentValue),  0);
  const pnlAbsolute   = currentValue - totalInvested;
  const pnlPercent    = totalInvested > 0 ? (pnlAbsolute / totalInvested) * 100 : 0;

  const age     = member.dateOfBirth ? calculateAge(member.dateOfBirth) : null;
  const isMinor = member.isMinor;

  return {
    member: {
      id:              member.id,
      fullName:        member.fullName,
      relationship:    member.relationship,
      dateOfBirth:     member.dateOfBirth?.toISOString() ?? null,
      age,
      isMinor,
      monthlyAllowance: member.monthlyAllowance ? toNum(member.monthlyAllowance) : null,
    },
    portfolio: {
      id:            portfolio.id,
      name:          portfolio.name,
      totalInvested,
      currentValue,
      pnlAbsolute,
      pnlPercent,
      holdings: holdings.map((h) => ({
        id:            h.id,
        assetClass:    h.assetClass,
        name:          h.name,
        symbol:        h.symbol,
        quantity:      toNum(h.quantity),
        avgBuyPrice:   toNum(h.avgBuyPrice),
        totalInvested: toNum(h.totalInvested),
        currentPrice:  h.currentPrice ? toNum(h.currentPrice) : null,
        currentValue:  toNum(h.currentValue),
        pnlAbsolute:   toNum(h.pnlAbsolute),
        pnlPercent:    h.pnlPercent ? toNum(h.pnlPercent) : null,
        maturityDate:  h.maturityDate?.toISOString() ?? null,
        interestRate:  h.interestRate ? toNum(h.interestRate) : null,
        brokerSource:  h.brokerSource,
        createdAt:     h.createdAt.toISOString(),
      })),
      goals: portfolio.goals.map((g) => ({
        id:            g.id,
        name:          g.name,
        category:      g.category,
        targetAmount:  toNum(g.targetAmount),
        currentAmount: toNum(g.currentAmount),
        targetDate:    g.targetDate.toISOString(),
        healthStatus:  g.healthStatus,
        progressPercent:
          toNum(g.targetAmount) > 0
            ? Math.min((toNum(g.currentAmount) / toNum(g.targetAmount)) * 100, 100)
            : 0,
      })),
    },
  };
}
