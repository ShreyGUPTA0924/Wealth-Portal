import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getDashboard,
  getChecklist,
  toggleChecklist,
  getNetWorthHistory,
} from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate);

router.get('/',                              getDashboard);
router.get('/checklist',                     getChecklist);
router.post('/checklist/:templateId/toggle', toggleChecklist);
router.get('/net-worth-history',             getNetWorthHistory);

export default router;
