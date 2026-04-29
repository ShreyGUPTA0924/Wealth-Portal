import dotenv from 'dotenv';
dotenv.config();

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { apiLimiter } from './middleware/rateLimit.middleware';
import { authenticate } from './middleware/auth.middleware';

import authRouter from './routes/auth.routes';
import marketRouter from './routes/market.routes';
import holdingsRouter from './routes/holdings.routes';
import portfolioRouter from './routes/portfolio.routes';
import goalsRouter from './routes/goals.routes';
import dashboardRouter from './routes/dashboard.routes';
import familyRouter from './routes/family.routes';
import aiRouter from './routes/ai.routes';
import learnRouter from './routes/learn.routes';
import settingsRouter from './routes/settings.routes';
import remindersRouter from './routes/reminders.routes';

const app: Application = express();
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

app.use(helmet());

const allowedOrigins = process.env['ALLOWED_ORIGINS']
  ? process.env['ALLOWED_ORIGINS'].split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, mobile, server-to-server)
      if (!origin) return callback(null, true);
      // Always allow in development
      if (NODE_ENV === 'development') return callback(null, true);
      // Allow any *.vercel.app subdomain (covers all preview + production deployments)
      if (origin.endsWith('.vercel.app')) return callback(null, true);
      // Allow explicitly listed origins from env
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Block everything else
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api/', apiLimiter);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'wealth-portal-server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

app.use('/api/auth', authRouter);
app.use('/api/market', marketRouter);
app.use('/api/holdings', holdingsRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/family', familyRouter);
app.use('/api/ai', aiRouter);
app.use('/api/learn', learnRouter);
app.use('/api/settings', authenticate, settingsRouter);
app.use('/api/reminders', remindersRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[ERROR] ${err.message}`, { stack: err.stack });
  const status = err.statusCode ?? 500;
  const message = NODE_ENV === 'production' && status === 500 ? 'Internal server error' : err.message;
  res.status(status).json({ success: false, message });
});

export default app;