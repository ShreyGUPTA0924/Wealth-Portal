import { Request, Response, NextFunction } from 'express';
import { z, ZodType } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ValidationSchemas {
  body?:   ZodType;
  query?:  ZodType;
  params?: ZodType;
}

type ValidationErrors = Partial<Record<'body' | 'query' | 'params', z.ZodIssue[]>>;

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * validate — validates req.body / req.query / req.params against Zod schemas.
 *
 * NOTE (Express 5): req.query is a read-only getter in Express 5, so we
 * validate it but do NOT reassign it.  Coerced/defaulted values from Zod are
 * stored on req.validatedQuery so controllers can access them if needed.
 * For body and params the replacement still works as expected.
 *
 * Usage:
 *   router.post('/register', validate({ body: registerSchema }), controller)
 */
export const validate = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: ValidationErrors = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) {
        req.body = result.data as Record<string, unknown>;
      } else {
        errors.body = result.error.issues;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) {
        // Express 5: req.query is read-only — store parsed result separately
        (req as Request & { validatedQuery: unknown }).validatedQuery = result.data;
      } else {
        errors.query = result.error.issues;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) {
        req.params = result.data as typeof req.params;
      } else {
        errors.params = result.error.issues;
      }
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
      return;
    }

    next();
  };
};

// ─── Re-export z so routes can import from one place ─────────────────────────
export { z };
