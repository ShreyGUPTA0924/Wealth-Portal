import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getFamilyOverview,
  addMember,
  updateMember,
  deleteMember,
  getMemberPortfolio,
  addMemberHolding,
  updateMemberHolding,
  deleteMemberHolding,
  addMemberTransaction,
} from '../controllers/family.controller';

const router = Router();

router.use(authenticate);

router.get('/',                                    getFamilyOverview);
router.post('/members',                            addMember);
router.patch('/members/:id',                       updateMember);
router.delete('/members/:id',                     deleteMember);
router.get('/members/:id/portfolio',               getMemberPortfolio);
router.post('/members/:id/holdings',               addMemberHolding);
router.patch('/members/:id/holdings/:holdingId',   updateMemberHolding);
router.delete('/members/:id/holdings/:holdingId', deleteMemberHolding);
router.post('/members/:id/holdings/:holdingId/transactions', addMemberTransaction);

export default router;
