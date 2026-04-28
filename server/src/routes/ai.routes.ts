import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  listChatSessions,
  getChatSession,
  chat,
  listNudges,
  updateNudge,
  analyse,
  getHealthScore,
} from '../controllers/ai.controller';

const router = Router();

router.use(authenticate);

// Chat sessions
router.get('/chat/sessions',     listChatSessions);
router.get('/chat/sessions/:id', getChatSession);
router.post('/chat',             chat);

// Nudges
router.get('/nudges',            listNudges);
router.patch('/nudges/:id',      updateNudge);

// Analysis + health
router.post('/analyse',          analyse);
router.get('/health-score',      getHealthScore);

export default router;
