import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  listGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  linkHolding,
  simulateGoal,
  reorderGoals,
} from '../controllers/goals.controller';

const router = Router();

router.use(authenticate);

router.get('/',               listGoals);
router.post('/',              createGoal);
router.patch('/reorder',      reorderGoals);
router.get('/:id',            getGoal);
router.patch('/:id',          updateGoal);
router.delete('/:id',         deleteGoal);
router.post('/:id/link-holding', linkHolding);
router.post('/:id/simulate',  simulateGoal);

export default router;
