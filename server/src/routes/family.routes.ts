import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { addHoldingSchema, addTransactionSchema, updateHoldingSchema } from './holdings.routes';
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
router.post('/members/:id/holdings',               validate({ body: addHoldingSchema }), addMemberHolding);
router.patch('/members/:id/holdings/:holdingId',
  validate({ body: updateHoldingSchema }),
  updateMemberHolding
);
router.delete('/members/:id/holdings/:holdingId', deleteMemberHolding);
router.post('/members/:id/holdings/:holdingId/transactions',
  validate({ body: addTransactionSchema }),
  addMemberTransaction
);

export default router;
