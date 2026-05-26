import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import prisma from '@/lib/prisma';
import upstoxClient from './client';
import type { UpstoxHistoricalResponse } from './types';
import type { CandleData } from '@/types/stock';

const UPSTOX_HISTORICAL_BASE = 'https://api.upstox.com/v2/historical-candle';
const UPSTOX_INTRADAY_BASE = 'https://api.upstox.com/v2/historical-candle/intraday';
const UPSTOX_MARKET_QUOTE_BASE = 'https://api.upstox.com/v2/market-quote';

/**
 * Fetch historical candle data from the Upstox API.
 *
 * @param instrumentKey - The instrument key (e.g., "NSE_EQ|INE002A01018")
 * @param interval - Candle interval: "1minute", "30minute", "day", "week", "month"
 * @param fromDate - Start date in YYYY-MM-DD format
 * @param toDate - End date in YYYY-MM-DD format
 * @returns Array of CandleData objects sorted by timestamp ascending
 */
export async function fetchHistoricalCandles(
  instrumentKey: string,
  interval: string,
  fromDate: string,
  toDate: string
): Promise<CandleData[]> {
  // Instrument key must be URL-encoded (e.g., NSE_EQ|INE002A01018 -> NSE_EQ%7CINE002A01018)
  const encodedKey = encodeURIComponent(instrumentKey);

  // Upstox URL format: /historical-candle/{instrument_key}/{interval}/{to_date}/{from_date}
  const url = `${UPSTOX_HISTORICAL_BASE}/${encodedKey}/${interval}/${toDate}/${fromDate}`;

  const response = await upstoxClient.fetchWithAuth(url);
  const data: UpstoxHistoricalResponse = await response.json();

  if (data.status !== 'success' || !data.data?.candles) {
    throw new Error(
      `Failed to fetch candles for ${instrumentKey}: ${JSON.stringify(data)}`
    );
  }

  // Transform array format [timestamp, open, high, low, close, volume, oi] into CandleData
  const candles: CandleData[] = data.data.candles.map((candle) => ({
    timestamp: new Date(candle[0]),
    open: candle[1],
    high: candle[2],
    low: candle[3],
    close: candle[4],
    volume: candle[5],
  }));

  // Sort ascending by timestamp (Upstox returns descending)
  candles.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return candles;
}

/**
 * Fetch today's intraday candle from the Upstox intraday API.
 * This is a PUBLIC endpoint — no auth required.
 *
 * @param instrumentKey - The instrument key (e.g., "NSE_EQ|INE002A01018")
 * @param interval - Candle interval: "day", "1minute", "30minute"
 * @returns Today's candle or null if not available
 */
export async function fetchIntradayCandle(
  instrumentKey: string,
  interval: string = 'day'
): Promise<CandleData | null> {
  try {
    const encodedKey = encodeURIComponent(instrumentKey);
    const url = `${UPSTOX_INTRADAY_BASE}/${encodedKey}/${interval}`;

    // Intraday historical candle is a PUBLIC endpoint — use direct fetch, no auth needed
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn(`[Intraday] API returned ${response.status} for ${instrumentKey}`);
      return null;
    }

    const data: UpstoxHistoricalResponse = await response.json();

    if (data.status !== 'success' || !data.data?.candles || data.data.candles.length === 0) {
      console.warn(`[Intraday] No candles returned for ${instrumentKey}`, data.status);
      return null;
    }

    // For day interval, there's typically one candle representing today's session
    const candle = data.data.candles[0]; // Most recent first
    return {
      timestamp: new Date(candle[0]),
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5],
    };
  } catch (error) {
    console.error(`[Intraday] Failed to fetch for ${instrumentKey}:`, error);
    return null;
  }
}

/**
 * Fetch real-time Last Traded Price from Upstox Market Quote API.
 * This endpoint REQUIRES authentication.
 *
 * @param instrumentKey - The instrument key (e.g., "NSE_EQ|INE002A01018")
 * @returns Object with ltp and ohlc, or null if unavailable
 */
export async function fetchMarketQuote(
  instrumentKey: string
): Promise<{ ltp: number; open: number; high: number; low: number; close: number; volume: number } | null> {
  try {
    const encodedKey = encodeURIComponent(instrumentKey);
    const url = `${UPSTOX_MARKET_QUOTE_BASE}/quotes?instrument_key=${encodedKey}`;

    const response = await upstoxClient.fetchWithAuth(url);
    const data = await response.json();

    if (data.status !== 'success' || !data.data) {
      console.warn(`[MarketQuote] Unexpected response for ${instrumentKey}:`, data.status);
      return null;
    }

    // Upstox returns data keyed by instrument key
    const quoteData = Object.values(data.data)[0] as {
      last_price: number;
      ohlc: { open: number; high: number; low: number; close: number };
      volume: number;
    } | undefined;

    if (!quoteData) {
      console.warn(`[MarketQuote] No quote data found for ${instrumentKey}`);
      return null;
    }

    return {
      ltp: quoteData.last_price,
      open: quoteData.ohlc.open,
      high: quoteData.ohlc.high,
      low: quoteData.ohlc.low,
      close: quoteData.last_price, // Use LTP as "close" for today's candle
      volume: quoteData.volume ?? 0,
    };
  } catch (error) {
    console.error(`[MarketQuote] Failed to fetch for ${instrumentKey}:`, error);
    return null;
  }
}

