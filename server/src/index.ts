import dotenv from 'dotenv';
dotenv.config();

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { apiLimiter } from './middleware/rateLimit.middleware';
import { connectRedis } from './lib/redis';
import { startPriceSyncJob } from './jobs/priceSync.job';

// ─── App Setup ────────────────────────────────────────────────────────────────

const app: Application = express();
const PORT = parseInt(process.env['PORT'] ?? '5000', 10);
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env['ALLOWED_ORIGINS']
  ? process.env['ALLOWED_ORIGINS'].split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, Postman) in development
      if (!origin || allowedOrigins.includes(origin) || NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Request Parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Global Rate Limiter ─────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'wealth-portal-server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
// Routes are mounted here as each step is completed.
// Uncomment each line when the corresponding router is created.

import authRouter from './routes/auth.routes';
import marketRouter from './routes/market.routes';
// import holdingsRouter from './routes/holdings.routes';
// import portfolioRouter from './routes/portfolio.routes';
// import goalsRouter from './routes/goals.routes';
// import dashboardRouter from './routes/dashboard.routes';
// import familyRouter from './routes/family.routes';
// import aiRouter from './routes/ai.routes';
// import reportsRouter from './routes/reports.routes';
// import notificationsRouter from './routes/notifications.routes';

app.use('/api/auth', authRouter);
app.use('/api/market', marketRouter);
// app.use('/api/holdings', holdingsRouter);
// app.use('/api/portfolio', portfolioRouter);
// app.use('/api/goals', goalsRouter);
// app.use('/api/dashboard', dashboardRouter);
// app.use('/api/family', familyRouter);
// app.use('/api/ai', aiRouter);
// app.use('/api/reports', reportsRouter);
// app.use('/api/notifications', notificationsRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Must have 4 parameters for Express to recognise it as an error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[ERROR] ${err.message}`, { stack: err.stack });

  res.status(500).json({
    success: false,
    message: NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`WealthPortal server running on port ${PORT} [${NODE_ENV}]`);

  // Connect Redis (non-blocking — server works without it)
  await connectRedis();

  // Start background price-sync job
  startPriceSyncJob();
});

export default app;
