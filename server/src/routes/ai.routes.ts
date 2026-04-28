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
  optimizePortfolio,
  riskMetrics,
  monteCarlo,
  customRiskScore,
  correlation,
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

// Math Models
router.get('/optimize',          optimizePortfolio);
router.get('/risk-metrics',      riskMetrics);
router.post('/monte-carlo',      monteCarlo);
router.get('/custom-risk-score', customRiskScore);
router.get('/correlation',       correlation);

export default router;
