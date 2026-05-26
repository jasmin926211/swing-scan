/**
 * ATR (Average True Range) calculator.
 *
 * True Range captures the full range of price movement including gaps.
 * ATR is the smoothed average of True Range over a given period.
 *
 * Pure mathematical implementation with no external dependencies.
 */

import type { CandleData } from '@/types/stock';

/**
 * Compute the True Range for each candle.
 *
 * True Range = max(
 *   high - low,
 *   |high - previousClose|,
 *   |low  - previousClose|
 * )
 *
 * The first candle's True Range is simply high - low (no previous close).
 *
 * @param candles - Array of OHLCV candle data.
 * @returns Array of True Range values, same length as input.
 */
function calculateTrueRange(candles: CandleData[]): number[] {
  const tr: number[] = [];

  if (candles.length === 0) {
    return tr;
  }

  // First candle — no previous close available.
  tr.push(candles[0].high - candles[0].low);

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const range1 = high - low;
    const range2 = Math.abs(high - prevClose);
    const range3 = Math.abs(low - prevClose);

    tr.push(Math.max(range1, range2, range3));
  }

  return tr;
}

/**
 * Calculate the Average True Range for an array of candle data.
 *
 * The first ATR value is the SMA of the first `period` True Range values.
 * Subsequent values use Wilder's smoothing:
 *   ATR_t = (ATR_{t-1} * (period - 1) + TR_t) / period
 *
 * @param candles - Array of OHLCV candle data.
 * @param period  - Look-back period (default 14).
 * @returns Array of same length as input. Indices before the first full window are NaN.
 */
export function calculateATR(candles: CandleData[], period: number = 14): number[] {
  const result: number[] = new Array(candles.length).fill(NaN);

  if (candles.length < period || period <= 0) {
    return result;
  }

  const tr = calculateTrueRange(candles);

  // Seed with SMA of first `period` True Range values.
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }

  let atr = sum / period;
  result[period - 1] = atr;

  // Wilder's smoothing for the rest.
  for (let i = period; i < candles.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    result[i] = atr;
  }

  return result;
}
