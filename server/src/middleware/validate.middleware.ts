import { Request, Response, NextFunction } from 'express';
import { z, ZodType } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

// Each key is optional — only supply schemas for the parts you want to validate
interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

// Collects per-target error arrays
type ValidationErrors = Partial<Record<'body' | 'query' | 'params', z.ZodIssue[]>>;

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * validate — creates an Express middleware that validates req.body / req.query
 * / req.params against the provided Zod schemas.
 *
 * Usage:
 *   router.post('/register', validate({ body: registerSchema }), controller)
 *
 * On success:  req.body / query / params are replaced with the parsed (typed) value
 * On failure:  responds 400 with { success: false, message, errors }
 */
export const validate = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: ValidationErrors = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) {
        // Replace raw body with the cleaned / coerced Zod output
        req.body = result.data as Record<string, unknown>;
      } else {
        errors.body = result.error.issues;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) {
        // Express types req.query as ParsedQs; casting is intentional
        req.query = result.data as typeof req.query;
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
