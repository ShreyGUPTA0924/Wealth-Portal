import { Request, Response, CookieOptions } from 'express';
import * as AuthService from '../services/auth.service';

// ─── Cookie Configuration ─────────────────────────────────────────────────────

const IS_PROD = process.env['NODE_ENV'] === 'production';

const ACCESS_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days in ms
  path: '/',
};

const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  path: '/',
};

// ─── Cookie Helpers ───────────────────────────────────────────────────────────

function setAuthCookies(res: Response, tokens: AuthService.AuthTokens): void {
  res.cookie('accessToken', tokens.accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
}

function clearAuthCookies(res: Response): void {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}

// ─── Error Handling ───────────────────────────────────────────────────────────

function handleError(res: Response, err: unknown): void {
  const error = err as Error & { statusCode?: number };
  const status = error.statusCode ?? 500;
  const message =
    status === 500 && IS_PROD ? 'Internal server error' : error.message;

  res.status(status).json({ success: false, error: message });
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Creates user + default portfolio in a transaction, returns JWT cookies.
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { user, tokens } = await AuthService.registerUser(
      req.body as AuthService.RegisterDto
    );
    setAuthCookies(res, tokens);
    res.status(201).json({ success: true, data: { user } });
  } catch (err) {
    handleError(res, err);
  }
}

/**
 * POST /api/auth/login
 * Returns JWT cookies on success.
 * Returns { requiresTwoFa: true } when 2FA is enabled and no TOTP code was sent.
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const result = await AuthService.loginUser(req.body as AuthService.LoginDto);

    if (result.requiresTwoFa) {
      res.status(200).json({
        success: true,
        data: { requiresTwoFa: true, message: '2FA code required' },
      });
      return;
    }

    setAuthCookies(res, result.tokens);
    res.status(200).json({ success: true, data: { user: result.user } });
  } catch (err) {
    handleError(res, err);
  }
}

/**
 * POST /api/auth/refresh
 * Reads the refreshToken cookie, verifies it, and issues a fresh token pair.
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const cookieToken = (req.cookies as Record<string, string | undefined>)['refreshToken'];

    if (!cookieToken) {
      res.status(401).json({ success: false, error: 'No refresh token provided' });
      return;
    }

    const tokens = await AuthService.refreshAccessToken(cookieToken);
    setAuthCookies(res, tokens);
    res.status(200).json({ success: true, data: { message: 'Token refreshed' } });
  } catch (err) {
    handleError(res, err);
  }
}

/**
 * POST /api/auth/logout
 * Clears both httpOnly cookies.
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  clearAuthCookies(res);
  res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
}

/**
 * GET /api/auth/me  [protected]
 * Returns the authenticated user's profile.
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    // req.user is guaranteed by the authenticate middleware
    const user = await AuthService.getMe(req.user!.id);
    res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    handleError(res, err);
  }
}

/**
 * POST /api/auth/2fa/setup  [protected]
 * Generates a TOTP secret, stores it (unverified), returns the otpauth URL.
 * The frontend renders this as a QR code using a library like qrcode.react.
 */
export async function setup2FA(req: Request, res: Response): Promise<void> {
  try {
    const result = await AuthService.setup2FA(req.user!.id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    handleError(res, err);
  }
}

/**
 * POST /api/auth/2fa/verify  [protected]
 * Verifies the first TOTP token to confirm QR scan succeeded,
 * then flips twoFaEnabled = true on the user record.
 */
export async function verify2FA(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.body as { token: string };
    await AuthService.enable2FA(req.user!.id, token);
    res.status(200).json({
      success: true,
      data: { message: '2FA has been enabled on your account' },
    });
  } catch (err) {
    handleError(res, err);
  }
}
