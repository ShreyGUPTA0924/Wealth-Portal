import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

// ─── GET /api/settings/profile ───────────────────────────────────────────────

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id as string;
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: {
        id:          true,
        fullName:    true,
        email:       true,
        dateOfBirth: true,
        city:        true,
        riskProfile: true,
        riskScore:   true,
        avatarUrl:   true,
      },
    });

    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    res.json({ success: true, data: user });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
}

// ─── PATCH /api/settings/profile ─────────────────────────────────────────────

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id as string;
    const { fullName, city, dateOfBirth } = req.body as {
      fullName?:    string;
      city?:        string;
      dateOfBirth?: string;
    };

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName    ? { fullName }                                           : {}),
        ...(city        ? { city }                                               : {}),
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) }                : {}),
      },
      select: { id: true, fullName: true, email: true, city: true, dateOfBirth: true, riskProfile: true, riskScore: true },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
}

// ─── POST /api/settings/change-password ──────────────────────────────────────

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id as string;
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword:     string;
    };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(400).json({ success: false, error: 'Current password is incorrect' }); return; }

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });

    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
}

// ─── GET /api/settings/2fa/status ────────────────────────────────────────────

export async function get2faStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id as string;
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { twoFaEnabled: true },
    });

    res.json({ success: true, data: { twoFaEnabled: user?.twoFaEnabled ?? false } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
}

// ─── GET /api/settings/broker-connections ────────────────────────────────────

export async function getBrokerConnections(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id as string;

    // Broker connections are stored on the portfolio's brokerSource field
    // We surface which brokers have holdings imported from them
    const holdings = await prisma.holding.findMany({
      where:  { portfolio: { userId }, isActive: true, brokerSource: { not: 'MANUAL' } },
      select: { brokerSource: true, createdAt: true },
      distinct: ['brokerSource'],
    });

    const connections = holdings.map((h) => ({
      broker:      h.brokerSource,
      connectedAt: h.createdAt.toISOString(),
      accountId:   null,
    }));

    res.json({ success: true, data: { connections } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
}

// ─── DELETE /api/settings/broker-connections/:broker ─────────────────────────

export async function disconnectBroker(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id as string;
    const broker = (req.params['broker'] as string).toUpperCase();

    // Mark holdings from that broker as having no broker source (revert to MANUAL)
    await prisma.holding.updateMany({
      where: { portfolio: { userId }, brokerSource: broker as any },
      data:  { brokerSource: 'MANUAL' },
    });

    res.json({ success: true, message: `Disconnected ${broker}` });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
}
