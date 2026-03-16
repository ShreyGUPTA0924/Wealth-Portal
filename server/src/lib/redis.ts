import Redis from 'ioredis';

// ─── TTL constants (seconds) ──────────────────────────────────────────────────
export const TTL = {
  STOCK:       60,          // live quotes — refresh every minute
  CRYPTO:      60,
  MUTUAL_FUND: 3_600,       // NAV updates once per trading day
  GOLD:        300,         // spot gold — 5 minutes
  SEARCH:      600,         // symbol search results — 10 minutes
  FOREX:       300,         // USD/INR rate — 5 minutes
} as const;

// ─── Cache key helpers ────────────────────────────────────────────────────────
export const cacheKey = {
  price:   (assetClass: string, symbol: string) =>
    `price:${assetClass.toUpperCase()}:${symbol.toUpperCase()}`,
  search:  (q: string, assetClass: string) =>
    `search:${assetClass.toUpperCase()}:${q.toLowerCase()}`,
  history: (symbol: string, period: string) =>
    `history:${symbol.toUpperCase()}:${period}`,
  forex:   () => 'forex:USDINR',
};

// ─── Client ───────────────────────────────────────────────────────────────────

let redis: Redis | null = null;
let redisAvailable = false;

export function getRedis(): Redis | null {
  return redis;
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export async function connectRedis(): Promise<void> {
  const url = process.env['REDIS_URL'];
  if (!url) {
    console.warn('[Redis] REDIS_URL not set — running without cache');
    return;
  }

  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5_000,
      lazyConnect: true,
      enableOfflineQueue: false, // fail fast if disconnected
    });

    redis.on('connect', () => {
      redisAvailable = true;
      console.log('[Redis] Connected ✓');
    });

    redis.on('error', (err: Error) => {
      redisAvailable = false;
      // Only log once to avoid log spam
      console.warn(`[Redis] Connection error — running without cache: ${err.message}`);
    });

    redis.on('close', () => {
      redisAvailable = false;
    });

    await redis.connect();
  } catch (err) {
    redisAvailable = false;
    redis = null;
    console.warn('[Redis] Could not connect — market data will be fetched live every request');
  }
}

// ─── Safe wrappers (never throw) ─────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis || !redisAvailable) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis || !redisAvailable) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Silently ignore — cache is best-effort
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!redis || !redisAvailable) return;
  try {
    await redis.del(key);
  } catch {
    // Silently ignore
  }
}
