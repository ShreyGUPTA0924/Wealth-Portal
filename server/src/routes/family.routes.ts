import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getFamilyOverview,
  addMember,
  updateMember,
  deleteMember,
  getMemberPortfolio,
} from '../controllers/family.controller';

const router = Router();

router.use(authenticate);

router.get('/',                       getFamilyOverview);
router.post('/members',               addMember);
router.patch('/members/:id',          updateMember);
router.delete('/members/:id',         deleteMember);
router.get('/members/:id/portfolio',  getMemberPortfolio);

export default router;
