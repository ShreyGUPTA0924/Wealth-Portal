import rateLimit from 'express-rate-limit';

// ─── Shared error response shape ─────────────────────────────────────────────

const tooManyRequestsBody = (message: string) => ({
  success: false,
  message,
});

// ─── General API Limiter ──────────────────────────────────────────────────────
// Applied to all /api/* routes — 100 requests per minute per IP

export const apiLimiter = rateLimit({
  windowMs: 60 * 1_000,        // 1 minute
  max: 100,
  standardHeaders: 'draft-7',  // Return RateLimit headers per RFC draft 7
  legacyHeaders: false,
  message: tooManyRequestsBody('Too many requests — please slow down.'),
});

// ─── Auth Limiter ─────────────────────────────────────────────────────────────
// Applied to /api/auth/* — 10 attempts per 15 minutes per IP
// Prevents brute-force on login / OTP endpoints

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,   // 15 minutes
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooManyRequestsBody(
    'Too many authentication attempts — please try again in 15 minutes.'
  ),
});

// ─── OTP / Password-Reset Limiter ────────────────────────────────────────────
// Even stricter — 5 attempts per 10 minutes per IP

export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1_000,   // 10 minutes
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooManyRequestsBody(
    'Too many OTP requests — please try again in 10 minutes.'
  ),
});

// ─── Report Generation Limiter ────────────────────────────────────────────────
// PDF generation is expensive — 5 requests per hour per IP

export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1_000,   // 1 hour
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooManyRequestsBody(
    'Report generation limit reached — please try again in an hour.'
  ),
});
