import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  getUpcomingReminders,
  markPaid,
  markUnpaid,
  importCibil,
} from '../controllers/reminders.controller';

const router = Router();

router.use(authenticate);

router.get('/', getReminders);
router.post('/', createReminder);
router.get('/upcoming', getUpcomingReminders);
router.post('/import-cibil', importCibil);

router.patch('/:id', updateReminder);
router.delete('/:id', deleteReminder);
router.post('/:id/pay', markPaid);
router.post('/:id/unpay', markUnpaid);

export default router;
