import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import speakeasy from 'speakeasy';
import axios from 'axios';
import { prisma } from '../lib/prisma';

// ─── Constants ────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;

// ─── Error Helper ─────────────────────────────────────────────────────────────

function createError(message: string, statusCode: number): Error {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface RegisterDto {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginDto {
  email: string;
  password: string;
  totpCode?: string;
}

// ─── Response Shapes ──────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** User shape returned to clients — no secrets, no password hash */
export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  dateOfBirth: Date | null;
  city: string | null;
  riskProfile: string;
  riskScore: number;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  onboardingStep: number;
  twoFaEnabled: boolean;
  createdAt: Date;
}

export type LoginResult =
  | { requiresTwoFa: true }
  | { requiresTwoFa: false; tokens: AuthTokens; user: SafeUser };

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function toSafeUser(user: {
  id: string;
  email: string;
  fullName: string;
  dateOfBirth: Date | null;
  city: string | null;
  riskProfile: string;
  riskScore: number;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  onboardingStep: number;
  twoFaEnabled: boolean;
  createdAt: Date;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    dateOfBirth: user.dateOfBirth,
    city: user.city,
    riskProfile: user.riskProfile,
    riskScore: user.riskScore,
    avatarUrl: user.avatarUrl,
    onboardingCompleted: user.onboardingCompleted,
    onboardingStep: user.onboardingStep,
    twoFaEnabled: user.twoFaEnabled,
    createdAt: user.createdAt,
  };
}

function generateAccessToken(id: string, email: string): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw createError('JWT_SECRET not configured', 500);
  const expiresIn = (process.env['JWT_EXPIRES_IN'] ?? '7d') as StringValue;
  return jwt.sign({ id, email }, secret, { expiresIn });
}

function generateRefreshToken(id: string): string {
  const secret = process.env['JWT_REFRESH_SECRET'];
  if (!secret) throw createError('JWT_REFRESH_SECRET not configured', 500);
  const expiresIn = (process.env['JWT_REFRESH_EXPIRES_IN'] ?? '30d') as StringValue;
  return jwt.sign({ id }, secret, { expiresIn });
}

function makeTokens(id: string, email: string): AuthTokens {
  return {
    accessToken: generateAccessToken(id, email),
    refreshToken: generateRefreshToken(id),
  };
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Register a new user and auto-create their default "My Portfolio".
 * Both writes happen inside a single transaction — if either fails, both roll back.
 */
export async function registerUser(
  dto: RegisterDto
): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const existing = await prisma.user.findUnique({
    where: { email: dto.email.toLowerCase() },
  });

  if (existing) {
    throw createError('An account with this email already exists', 409);
  }

  const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        fullName: dto.fullName,
      },
    });

    // Every user starts with one portfolio — more can be added later
    await tx.portfolio.create({
      data: {
        userId: newUser.id,
        name: 'My Portfolio',
      },
    });

    return newUser;
  });

  return { user: toSafeUser(user), tokens: makeTokens(user.id, user.email) };
}

/**
 * Validate credentials and return tokens.
 * If 2FA is enabled but no TOTP code was supplied, signal the frontend
 * to show the second-factor screen.
 */
export async function loginUser(dto: LoginDto): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: dto.email.toLowerCase() },
  });

  // Use a constant-time comparison path to prevent user-enumeration timing attacks
  if (!user) {
    await bcrypt.hash('dummy_constant_time', SALT_ROUNDS);
    throw createError('Invalid email or password', 401);
  }

  if (!user.passwordHash) {
    throw createError('This account uses Google sign-in. Please click "Continue with Google".', 401);
  }

  const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
  if (!passwordMatch) {
    throw createError('Invalid email or password', 401);
  }

  // 2FA gate
  if (user.twoFaEnabled && user.twoFaSecret) {
    if (!dto.totpCode) {
      return { requiresTwoFa: true };
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFaSecret,
      encoding: 'base32',
      token: dto.totpCode,
      window: 1, // tolerate ±30 s clock drift
    });

    if (!isValid) {
      throw createError('Invalid authenticator code', 401);
    }
  }

  return {
    requiresTwoFa: false,
    tokens: makeTokens(user.id, user.email),
    user: toSafeUser(user),
  };
}

/**
 * Verify a refresh token cookie and issue a fresh token pair.
 */
export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const secret = process.env['JWT_REFRESH_SECRET'];
  if (!secret) throw createError('JWT_REFRESH_SECRET not configured', 500);

  let payload: { id: string };

  try {
    payload = jwt.verify(refreshToken, secret) as { id: string };
  } catch {
    throw createError('Invalid or expired refresh token', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) throw createError('User not found', 401);

  return makeTokens(user.id, user.email);
}

/**
 * Return safe user data for the /me endpoint.
 */
export async function getMe(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw createError('User not found', 404);
  return toSafeUser(user);
}

/**
 * Generate a TOTP secret and persist it to the user record (unverified).
 * twoFaEnabled stays false until verify2FA succeeds.
 */
export async function setup2FA(
  userId: string
): Promise<{ otpauthUrl: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw createError('User not found', 404);

  const secret = speakeasy.generateSecret({
    length: 20,
    name: `WealthPortal (${user.email})`,
    issuer: 'WealthPortal',
  });

  // Save the raw secret; twoFaEnabled remains false until the first code is verified
  await prisma.user.update({
    where: { id: userId },
    data: { twoFaSecret: secret.base32 ?? '' },
  });

  return { otpauthUrl: secret.otpauth_url ?? '' };
}

/**
 * Google OAuth — verify access token with Google, then find-or-create user.
 * Returns the same shape as a normal login so the controller can reuse setAuthCookies.
 */
export async function googleAuthUser(
  accessToken: string
): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  // Verify the token by fetching profile from Google
  let googleProfile: { sub: string; email: string; name: string; picture?: string };
  try {
    const { data } = await axios.get<{ sub: string; email: string; name: string; picture?: string }>(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    googleProfile = data;
  } catch {
    throw createError('Invalid Google token — please try again', 401);
  }

  const { sub: googleId, email, name, picture } = googleProfile;

  // Try to find existing user by googleId first, then by email
  let user = await prisma.user.findUnique({ where: { googleId } });

  if (!user) {
    const byEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (byEmail) {
      // Link Google ID to an existing email account
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId, avatarUrl: byEmail.avatarUrl ?? picture ?? null },
      });
    } else {
      // Brand-new user — create account + default portfolio
      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            fullName: name,
            googleId,
            avatarUrl: picture ?? null,
            passwordHash: null,
          },
        });
        await tx.portfolio.create({
          data: { userId: newUser.id, name: 'My Portfolio' },
        });
        return newUser;
      });
    }
  }

  return { user: toSafeUser(user), tokens: makeTokens(user.id, user.email) };
}

/**
 * Verify the first TOTP token to confirm the user has correctly scanned
 * the QR code, then flip twoFaEnabled = true.
 */
export async function enable2FA(userId: string, token: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw createError('User not found', 404);
  if (!user.twoFaSecret) throw createError('2FA setup not started — call /2fa/setup first', 400);
  if (user.twoFaEnabled) throw createError('2FA is already enabled', 400);

  const isValid = speakeasy.totp.verify({
    secret: user.twoFaSecret,
    encoding: 'base32',
    token,
    window: 1,
  });

  if (!isValid) throw createError('Invalid authenticator code — please try again', 400);

  await prisma.user.update({
    where: { id: userId },
    data: { twoFaEnabled: true },
  });
}
