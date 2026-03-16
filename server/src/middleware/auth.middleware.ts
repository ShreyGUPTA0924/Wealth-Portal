import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Augment express-serve-static-core so req.user is typed everywhere.
// This file is always in the import chain (index → auth.routes → auth.middleware),
// so the augmentation is guaranteed to be loaded by ts-node.
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
    };
  }
}

// ─── JWT Payload Shape ────────────────────────────────────────────────────────

interface AccessTokenPayload {
  id: string;
  email: string;
  iat: number;
  exp: number;
}

// ─── Token Extraction ─────────────────────────────────────────────────────────

/**
 * Reads the access token from either:
 *   1. Authorization header:  "Bearer <token>"
 *   2. httpOnly cookie:       accessToken=<token>
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // cookie-parser populates req.cookies
  const cookieToken = (req.cookies as Record<string, string | undefined>)['accessToken'];
  if (cookieToken) return cookieToken;

  return null;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * authenticate — protects any route that requires a valid JWT.
 *
 * On success:  sets req.user = { id, email } and calls next()
 * On failure:  responds with 401 / 500 and does NOT call next()
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    console.error('[AUTH] JWT_SECRET is not set in environment variables');
    res.status(500).json({ success: false, message: 'Server misconfiguration' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as AccessTokenPayload;

    req.user = {
      id: decoded.id,
      email: decoded.email,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Token has expired' });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, message: 'Invalid token' });
    } else {
      res.status(500).json({ success: false, message: 'Authentication failed' });
    }
  }
};

/**
 * optionalAuth — same as authenticate but does NOT block unauthenticated
 * requests. Useful for routes that behave differently when logged in.
 */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = extractToken(req);
  const secret = process.env['JWT_SECRET'];

  if (token && secret) {
    try {
      const decoded = jwt.verify(token, secret) as AccessTokenPayload;
      req.user = { id: decoded.id, email: decoded.email };
    } catch {
      // Silently ignore — request continues unauthenticated
    }
  }

  next();
};
