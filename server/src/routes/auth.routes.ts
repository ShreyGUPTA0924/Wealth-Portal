import { Router } from 'express';
import { z } from 'zod';

import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.middleware';
import * as AuthController from '../controllers/auth.controller';

const router = Router();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long'),
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name is too long'),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  // Optional — only required when the user has 2FA enabled
  totpCode: z
    .string()
    .length(6, 'Authenticator code must be exactly 6 digits')
    .optional(),
});

const verify2FASchema = z.object({
  token: z
    .string()
    .length(6, 'Authenticator code must be exactly 6 digits'),
});

// ─── Public Routes ────────────────────────────────────────────────────────────

// authLimiter: max 10 attempts per 15 minutes per IP on register + login
router.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  AuthController.register
);

router.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  AuthController.login
);

router.post('/google', authLimiter, AuthController.googleAuth);

router.post('/refresh', AuthController.refresh);

router.post('/logout', AuthController.logout);

// ─── Protected Routes (require valid JWT) ─────────────────────────────────────

router.get('/me', authenticate, AuthController.getMe);

// 2FA — both steps require the user to be logged in
router.post('/2fa/setup', authenticate, AuthController.setup2FA);

router.post(
  '/2fa/verify',
  authenticate,
  otpLimiter,            // extra protection: max 5 TOTP attempts per 10 minutes
  validate({ body: verify2FASchema }),
  AuthController.verify2FA
);

export default router;
