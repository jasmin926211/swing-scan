/**
 * Weekly trend detection from daily candle data.
 *
 * Since the scanner only has daily candles, we synthesize a weekly view
 * by aggregating daily candles into weekly bars and computing EMAs on them.
 *
 * Weekly trend rules:
 * - Bullish: price above weekly EMA20 AND weekly EMA20 > weekly EMA50
 * - Bearish: price below weekly EMA20 AND weekly EMA20 < weekly EMA50
 * - Neutral: mixed signals
 */

import type { CandleData, WeeklyTrend } from '@/types/stock';

/**
 * Aggregate daily candles into weekly candles.
 * Groups by ISO week (Monday-Friday). Partial weeks at the end are included.
 */
function aggregateToWeekly(dailyCandles: CandleData[]): CandleData[] {
  if (dailyCandles.length === 0) return [];

  const weeklyCandles: CandleData[] = [];
  let weekStart: CandleData | null = null;
  let weekHigh = -Infinity;
  let weekLow = Infinity;
  let weekVolume = 0;
  let weekClose = 0;
  let lastWeekNum = -1;

  for (const candle of dailyCandles) {
    const date = new Date(candle.timestamp);
    // Get ISO week number
    const dayOfYear = Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
    );
    const weekNum = Math.ceil((dayOfYear + new Date(date.getFullYear(), 0, 1).getDay()) / 7);

    const yearWeek = date.getFullYear() * 100 + weekNum;

    if (yearWeek !== lastWeekNum && weekStart !== null) {
      // Close the previous week
      weeklyCandles.push({
        timestamp: weekStart.timestamp,
        open: weekStart.open,
        high: weekHigh,
        low: weekLow,
        close: weekClose,
        volume: weekVolume,
      });
      weekStart = null;
    }

    if (weekStart === null) {
      weekStart = candle;
      weekHigh = candle.high;
      weekLow = candle.low;
      weekVolume = candle.volume;
    } else {
      weekHigh = Math.max(weekHigh, candle.high);
      weekLow = Math.min(weekLow, candle.low);
      weekVolume += candle.volume;
    }
    weekClose = candle.close;
    lastWeekNum = yearWeek;
  }

  // Close the last week
  if (weekStart !== null) {
    weeklyCandles.push({
      timestamp: weekStart.timestamp,
      open: weekStart.open,
      high: weekHigh,
      low: weekLow,
      close: weekClose,
      volume: weekVolume,
    });
  }

  return weeklyCandles;
}

/**
 * Simple EMA calculation for weekly data (smaller arrays).
 */
function weeklyEMA(prices: number[], period: number): number[] {
  const result: number[] = new Array(prices.length).fill(NaN);
  if (prices.length < period) return result;

  const multiplier = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i];
  let ema = sum / period;
  result[period - 1] = ema;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
    result[i] = ema;
  }
  return result;
}

/**
 * Determine the weekly trend from daily candle data.
 *
 * Aggregates daily candles to weekly bars, then checks:
 * - Weekly EMA 10 vs EMA 20 (approximates weekly 20/50 for ~200 daily candles)
 * - Current price relative to weekly EMAs
 *
 * @param dailyCandles - Array of daily OHLCV candles (ideally 200 days).
 * @returns 'bullish', 'bearish', or 'neutral'.
 */
export function detectWeeklyTrend(dailyCandles: CandleData[]): WeeklyTrend {
  if (dailyCandles.length < 50) return 'neutral';

  const weeklyCandles = aggregateToWeekly(dailyCandles);
  if (weeklyCandles.length < 12) return 'neutral';

  const weeklyCloses = weeklyCandles.map(c => c.close);
  const ema10 = weeklyEMA(weeklyCloses, 10); // ~50-day equivalent
  const ema20 = weeklyEMA(weeklyCloses, 20); // ~100-day equivalent

  const lastIdx = weeklyCloses.length - 1;
  const lastClose = weeklyCloses[lastIdx];
  const lastEma10 = ema10[lastIdx];
  const lastEma20 = ema20[lastIdx];

  if (isNaN(lastEma10) || isNaN(lastEma20)) return 'neutral';

  // Bullish: price above both EMAs and short EMA above long EMA
  if (lastClose > lastEma10 && lastEma10 > lastEma20) {
    return 'bullish';
  }

  // Bearish: price below both EMAs and short EMA below long EMA
  if (lastClose < lastEma10 && lastEma10 < lastEma20) {
    return 'bearish';
  }

  return 'neutral';
}
