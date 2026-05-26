/**
 * Fibonacci retracement level calculator.
 *
 * Identifies the most recent significant swing high and swing low,
 * then calculates Fibonacci retracement levels between them.
 *
 * Key levels: 23.6%, 38.2%, 50.0%, 61.8%, 78.6%
 * The 61.8% level is the most important for confluence detection.
 */

import type { CandleData, FibonacciLevel } from '@/types/stock';

/**
 * Calculate Fibonacci retracement levels from recent price action.
 *
 * Looks back over the specified number of candles to find the
 * highest high and lowest low, then computes retracement levels.
 *
 * For an upswing (low before high): retracements are measured downward from the high.
 * For a downswing (high before low): retracements are measured upward from the low.
 *
 * @param candles  - Array of OHLCV candle data, oldest first.
 * @param lookback - Number of recent candles to analyze (default 50).
 * @returns Array of Fibonacci levels with price, ratio, and label.
 */
export function calculateFibonacciLevels(
  candles: CandleData[],
  lookback: number = 50,
): FibonacciLevel[] {
  if (candles.length < 10) return [];

  const startIdx = Math.max(0, candles.length - lookback);
  const segment = candles.slice(startIdx);

  // Find the highest high and lowest low in the segment
  let highestIdx = 0;
  let lowestIdx = 0;
  let highestPrice = -Infinity;
  let lowestPrice = Infinity;

  for (let i = 0; i < segment.length; i++) {
    if (segment[i].high > highestPrice) {
      highestPrice = segment[i].high;
      highestIdx = i;
    }
    if (segment[i].low < lowestPrice) {
      lowestPrice = segment[i].low;
      lowestIdx = i;
    }
  }

  if (highestPrice === lowestPrice) return [];

  const range = highestPrice - lowestPrice;
  const ratios = [0.236, 0.382, 0.5, 0.618, 0.786];
  const labels = ['23.6%', '38.2%', '50.0%', '61.8%', '78.6%'];

  const levels: FibonacciLevel[] = [];

  if (lowestIdx < highestIdx) {
    // Upswing: retracements are measured downward from the high
    for (let i = 0; i < ratios.length; i++) {
      levels.push({
        ratio: ratios[i],
        price: highestPrice - range * ratios[i],
        label: labels[i],
      });
    }
  } else {
    // Downswing: retracements are measured upward from the low
    for (let i = 0; i < ratios.length; i++) {
      levels.push({
        ratio: ratios[i],
        price: lowestPrice + range * ratios[i],
        label: labels[i],
      });
    }
  }

  return levels;
}
