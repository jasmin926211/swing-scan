/**
 * Volume analysis utilities.
 *
 * Provides average volume calculation, per-candle volume ratios,
 * and volume-surge detection.
 *
 * Pure mathematical implementation with no external dependencies.
 */

import type { CandleData } from '@/types/stock';

/**
 * Calculate the average volume over the most recent `period` candles.
 *
 * If the input contains fewer candles than `period`, the average is computed
 * over all available candles.
 *
 * @param candles - Array of OHLCV candle data.
 * @param period  - Number of recent candles to average (default 20).
 * @returns The average volume as a single number, or 0 if no candles are provided.
 */
export function calculateAverageVolume(candles: CandleData[], period: number = 20): number {
  if (candles.length === 0) {
    return 0;
  }

  const lookback = Math.min(period, candles.length);
  const startIndex = candles.length - lookback;

  let sum = 0;
  for (let i = startIndex; i < candles.length; i++) {
    sum += candles[i].volume;
  }

  return sum / lookback;
}

/**
 * Calculate volume ratios for every candle.
 *
 * Each ratio is the candle's volume divided by the trailing average volume
 * computed over the preceding `period` candles. For candles before a full
 * window is available the average is taken over all prior candles.
 *
 * A ratio > 1 indicates above-average volume; < 1 indicates below-average.
 *
 * @param candles - Array of OHLCV candle data.
 * @param period  - Trailing look-back window for the average (default 20).
 * @returns Array of ratios, same length as input. The first candle always has ratio 1
 *          (no prior data to compare against).
 */
export function calculateVolumeRatios(candles: CandleData[], period: number = 20): number[] {
  const ratios: number[] = new Array(candles.length).fill(0);

  if (candles.length === 0) {
    return ratios;
  }

  // First candle — no history, so ratio is 1.
  ratios[0] = 1;

  for (let i = 1; i < candles.length; i++) {
    // Compute trailing average of the `period` candles before this one.
    const lookbackStart = Math.max(0, i - period);
    const lookbackCount = i - lookbackStart;

    let sum = 0;
    for (let j = lookbackStart; j < i; j++) {
      sum += candles[j].volume;
    }

    const avg = sum / lookbackCount;

    ratios[i] = avg === 0 ? 0 : candles[i].volume / avg;
  }

  return ratios;
}

/**
 * Determine whether a specific candle experienced a volume surge.
 *
 * A surge is detected when the candle's volume exceeds the trailing average
 * volume by a given multiplier (threshold).
 *
 * @param candles   - Array of OHLCV candle data.
 * @param index     - Index of the candle to evaluate.
 * @param threshold - Multiplier above average to qualify as a surge (default 1.5).
 * @returns `true` if the volume at `index` > threshold * trailing average, else `false`.
 */
export function isVolumeSurge(
  candles: CandleData[],
  index: number,
  threshold: number = 1.5,
): boolean {
  if (index < 0 || index >= candles.length || candles.length === 0) {
    return false;
  }

  // Use the candles *before* the target index to compute the average.
  // If index is 0 there is no prior data, so we cannot determine a surge.
  if (index === 0) {
    return false;
  }

  const priorCandles = candles.slice(0, index);
  const avg = calculateAverageVolume(priorCandles, 20);

  if (avg === 0) {
    return false;
  }

  return candles[index].volume > threshold * avg;
}
