/**
 * Shared helper functions for all candlestick pattern detectors.
 * Eliminates duplication across engulfing.ts, stars.ts, soldiers-crows.ts, etc.
 */

import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternCategory,
  PatternDirection,
  PatternTier,
  ConfluenceDetails,
} from '@/types/pattern';

// ---------------------------------------------------------------------------
// Candle geometry helpers
// ---------------------------------------------------------------------------

/** Absolute body size of a candle. */
export function bodySize(c: CandleData): number {
  return Math.abs(c.close - c.open);
}

/** Full range (high - low) of a candle. */
export function candleRange(c: CandleData): number {
  return c.high - c.low;
}

/** True when the candle closed lower than it opened. */
export function isBearish(c: CandleData): boolean {
  return c.close < c.open;
}

/** True when the candle closed higher than it opened. */
export function isBullish(c: CandleData): boolean {
  return c.close > c.open;
}

/** Upper shadow length (wick above the body). */
export function upperShadow(c: CandleData): number {
  return c.high - Math.max(c.open, c.close);
}

/** Lower shadow length (wick below the body). */
export function lowerShadow(c: CandleData): number {
  return Math.min(c.open, c.close) - c.low;
}

/** The midpoint of a candle's body (average of open and close). */
export function bodyMidpoint(c: CandleData): number {
  return (c.open + c.close) / 2;
}

/** Return the last element of an array (or `undefined`). */
export function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

// ---------------------------------------------------------------------------
// Trend detection
// ---------------------------------------------------------------------------

/**
 * Check whether the last `lookback` candles form a downtrend.
 * 60% of candles must close lower than the previous one.
 */
export function isDowntrend(candles: CandleData[], lookback: number): boolean {
  if (candles.length < lookback + 1) return false;
  const segment = candles.slice(-(lookback + 1));
  let downCount = 0;
  for (let i = 1; i < segment.length; i++) {
    if (segment[i].close < segment[i - 1].close) downCount++;
  }
  return downCount >= Math.ceil(lookback * 0.6);
}

/**
 * Check whether the last `lookback` candles form an uptrend.
 */
export function isUptrend(candles: CandleData[], lookback: number): boolean {
  if (candles.length < lookback + 1) return false;
  const segment = candles.slice(-(lookback + 1));
  let upCount = 0;
  for (let i = 1; i < segment.length; i++) {
    if (segment[i].close > segment[i - 1].close) upCount++;
  }
  return upCount >= Math.ceil(lookback * 0.6);
}

// ---------------------------------------------------------------------------
// Confirmation factors
// ---------------------------------------------------------------------------

/**
 * Compute the volume-confirmation factor from the latest volumeRatio value.
 * Returns a score 0..1. A ratio >= 2.0 = perfect, >= 1.0 = moderate.
 */
export function volumeConfirmation(indicators: IndicatorData): number {
  const vr = last(indicators.volumeRatios);
  if (vr === undefined) return 0.5;
  if (vr >= 2.0) return 1.0;
  if (vr >= 1.0) return 0.5 + (vr - 1.0) * 0.5;
  return Math.max(0.1, vr * 0.5);
}

/**
 * Check if volume passes the hard 1.5x filter for reversal patterns.
 * Returns true if volume ratio >= 1.5 (confirmed) or false (reject).
 */
export function passesVolumeFilter(indicators: IndicatorData): boolean {
  const vr = last(indicators.volumeRatios);
  if (vr === undefined) return false;
  return vr >= 1.5;
}

/**
 * RSI-based trend-context factor.
 * For bullish patterns an oversold RSI is better confirmation.
 * For bearish patterns an overbought RSI is better.
 */
export function rsiContext(indicators: IndicatorData, direction: 'bullish' | 'bearish'): number {
  const rsi = last(indicators.rsi);
  if (rsi === undefined) return 0.5;
  if (direction === 'bullish') {
    if (rsi <= 30) return 1.0;
    if (rsi <= 40) return 0.8;
    if (rsi <= 50) return 0.6;
    return 0.3;
  }
  // bearish
  if (rsi >= 70) return 1.0;
  if (rsi >= 60) return 0.8;
  if (rsi >= 50) return 0.6;
  return 0.3;
}

/**
 * Check if RSI confirms the direction.
 * Bullish: RSI <= 50 (oversold territory)
 * Bearish: RSI >= 50 (overbought territory)
 */
export function rsiConfirms(indicators: IndicatorData, direction: 'bullish' | 'bearish'): boolean {
  const rsi = last(indicators.rsi);
  if (rsi === undefined) return false;
  if (direction === 'bullish') return rsi <= 50;
  return rsi >= 50;
}

// ---------------------------------------------------------------------------
// Key level proximity
// ---------------------------------------------------------------------------

