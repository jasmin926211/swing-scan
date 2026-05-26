import { CandleData } from '@/types/stock';

/**
 * Performs ordinary least-squares linear regression on a set of (x, y) points.
 * Returns slope, intercept, and the coefficient of determination (R-squared).
 */
export function linearRegression(
  points: { x: number; y: number }[]
): { slope: number; intercept: number; rSquared: number } {
  const n = points.length;
  if (n < 2) {
    return { slope: 0, intercept: points.length === 1 ? points[0].y : 0, rSquared: 0 };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n, rSquared: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared: 1 - (SS_res / SS_tot)
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of points) {
    const predicted = slope * p.x + intercept;
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }

  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared };
}

/**
 * Finds pivot highs: local maxima where high[i] is greater than the high
 * of `leftBars` bars to the left and `rightBars` bars to the right.
 */
export function findPivotHighs(
  candles: CandleData[],
  leftBars: number = 3,
  rightBars: number = 3
): { index: number; price: number }[] {
  const pivots: { index: number; price: number }[] = [];
  const len = candles.length;

  for (let i = leftBars; i < len - rightBars; i++) {
    const currentHigh = candles[i].high;
    let isPivot = true;

    for (let j = 1; j <= leftBars; j++) {
      if (candles[i - j].high >= currentHigh) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      for (let j = 1; j <= rightBars; j++) {
        if (candles[i + j].high >= currentHigh) {
          isPivot = false;
          break;
        }
      }
    }

    if (isPivot) {
      pivots.push({ index: i, price: currentHigh });
    }
  }

  return pivots;
}

/**
 * Finds pivot lows: local minima where low[i] is less than the low
 * of `leftBars` bars to the left and `rightBars` bars to the right.
 */
export function findPivotLows(
  candles: CandleData[],
  leftBars: number = 3,
  rightBars: number = 3
): { index: number; price: number }[] {
  const pivots: { index: number; price: number }[] = [];
  const len = candles.length;

  for (let i = leftBars; i < len - rightBars; i++) {
    const currentLow = candles[i].low;
    let isPivot = true;

    for (let j = 1; j <= leftBars; j++) {
      if (candles[i - j].low <= currentLow) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      for (let j = 1; j <= rightBars; j++) {
        if (candles[i + j].low <= currentLow) {
          isPivot = false;
          break;
        }
      }
    }

    if (isPivot) {
      pivots.push({ index: i, price: currentLow });
    }
  }

  return pivots;
}

/**
 * Checks if two prices are within a tolerance percentage of each other.
 * Default tolerance is 2%.
 */
export function isPriceNear(
  price1: number,
  price2: number,
  tolerancePct: number = 2
): boolean {
  if (price1 === 0 && price2 === 0) return true;
  const avgPrice = (Math.abs(price1) + Math.abs(price2)) / 2;
  if (avgPrice === 0) return false;
  const diff = Math.abs(price1 - price2);
  return (diff / avgPrice) * 100 <= tolerancePct;
}

/**
 * Calculates the slope between two points as percentage change per bar.
 * Positive slope means price is rising; negative means falling.
 */
export function slopeBetween(
  p1: { index: number; price: number },
  p2: { index: number; price: number }
): number {
  const barDiff = p2.index - p1.index;
  if (barDiff === 0 || p1.price === 0) return 0;
  return ((p2.price - p1.price) / p1.price) / barDiff;
}

/**
 * Checks if a slope (percentage per bar) is approximately flat.
 * Default threshold is 0.001 (0.1% per bar).
 */
export function isFlat(slope: number, threshold: number = 0.001): boolean {
  return Math.abs(slope) <= threshold;
}

/**
 * Fits a trendline through pivot points using linear regression.
 * Returns slope, intercept, and R-squared. Returns null if fewer than 2 pivots.
 */
export function fitTrendline(
  pivots: { index: number; price: number }[]
): { slope: number; intercept: number; rSquared: number } | null {
  if (pivots.length < 2) return null;

  const points = pivots.map((p) => ({ x: p.index, y: p.price }));
  return linearRegression(points);
}

/**
 * Calculates the population standard deviation of a numeric array.
 */
export function standardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const squaredDiffs = values.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  return Math.sqrt(squaredDiffs / n);
}

/**
 * Calculates the "tightness" of the price range over a candle slice.
 * Defined as (max high - min low) / average close. Lower values indicate
 * tighter consolidation. Returns a ratio (e.g., 0.05 = 5% range).
 */
export function priceRangeTightness(
  candles: CandleData[],
  startIdx: number,
  endIdx: number
): number {
  if (startIdx < 0 || endIdx >= candles.length || startIdx > endIdx) return Infinity;

  let maxHigh = -Infinity;
  let minLow = Infinity;
  let closeSum = 0;
  let count = 0;

  for (let i = startIdx; i <= endIdx; i++) {
    if (candles[i].high > maxHigh) maxHigh = candles[i].high;
    if (candles[i].low < minLow) minLow = candles[i].low;
    closeSum += candles[i].close;
    count++;
  }

  if (count === 0) return Infinity;
  const avgClose = closeSum / count;
  if (avgClose === 0) return Infinity;

  return (maxHigh - minLow) / avgClose;
}

/**
 * Detects if volume is generally decreasing over the given candle range.
 * Uses linear regression on volume and checks for a negative slope.
 */
export function isVolumeDecreasing(
  candles: CandleData[],
  startIdx: number,
  endIdx: number
): boolean {
  if (startIdx < 0 || endIdx >= candles.length || startIdx >= endIdx) return false;

  const points: { x: number; y: number }[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    points.push({ x: i - startIdx, y: candles[i].volume });
  }

  const reg = linearRegression(points);
  return reg.slope < 0;
}

/**
 * Computes a composite signal strength from multiple confirmation factors.
 * Each factor should be in the 0-1 range.
 *
 * Weights:
 *   patternConfidence: 35%
 *   volumeConfirmation: 25%
 *   trendAlignment: 20%
 *   proximityToBreakout: 20%
 *
 * Returns a value between 0 and 1.
 */
export function computeSignalStrength(params: {
  patternConfidence: number;
  volumeConfirmation: number;
  trendAlignment: number;
  proximityToBreakout: number;
}): number {
  const raw =
    params.patternConfidence * 0.35 +
    params.volumeConfirmation * 0.25 +
    params.trendAlignment * 0.20 +
    params.proximityToBreakout * 0.20;

  // Cap at 0.90 — confluence enrichment in the pattern runner adds further
  // adjustments, so leaving headroom prevents signals from bunching at 100%.
  return Math.max(0, Math.min(0.90, raw));
}

/**
 * Calculates the risk-reward ratio for a trade.
 * risk = |entry - stopLoss|, reward = |target - entry|
 * Returns reward / risk. Returns 0 if risk is zero.
 */
export function calculateRiskReward(
  entry: number,
  stopLoss: number,
  target: number
): number {
  const risk = Math.abs(entry - stopLoss);
  if (risk === 0) return 0;
  const reward = Math.abs(target - entry);
  return reward / risk;
}
