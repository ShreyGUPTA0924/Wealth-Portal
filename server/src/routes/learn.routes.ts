import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getDailyTip } from '../controllers/learn.controller';

const router = Router();

router.use(authenticate);

router.get('/daily-tip', getDailyTip);

export default router;
