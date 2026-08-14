// ─────────────────────────────────────────────────────────────────────────────
// index.ts — process entry point
//
// All Express app setup, middleware, and routes live in app.ts. This file is
// only responsible for binding a port and starting background jobs. Deployed
// on Render as a long-lived Node process (npm run dev locally / npm start —
// node dist/index.js — in production).
// ─────────────────────────────────────────────────────────────────────────────

import app from './app';
import { connectRedis } from './lib/redis';
import { startPriceSyncJob } from './jobs/priceSync.job';

const PORT = parseInt(process.env['PORT'] ?? '5000', 10);
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

app.listen(PORT, async () => {
  console.log(`WealthWise server running on port ${PORT} [${NODE_ENV}]`);

  // Connect Redis (non-blocking — server works without it)
  await connectRedis();

  // Background price-sync cron job
  startPriceSyncJob();
});

export default app;
