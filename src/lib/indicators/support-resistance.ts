/**
 * Support and Resistance level detection.
 *
 * Identifies pivot highs/lows from price action, then clusters them
 * into meaningful support and resistance zones.
 *
 * Pure mathematical implementation with no external dependencies.
 */

import type { CandleData } from '@/types/stock';

/**
 * A pivot point consisting of its index in the candle array and its price.
 */
export interface PivotPoint {
  index: number;
  price: number;
}

/**
 * Find local pivot highs (swing highs).
 *
 * A candle at index `i` is a pivot high when its high is strictly greater than
 * or equal to the highs of `leftBars` candles to its left AND `rightBars`
 * candles to its right.
 *
 * @param candles   - Array of OHLCV candle data.
 * @param leftBars  - Number of bars to the left to confirm the pivot (default 5).
 * @param rightBars - Number of bars to the right to confirm the pivot (default 5).
 * @returns Array of pivot high points.
 */
export function findPivotHighs(
  candles: CandleData[],
  leftBars: number = 5,
  rightBars: number = 5,
): PivotPoint[] {
  const pivots: PivotPoint[] = [];

  if (candles.length < leftBars + rightBars + 1) {
    return pivots;
  }

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const candidateHigh = candles[i].high;
    let isPivot = true;

    // Check left side.
    for (let j = i - leftBars; j < i; j++) {
      if (candles[j].high >= candidateHigh) {
        isPivot = false;
        break;
      }
    }

    if (!isPivot) continue;

    // Check right side.
    for (let j = i + 1; j <= i + rightBars; j++) {
      if (candles[j].high >= candidateHigh) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      pivots.push({ index: i, price: candidateHigh });
    }
  }

  return pivots;
}

/**
 * Find local pivot lows (swing lows).
 *
 * A candle at index `i` is a pivot low when its low is strictly less than
 * or equal to the lows of `leftBars` candles to its left AND `rightBars`
 * candles to its right.
 *
 * @param candles   - Array of OHLCV candle data.
 * @param leftBars  - Number of bars to the left to confirm the pivot (default 5).
 * @param rightBars - Number of bars to the right to confirm the pivot (default 5).
 * @returns Array of pivot low points.
 */
export function findPivotLows(
  candles: CandleData[],
  leftBars: number = 5,
  rightBars: number = 5,
): PivotPoint[] {
  const pivots: PivotPoint[] = [];

  if (candles.length < leftBars + rightBars + 1) {
    return pivots;
  }

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const candidateLow = candles[i].low;
    let isPivot = true;

    // Check left side.
    for (let j = i - leftBars; j < i; j++) {
      if (candles[j].low <= candidateLow) {
        isPivot = false;
        break;
      }
    }

    if (!isPivot) continue;

    // Check right side.
    for (let j = i + 1; j <= i + rightBars; j++) {
      if (candles[j].low <= candidateLow) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      pivots.push({ index: i, price: candidateLow });
    }
  }

  return pivots;
}

/**
 * Cluster an array of price levels into groups within a tolerance percentage.
 *
 * Levels within `tolerance` percent of each other are merged into a single
 * representative level (the average of the cluster). The returned levels are
 * sorted by the number of constituent pivots (strongest first).
 *
 * @param pivots    - Array of pivot points to cluster.
 * @param tolerance - Maximum percentage difference to consider two levels
 *                    as belonging to the same cluster (default 0.015 = 1.5%).
 * @returns Sorted array of representative price levels (strongest first).
 */
function clusterLevels(pivots: PivotPoint[], tolerance: number): number[] {
  if (pivots.length === 0) {
    return [];
  }

  // Sort pivots by price for clustering.
  const sorted = [...pivots].sort((a, b) => a.price - b.price);

  // Group pivots within tolerance of each other.
  const clusters: number[][] = [];
  let currentCluster: number[] = [sorted[0].price];

  for (let i = 1; i < sorted.length; i++) {
    const clusterAvg =
      currentCluster.reduce((sum, p) => sum + p, 0) / currentCluster.length;

    // Check if this pivot is close enough to the running cluster average.
    const diff = Math.abs(sorted[i].price - clusterAvg) / clusterAvg;

    if (diff <= tolerance) {
      currentCluster.push(sorted[i].price);
    } else {
      clusters.push(currentCluster);
      currentCluster = [sorted[i].price];
    }
  }
  clusters.push(currentCluster);

  // Sort clusters by size (most pivots = strongest level) descending.
  clusters.sort((a, b) => b.length - a.length);

  // Return the average price of each cluster as the representative level.
  return clusters.map(
    (cluster) => cluster.reduce((sum, p) => sum + p, 0) / cluster.length,
  );
}

/**
 * Find support levels from candle data.
 *
 * Support levels are derived by detecting pivot lows and clustering them
 * within the given tolerance.
 *
 * @param candles   - Array of OHLCV candle data.
 * @param tolerance - Percentage tolerance for clustering (default 0.015 = 1.5%).
 * @returns Array of support price levels, sorted strongest first.
 */
export function findSupportLevels(
  candles: CandleData[],
  tolerance: number = 0.015,
): number[] {
  const pivotLows = findPivotLows(candles);
  return clusterLevels(pivotLows, tolerance);
}

/**
 * Find resistance levels from candle data.
 *
 * Resistance levels are derived by detecting pivot highs and clustering them
 * within the given tolerance.
 *
 * @param candles   - Array of OHLCV candle data.
 * @param tolerance - Percentage tolerance for clustering (default 0.015 = 1.5%).
 * @returns Array of resistance price levels, sorted strongest first.
 */
export function findResistanceLevels(
  candles: CandleData[],
  tolerance: number = 0.015,
): number[] {
  const pivotHighs = findPivotHighs(candles);
  return clusterLevels(pivotHighs, tolerance);
}