/**
 * Check if current price is near a key support/resistance level.
 * Returns true if within 2% of any S/R level.
 */
export function isAtKeyLevel(price: number, indicators: IndicatorData): boolean {
  const tolerance = 0.02; // 2%
  const allLevels = [...indicators.supportLevels, ...indicators.resistanceLevels];

  for (const level of allLevels) {
    if (level === 0) continue;
    const diff = Math.abs(price - level) / level;
    if (diff <= tolerance) return true;
  }

  // Also check Fibonacci levels
  for (const fib of indicators.fibonacciLevels) {
    if (fib.price === 0) continue;
    const diff = Math.abs(price - fib.price) / fib.price;
    if (diff <= tolerance) return true;
  }

  return false;
}

/**
 * Check if weekly trend aligns with the pattern direction.
 */
export function weeklyTrendAligns(indicators: IndicatorData, direction: 'bullish' | 'bearish'): boolean {
  if (direction === 'bullish') return indicators.weeklyTrend === 'bullish';
  if (direction === 'bearish') return indicators.weeklyTrend === 'bearish';
  return false;
}

// ---------------------------------------------------------------------------
// Confluence scoring (5-point checklist)
// ---------------------------------------------------------------------------

/**
 * Build the 5-point confluence score:
 * 1. Daily pattern detected (+1)
 * 2. Volume >= 1.5x average (+1)
 * 3. At key support/resistance or Fibonacci level (+1)
 * 4. Weekly trend agrees (+1)
 * 5. RSI confirms oversold/overbought (+1)
 *
 * Returns the score (0-5) and details.
 */
export function computeConfluence(
  price: number,
  direction: 'bullish' | 'bearish',
  indicators: IndicatorData,
): { score: number; details: ConfluenceDetails } {
  const details: ConfluenceDetails = {
    dailyPattern: true, // always true since pattern was detected
    volumeConfirmed: passesVolumeFilter(indicators),
    atKeyLevel: isAtKeyLevel(price, indicators),
    weeklyTrendAligned: weeklyTrendAligns(indicators, direction),
    rsiConfirmed: rsiConfirms(indicators, direction),
  };

  const score = [
    details.dailyPattern,
    details.volumeConfirmed,
    details.atKeyLevel,
    details.weeklyTrendAligned,
    details.rsiConfirmed,
  ].filter(Boolean).length;

  return { score, details };
}

// ---------------------------------------------------------------------------
// Result builders
// ---------------------------------------------------------------------------

/** Build a "not detected" result template. */
export function noDetection(
  patternName: string,
  direction: PatternDirection,
  tier: PatternTier = 1,
): PatternResult {
  return {
    detected: false,
    patternName,
    category: 'candlestick' as PatternCategory,
    direction,
    tier,
    signalStrength: 0,
    confidence: 0,
    entryPrice: null,
    stopLoss: null,
    target1: null,
    target2: null,
    riskRewardRatio: null,
    confluenceScore: 0,
    confluenceDetails: {
      dailyPattern: false,
      volumeConfirmed: false,
      atKeyLevel: false,
      weeklyTrendAligned: false,
      rsiConfirmed: false,
    },
    patternData: {},
  };
}

/**
 * Compute final signal strength incorporating the confluence score.
 *
 * Uses a multiplicative approach so signals spread across 30-95% rather
 * than bunching at 100%. Only exceptional setups (high base + full
 * confluence) approach the 95% cap.
 *
 * Confluence multiplier:
 *   5/5 → ×1.08,  4/5 → ×1.05,  3/5 → ×1.02,
 *   2/5 → ×0.95,  1/5 → ×0.85,  0/5 → ×0.75
 *
 * Tier penalties further reduce unreliable patterns without confluence.
 */
export function computeFinalSignalStrength(
  baseStrength: number,
  confluenceScore: number,
  tier: PatternTier,
): number {
  let strength = baseStrength;

  // Multiplicative confluence adjustment (not additive — prevents bunching at 100%)
  if (confluenceScore >= 5) {
    strength *= 1.08;
  } else if (confluenceScore === 4) {
    strength *= 1.05;
  } else if (confluenceScore === 3) {
    strength *= 1.02;
  } else if (confluenceScore === 2) {
    strength *= 0.95;
  } else if (confluenceScore === 1) {
    strength *= 0.85;
  } else {
    strength *= 0.75;
  }

  // Tier 2 penalty if confluence < 3 (these patterns need confirmation)
  if (tier === 2 && confluenceScore < 3) {
    strength *= 0.80;
  }

  // Tier 3 patterns get a stronger penalty
  if (tier === 3 && confluenceScore < 3) {
    strength *= 0.65;
  }

  // Cap at 95% — no signal should ever read 100% (leaves room for trader judgment)
  return Math.max(0, Math.min(0.95, strength));
}
