import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { getPrice, type AssetClass } from '../services/market.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HoldingRow {
  id:          string;
  portfolioId: string;
  assetClass:  string;
  symbol:      string | null;
  quantity:    { toString(): string };
}

// ─── Core sync logic ──────────────────────────────────────────────────────────

async function syncPrices(): Promise<void> {
  const startedAt = Date.now();

  try {
    // Fetch all active holdings that have a tradeable symbol
    const holdings = await prisma.holding.findMany({
      where: {
        isActive: true,
        assetClass: { in: ['STOCK', 'MUTUAL_FUND', 'CRYPTO', 'GOLD', 'SGB'] },
      },
      select: { id: true, portfolioId: true, assetClass: true, symbol: true, quantity: true },
    });

    if (holdings.length === 0) return;

    // Deduplicate: only fetch a price once per (assetClass, symbol) pair
    const unique = new Map<string, HoldingRow>();
    for (const h of holdings) {
      if (!h.symbol && h.assetClass !== 'GOLD' && h.assetClass !== 'SGB') continue;
      const key = `${h.assetClass}:${h.symbol ?? 'GOLD'}`;
      if (!unique.has(key)) unique.set(key, h);
    }

    // Fetch prices (concurrently, but cap at 5 at a time to respect rate limits)
    const entries = Array.from(unique.entries());
    const BATCH = 5;

    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);

      await Promise.allSettled(
        batch.map(async ([key, holding]) => {
          try {
            const symbol     = holding.assetClass === 'GOLD' ? 'GOLD' : (holding.symbol ?? '');
            const assetClass = holding.assetClass as AssetClass;
            const priceData  = await getPrice(symbol, assetClass);

            // Update all holdings that share this (assetClass, symbol) pair
            const matchingHoldings = holdings.filter(
              (h) =>
                h.assetClass === holding.assetClass &&
                (h.symbol === holding.symbol || holding.assetClass === 'GOLD')
            );

            await Promise.allSettled(
              matchingHoldings.map(async (h) => {
                const qty          = parseFloat(h.quantity.toString());
                const currentValue = qty * priceData.price;

                await prisma.holding.update({
                  where: { id: h.id },
                  data: {
                    currentPrice: priceData.price,
                    currentValue,
                    pnlAbsolute:  null, // recomputed by holdings service on demand
                    pnlPercent:   null,
                  },
                });
              })
            );
          } catch (err) {
            const error = err as Error;
            console.warn(`[PriceSync] Failed to sync ${key}: ${error.message}`);
          }
        })
      );

      // Brief pause between batches to avoid hammering APIs
      if (i + BATCH < entries.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Update portfolio currentValue from sum of holdings
    const portfolioIds = [...new Set(holdings.map((h) => h.portfolioId))];

    await Promise.allSettled(
      portfolioIds.map(async (pid) => {
        const agg = await prisma.holding.aggregate({
          where:  { portfolioId: pid, isActive: true },
          _sum:   { currentValue: true, totalInvested: true },
        });

        await prisma.portfolio.update({
          where: { id: pid },
          data: {
            currentValue:  agg._sum.currentValue  ?? 0,
            totalInvested: agg._sum.totalInvested ?? 0,
          },
        });
      })
    );

    const elapsed = Date.now() - startedAt;
    console.log(
      `[PriceSync] Synced ${unique.size} unique symbols across ${holdings.length} holdings in ${elapsed}ms`
    );
  } catch (err) {
    const error = err as Error;
    console.error(`[PriceSync] Job failed: ${error.message}`);
    // Never rethrow — a job failure must not crash the server
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

let task: ReturnType<typeof cron.schedule> | null = null;

/**
 * startPriceSyncJob — call once after the Express server starts.
 *
 * Schedule:
 *   - Development: every 60 seconds
 *   - Production:  every 60 seconds during market hours (09:00–16:00 IST, Mon–Fri)
 *
 * The job is skipped entirely on weekends and public holidays when markets are closed
 * (yahoo-finance2 will return stale data anyway, so no point hammering APIs).
 */
export function startPriceSyncJob(): void {
  const isProd = process.env['NODE_ENV'] === 'production';

  // Cron: every minute  →  * * * * *
  // Cron: every minute Mon-Fri 9am-4pm IST  →  * 9-16 * * 1-5  (but we keep it simple)
  const schedule = isProd ? '*/1 3-11 * * 1-5' : '* * * * *';
  // Note: cron runs in server timezone (UTC). IST = UTC+5:30 → 9am IST = 3:30am UTC.
  //       Using */1 3-11 UTC covers 8:30am–5pm IST Mon–Fri.

  task = cron.schedule(schedule, () => {
    syncPrices().catch(() => {}); // already handled inside
  });

  console.log(`[PriceSync] Job scheduled (${isProd ? 'market hours only' : 'every minute'}) ✓`);

  // Run once immediately on startup so prices are fresh on first load
  void syncPrices();
}

/** Stop the job (useful for graceful shutdown) */
export function stopPriceSyncJob(): void {
  if (task) {
    task.stop();
    task = null;
    console.log('[PriceSync] Job stopped');
  }
}
