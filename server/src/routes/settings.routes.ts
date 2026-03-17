import { Router } from 'express';
import { z }      from 'zod';
import { validate } from '../middleware/validate.middleware';
import * as ctrl    from '../controllers/settings.controller';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  fullName:    z.string().min(2).max(100).optional(),
  city:        z.string().max(100).optional(),
  dateOfBirth: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword:     z.string().min(8, 'New password must be at least 8 characters'),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Profile
router.get ('/profile',         ctrl.getProfile);
router.patch('/profile',         validate({ body: updateProfileSchema }), ctrl.updateProfile);

// Password
router.post('/change-password',  validate({ body: changePasswordSchema }), ctrl.changePassword);

// 2FA status (setup/verify/disable handled by auth routes — proxy status here)
router.get('/2fa/status',        ctrl.get2faStatus);

// Broker connections
router.get   ('/broker-connections',           ctrl.getBrokerConnections);
router.delete('/broker-connections/:broker',   ctrl.disconnectBroker);

export default router;
