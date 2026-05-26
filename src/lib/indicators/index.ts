/**
 * Technical indicators barrel file.
 *
 * Re-exports all individual indicator functions and provides a single
 * `computeAllIndicators` function that builds the complete IndicatorData
 * object from raw candle data.
 */

import type { CandleData, IndicatorData } from '@/types/stock';

// ---- Re-exports ----
export { calculateEMA, calculateSMA } from './ema';
export { calculateRSI } from './rsi';
export { calculateATR } from './atr';
export { calculateAverageVolume, calculateVolumeRatios, isVolumeSurge } from './volume';
export {
  findPivotHighs,
  findPivotLows,
  findSupportLevels,
  findResistanceLevels,
} from './support-resistance';
export type { PivotPoint } from './support-resistance';
export { calculateFibonacciLevels } from './fibonacci';
export { detectWeeklyTrend } from './weekly-trend';

// ---- Internal imports for computeAllIndicators ----
import { calculateEMA } from './ema';
import { calculateRSI } from './rsi';
import { calculateATR } from './atr';
import { calculateAverageVolume, calculateVolumeRatios } from './volume';
import { findSupportLevels, findResistanceLevels } from './support-resistance';
import { calculateFibonacciLevels } from './fibonacci';
import { detectWeeklyTrend } from './weekly-trend';

/**
 * Compute all standard technical indicators for the given candle data.
 *
 * This is a convenience function that builds the full `IndicatorData` object
 * in a single call, including support/resistance levels, Fibonacci retracements,
 * and weekly trend direction for confluence scoring.
 *
 * @param candles - Array of OHLCV candle data, ordered chronologically
 *                  (oldest first).
 * @returns A fully populated `IndicatorData` object.
 */
export function computeAllIndicators(candles: CandleData[]): IndicatorData {
  const closes = candles.map((c) => c.close);

  return {
    ema9: calculateEMA(closes, 9),
    ema21: calculateEMA(closes, 21),
    ema50: calculateEMA(closes, 50),
    ema200: calculateEMA(closes, 200),
    rsi: calculateRSI(closes, 14),
    atr: calculateATR(candles, 14),
    avgVolume: calculateAverageVolume(candles, 20),
    volumeRatios: calculateVolumeRatios(candles, 20),
    closes,
    supportLevels: findSupportLevels(candles),
    resistanceLevels: findResistanceLevels(candles),
    fibonacciLevels: calculateFibonacciLevels(candles),
    weeklyTrend: detectWeeklyTrend(candles),
  };
}
