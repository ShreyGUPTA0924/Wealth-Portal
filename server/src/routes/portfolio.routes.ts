import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getPortfolioSummary } from '../controllers/holdings.controller';

const router = Router();

router.use(authenticate);

router.get('/', getPortfolioSummary);

export default router;
