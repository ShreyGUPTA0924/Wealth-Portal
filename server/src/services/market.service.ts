import axios from 'axios';
// yahoo-finance2 v3 requires instantiation — create a shared instance
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
import { cacheGet, cacheSet, cacheKey, TTL } from '../lib/redis';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface PriceResult {
  symbol:           string;
  name:             string;
  price:            number;
  dayChangePercent: number | null;
  dayChangeAbs:     number | null;
  source:           string;
  cachedAt:         string;
}

export interface SearchResult {
  symbol:     string;
  name:       string;
  assetClass: string;
  exchange?:  string;
}

export interface HistoryPoint {
  date:  string;
  price: number;
}

// Minimal shape we read from yahoo-finance2 quote responses
interface YFQuote {
  regularMarketPrice?: number | null;
  regularMarketChange?: number | null;
  regularMarketChangePercent?: number | null;
  longName?: string | null;
  shortName?: string | null;
  symbol?: string | null;
}

// Minimal shape from yahoo-finance2 search responses
interface YFSearchResult {
  quotes?: Array<{
    symbol?: string;
    longname?: string;
    shortname?: string;
    quoteType?: string;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

/** Cast yahoo-finance2 quote result to our minimal interface */
function asYFQuote(raw: unknown): YFQuote {
  return raw as YFQuote;
}

/** Fetch USD → INR exchange rate (cached 5 min) */
async function getUsdInrRate(): Promise<number> {
  const key = cacheKey.forex();
  const cached = await cacheGet<number>(key);
  if (cached) return cached;

  try {
    const raw = await yahooFinance.quote('USDINR=X');
    const quote = asYFQuote(raw);
    const rate = quote.regularMarketPrice ?? 83.5;
    await cacheSet(key, rate, TTL.FOREX);
    return rate;
  } catch {
    return 83.5;
  }
}

// ─── Stock price (NSE via yahoo-finance2) ─────────────────────────────────────

export async function getStockPrice(symbol: string): Promise<PriceResult> {
  const upper = symbol.toUpperCase();
  const key = cacheKey.price('STOCK', upper);
  const cached = await cacheGet<PriceResult>(key);
  if (cached) return cached;

  for (const suffix of ['.NS', '.BO']) {
    const ticker = `${upper}${suffix}`;
    try {
      const raw = await yahooFinance.quote(ticker);
      const q = asYFQuote(raw);
      if (!q.regularMarketPrice) continue;

      const result: PriceResult = {
        symbol:           upper,
        name:             q.longName ?? q.shortName ?? upper,
        price:            q.regularMarketPrice,
        dayChangePercent: q.regularMarketChangePercent ?? null,
        dayChangeAbs:     q.regularMarketChange ?? null,
        source:           suffix === '.NS' ? 'NSE' : 'BSE',
        cachedAt:         now(),
      };

      await cacheSet(key, result, TTL.STOCK);
      return result;
    } catch {
      continue;
    }
  }

  throw new Error(`Could not fetch price for stock: ${upper}`);
}

// ─── Mutual Fund NAV (AMFI via mfapi.in) ─────────────────────────────────────

interface MfApiResponse {
  meta: { fund_house: string; scheme_name: string };
  data: Array<{ date: string; nav: string }>;
}

export async function getMutualFundNav(schemeCode: string): Promise<PriceResult> {
  const key = cacheKey.price('MUTUAL_FUND', schemeCode);
  const cached = await cacheGet<PriceResult>(key);
  if (cached) return cached;

  const res = await axios.get<MfApiResponse>(
    `https://api.mfapi.in/mf/${schemeCode}`,
    { timeout: 8_000 }
  );

  const latest = res.data.data[0];
  if (!latest) throw new Error(`No NAV data for scheme ${schemeCode}`);

  const prev      = res.data.data[1];
  const navToday  = parseFloat(latest.nav);
  const navPrev   = prev ? parseFloat(prev.nav) : null;
  const pctChange = navPrev ? ((navToday - navPrev) / navPrev) * 100 : null;

  const result: PriceResult = {
    symbol:           schemeCode,
    name:             res.data.meta.scheme_name,
    price:            navToday,
    dayChangePercent: pctChange,
    dayChangeAbs:     navPrev ? navToday - navPrev : null,
    source:           'AMFI',
    cachedAt:         now(),
  };

  await cacheSet(key, result, TTL.MUTUAL_FUND);
  return result;
}

// ─── Crypto price (CoinGecko free API) ───────────────────────────────────────

interface CoinGeckoResponse {
  [coinId: string]: { inr: number; inr_24h_change?: number };
}

const COIN_ALIASES: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether',
  BNB: 'binancecoin', SOL: 'solana', ADA: 'cardano',
  DOGE: 'dogecoin', MATIC: 'matic-network', DOT: 'polkadot', SHIB: 'shiba-inu',
};

export async function getCryptoPrice(symbol: string): Promise<PriceResult> {
  const coinId = COIN_ALIASES[symbol.toUpperCase()] ?? symbol.toLowerCase();
  const key = cacheKey.price('CRYPTO', coinId);
  const cached = await cacheGet<PriceResult>(key);
  if (cached) return cached;

  const res = await axios.get<CoinGeckoResponse>(
    'https://api.coingecko.com/api/v3/simple/price',
    { params: { ids: coinId, vs_currencies: 'inr', include_24hr_change: 'true' }, timeout: 8_000 }
  );

  const data = res.data[coinId];
  if (!data) throw new Error(`CoinGecko returned no data for: ${coinId}`);

  const result: PriceResult = {
    symbol:           symbol.toUpperCase(),
    name:             coinId.charAt(0).toUpperCase() + coinId.slice(1),
    price:            data.inr,
    dayChangePercent: data.inr_24h_change ?? null,
    dayChangeAbs:     null,
    source:           'CoinGecko',
    cachedAt:         now(),
  };

  await cacheSet(key, result, TTL.CRYPTO);
  return result;
}

// ─── Gold price (metals.live → converted to INR) ─────────────────────────────

interface MetalsLiveResponse { gold: number }

const TROY_OZ_TO_GRAM = 1 / 31.1035;

export async function getGoldPrice(): Promise<PriceResult> {
  const key = cacheKey.price('GOLD', 'XAU');
  const cached = await cacheGet<PriceResult>(key);
  if (cached) return cached;

  const [metalRes, usdInr] = await Promise.all([
    axios.get<MetalsLiveResponse>('https://api.metals.live/v1/spot/gold', { timeout: 8_000 }),
    getUsdInrRate(),
  ]);

  const inrPerGram = metalRes.data.gold * usdInr * TROY_OZ_TO_GRAM;

  const result: PriceResult = {
    symbol:           'GOLD',
    name:             'Gold (24K per gram)',
    price:            Math.round(inrPerGram * 100) / 100,
    dayChangePercent: null,
    dayChangeAbs:     null,
    source:           'metals.live',
    cachedAt:         now(),
  };

  await cacheSet(key, result, TTL.GOLD);
  return result;
}

// ─── Unified dispatcher ───────────────────────────────────────────────────────

export type AssetClass = 'STOCK' | 'MUTUAL_FUND' | 'CRYPTO' | 'GOLD' | 'SGB';

export async function getPrice(symbol: string, assetClass: AssetClass): Promise<PriceResult> {
  switch (assetClass) {
    case 'STOCK':       return getStockPrice(symbol);
    case 'MUTUAL_FUND': return getMutualFundNav(symbol);
    case 'CRYPTO':      return getCryptoPrice(symbol);
    case 'GOLD':
    case 'SGB':         return getGoldPrice();
    default:            throw new Error(`Unsupported asset class: ${assetClass as string}`);
  }
}

// ─── Symbol search ────────────────────────────────────────────────────────────

export async function searchSymbols(query: string, assetClass: string): Promise<SearchResult[]> {
  const key = cacheKey.search(query, assetClass);
  const cached = await cacheGet<SearchResult[]>(key);
  if (cached) return cached;

  if (assetClass === 'STOCK') {
    try {
      const raw = await yahooFinance.search(query, { newsCount: 0 });
      const res = raw as unknown as YFSearchResult;
      const quotes = (res.quotes ?? [])
        .filter(
          (q) =>
            q.quoteType === 'EQUITY' &&
            typeof q.symbol === 'string' &&
            (q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO'))
        )
        .slice(0, 10)
        .map((q) => ({
          symbol:     (q.symbol as string).replace(/\.(NS|BO)$/, ''),
          name:       (q.longname ?? q.shortname ?? q.symbol ?? '') as string,
          assetClass: 'STOCK',
          exchange:   (q.symbol as string).endsWith('.NS') ? 'NSE' : 'BSE',
        }));

      await cacheSet(key, quotes, TTL.SEARCH);
      return quotes;
    } catch {
      return [];
    }
  }

  if (assetClass === 'MUTUAL_FUND') {
    try {
      const res = await axios.get<Array<{ schemeCode: number; schemeName: string }>>(
        'https://api.mfapi.in/mf',
        { timeout: 10_000 }
      );
      const results = res.data
        .filter((s) => s.schemeName.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10)
        .map((s) => ({ symbol: String(s.schemeCode), name: s.schemeName, assetClass: 'MUTUAL_FUND' }));

      await cacheSet(key, results, TTL.SEARCH);
      return results;
    } catch {
      return [];
    }
  }

  if (assetClass === 'CRYPTO') {
    try {
      interface CoinGeckoSearchCoin {
        id:              string;
        name:            string;
        symbol:          string;
        market_cap_rank: number | null;
      }
      interface CoinGeckoSearchResponse {
        coins: CoinGeckoSearchCoin[];
      }

      const res = await axios.get<CoinGeckoSearchResponse>(
        'https://api.coingecko.com/api/v3/search',
        { params: { query }, timeout: 8_000 }
      );

      const results: SearchResult[] = res.data.coins
        .slice(0, 12)
        .map((c) => ({
          symbol:     c.id,                                               // coinId used for price lookups
          name:       `${c.name} · ${c.symbol.toUpperCase()}`,           // "Bitcoin · BTC"
          assetClass: 'CRYPTO',
          exchange:   c.market_cap_rank ? `Rank #${c.market_cap_rank}` : undefined,
        }));

      await cacheSet(key, results, TTL.SEARCH);
      return results;
    } catch {
      return [];
    }
  }

  return [];
}

// ─── Price history ────────────────────────────────────────────────────────────

const PERIOD_MAP: Record<string, { yPeriod: string; interval: string }> = {
  '1M':  { yPeriod: '1mo',  interval: '1d'  },
  '3M':  { yPeriod: '3mo',  interval: '1d'  },
  '6M':  { yPeriod: '6mo',  interval: '1d'  },
  '1Y':  { yPeriod: '1y',   interval: '1wk' },
  'MAX': { yPeriod: 'max',  interval: '1mo' },
};

export async function getPriceHistory(
  symbol: string,
  assetClass: AssetClass,
  period: string
): Promise<HistoryPoint[]> {
  const key = cacheKey.history(`${assetClass}:${symbol}`, period);
  const cached = await cacheGet<HistoryPoint[]>(key);
  if (cached) return cached;

  const conf = PERIOD_MAP[period] ?? PERIOD_MAP['1Y']!;

  if (assetClass === 'STOCK') {
    const ticker = `${symbol.toUpperCase()}.NS`;
    const rawRows = await yahooFinance.historical(ticker, {
      period1: getStartDate(conf.yPeriod),
      interval: conf.interval as '1d' | '1wk' | '1mo',
    });
    const rows = rawRows as Array<{ date: Date; close?: number | null }>;

    const points: HistoryPoint[] = rows
      .filter((r) => r.close != null)
      .map((r) => ({ date: r.date.toISOString().split('T')[0] as string, price: r.close as number }));

    await cacheSet(key, points, 600);
    return points;
  }

  if (assetClass === 'MUTUAL_FUND') {
    const res = await axios.get<MfApiResponse>(`https://api.mfapi.in/mf/${symbol}`, { timeout: 10_000 });
    const cutoff = new Date(getStartDate(conf.yPeriod));
    const points: HistoryPoint[] = res.data.data
      .filter((d) => new Date(d.date) >= cutoff)
      .map((d) => ({ date: d.date, price: parseFloat(d.nav) }))
      .reverse();

    await cacheSet(key, points, 3_600);
    return points;
  }

  if (assetClass === 'CRYPTO') {
    const coinId = COIN_ALIASES[symbol.toUpperCase()] ?? symbol.toLowerCase();
    const days = period === 'MAX' ? 'max' : String(periodToDays(period));

    interface MarketChartResponse { prices: Array<[number, number]> }
    const res = await axios.get<MarketChartResponse>(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`,
      { params: { vs_currency: 'inr', days }, timeout: 10_000 }
    );

    // CoinGecko returns many intraday points for short ranges; downsample to 1 per day
    const seen = new Set<string>();
    const points: HistoryPoint[] = [];
    for (const [ts, price] of res.data.prices) {
      const date = new Date(ts).toISOString().split('T')[0] as string;
      if (!seen.has(date)) {
        seen.add(date);
        points.push({ date, price: Math.round(price * 100) / 100 });
      }
    }

    await cacheSet(key, points, 600);
    return points;
  }

  if (assetClass === 'GOLD' || assetClass === 'SGB') {
    try {
      // GC=F is Gold Futures on COMEX (USD/troy-oz); convert to INR/gram
      const [rawRows, usdInr] = await Promise.all([
        yahooFinance.historical('GC=F', {
          period1:  getStartDate(conf.yPeriod),
          interval: conf.interval as '1d' | '1wk' | '1mo',
        }),
        getUsdInrRate(),
      ]);

      const rows = rawRows as Array<{ date: Date; close?: number | null }>;
      const points: HistoryPoint[] = rows
        .filter((r) => r.close != null)
        .map((r) => ({
          date:  r.date.toISOString().split('T')[0] as string,
          price: Math.round((r.close as number) * usdInr * TROY_OZ_TO_GRAM * 100) / 100,
        }));

      await cacheSet(key, points, 3_600);
      return points;
    } catch {
      return [];
    }
  }

  return [];
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getStartDate(yPeriod: string): string {
  const d = new Date();
  switch (yPeriod) {
    case '1mo':  d.setMonth(d.getMonth() - 1);         break;
    case '3mo':  d.setMonth(d.getMonth() - 3);         break;
    case '6mo':  d.setMonth(d.getMonth() - 6);         break;
    case '1y':   d.setFullYear(d.getFullYear() - 1);   break;
    default:     d.setFullYear(d.getFullYear() - 10);  break;
  }
  return d.toISOString().split('T')[0] as string;
}

function periodToDays(period: string): number {
  switch (period) {
    case '1M': return 30;
    case '3M': return 90;
    case '6M': return 180;
    default:   return 365;
  }
}