/**
 * Get today's live candle data. Tries market quote first (most reliable),
 * then falls back to intraday candle endpoint.
 */
export async function fetchTodayCandle(
  instrumentKey: string
): Promise<CandleData | null> {
  // Strategy 1: Market quote API (authenticated, most reliable for current price)
  const quote = await fetchMarketQuote(instrumentKey);
  if (quote && quote.ltp > 0) {
    console.log(`[LivePrice] Got market quote for ${instrumentKey}: LTP=${quote.ltp}`);
    return {
      timestamp: startOfDay(new Date()),
      open: quote.open > 0 ? quote.open : quote.ltp,
      high: quote.high > 0 ? quote.high : quote.ltp,
      low: quote.low > 0 ? quote.low : quote.ltp,
      close: quote.ltp,
      volume: quote.volume,
    };
  }

  // Strategy 2: Intraday candle endpoint (public, no auth needed)
  const intraday = await fetchIntradayCandle(instrumentKey, 'day');
  if (intraday) {
    console.log(`[LivePrice] Got intraday candle for ${instrumentKey}: close=${intraday.close}`);
    return intraday;
  }

  // Strategy 3: Try intraday with 1minute interval and build today's candle
  const minuteCandle = await fetchIntradayCandle(instrumentKey, '1minute');
  if (minuteCandle) {
    console.log(`[LivePrice] Got 1min intraday for ${instrumentKey}: close=${minuteCandle.close}`);
    return {
      timestamp: startOfDay(new Date()),
      open: minuteCandle.open,
      high: minuteCandle.high,
      low: minuteCandle.low,
      close: minuteCandle.close,
      volume: minuteCandle.volume,
    };
  }

  console.warn(`[LivePrice] All strategies failed for ${instrumentKey}`);
  return null;
}

/**
 * Fetch candles with caching support.
 * Checks the CachedCandle table first; if cached data exists for today, returns it.
 * Otherwise fetches from API, stores in cache, and returns.
 * Always appends today's live candle when available.
 *
 * @param instrumentId - The Prisma Instrument id
 * @param instrumentKey - The Upstox instrument key (e.g., "NSE_EQ|INE002A01018")
 * @param interval - Candle interval: "day", "1minute", "30minute", etc.
 * @param days - Number of days of historical data to fetch
 * @returns Array of CandleData sorted by timestamp ascending
 */
export async function fetchAndCacheCandles(
  instrumentId: string,
  instrumentKey: string,
  interval: string,
  days: number
): Promise<CandleData[]> {
  const today = startOfDay(new Date());

  // Check if we have cached candles fetched today
  const cachedCount = await prisma.cachedCandle.count({
    where: {
      instrumentId,
      interval,
      fetchedAt: {
        gte: today,
      },
    },
  });

  let historicalCandles: CandleData[];

  if (cachedCount > 0) {
    // Return cached data
    const cachedCandles = await prisma.cachedCandle.findMany({
      where: {
        instrumentId,
        interval,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    historicalCandles = cachedCandles.map((candle) => ({
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));
  } else {
    // Fetch from Upstox API
    const toDate = format(new Date(), 'yyyy-MM-dd');
    const fromDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

    historicalCandles = await fetchHistoricalCandles(
      instrumentKey,
      interval,
      fromDate,
      toDate
    );

    // Delete old cached candles for this instrument + interval, then insert fresh data
    await prisma.cachedCandle.deleteMany({
      where: {
        instrumentId,
        interval,
      },
    });

    if (historicalCandles.length > 0) {
      // Batch insert candles
      await prisma.cachedCandle.createMany({
        data: historicalCandles.map((candle) => ({
          instrumentId,
          interval,
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          oi: 0,
        })),
      });
    }
  }

  // Fetch today's live candle and append it
  // The historical endpoint only returns completed candles (up to yesterday)
  if (interval === 'day') {
    const todayCandle = await fetchTodayCandle(instrumentKey);
    if (todayCandle) {
      const lastCandle = historicalCandles[historicalCandles.length - 1];
      const todayAlreadyExists = lastCandle && isSameDay(lastCandle.timestamp, todayCandle.timestamp);

      if (todayAlreadyExists) {
        // Replace the last candle with fresh live data
        historicalCandles[historicalCandles.length - 1] = todayCandle;
      } else {
        historicalCandles.push(todayCandle);
      }
    }
  }

  return historicalCandles;
}
