// ─────────────────────────────────────────────────────────────────────────────
// index.ts — Local development entry point ONLY
//
// • All Express app setup, middleware, and routes live in app.ts
// • This file is only responsible for binding a port + starting background jobs
//   when running locally (npm run dev / npm start on a real server)
//
// • On Vercel, the serverless entry is  server/api/index.ts  which just
//   re-exports `app` from app.ts. This file is never touched by Vercel.
// ─────────────────────────────────────────────────────────────────────────────

import app from './app';
import { connectRedis } from './lib/redis';
import { startPriceSyncJob } from './jobs/priceSync.job';

const PORT = parseInt(process.env['PORT'] ?? '5000', 10);
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

// Vercel sets the VERCEL env variable to "1" automatically.
// Never start a TCP listener or cron job inside a serverless function.
const IS_VERCEL = process.env['VERCEL'] === '1';

if (!IS_VERCEL) {
  app.listen(PORT, async () => {
    console.log(`WealthWise server running on port ${PORT} [${NODE_ENV}]`);

    // Connect Redis (non-blocking — server works without it)
    await connectRedis();

    // Background price-sync cron job (only runs in long-lived environments)
    startPriceSyncJob();
  });
}

// Always export for any module that imports this file directly
export default app;
