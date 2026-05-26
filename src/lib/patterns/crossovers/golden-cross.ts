import { CandleData, IndicatorData } from '@/types/stock';
import { PatternDetector, PatternResult, PatternDirection } from '@/types/pattern';
import { computeSignalStrength, calculateRiskReward, findPivotLows, findPivotHighs } from '../utils';

/**
 * Creates a no-detection result for a given pattern name.
 */
function noDetection(patternName: string): PatternResult {
  return {
    detected: false,
    patternName,
    category: 'crossover',
    direction: 'neutral',
    signalStrength: 0,
    confidence: 0,
    entryPrice: null,
    stopLoss: null,
    target1: null,
    target2: null,
    riskRewardRatio: null,
    patternData: {},
  };
}

/**
 * Finds the most recent swing low within the last `lookback` candles.
 * Used to set stop loss for a Golden Cross (long) entry.
 */
function recentSwingLow(candles: CandleData[], lookback: number): number {
  const startIdx = Math.max(0, candles.length - lookback);
  let minLow = Infinity;
  for (let i = startIdx; i < candles.length; i++) {
    if (candles[i].low < minLow) {
      minLow = candles[i].low;
    }
  }
  return minLow;
}

/**
 * Finds the most recent swing high within the last `lookback` candles.
 * Used to set stop loss for a Death Cross (short) entry.
 */
function recentSwingHigh(candles: CandleData[], lookback: number): number {
  const startIdx = Math.max(0, candles.length - lookback);
  let maxHigh = -Infinity;
  for (let i = startIdx; i < candles.length; i++) {
    if (candles[i].high > maxHigh) {
      maxHigh = candles[i].high;
    }
  }
  return maxHigh;
}

/**
 * Golden Cross / Death Cross detector.
 *
 * Golden Cross: EMA50 crosses above EMA200 -- a major bullish trend signal.
 * Death Cross:  EMA50 crosses below EMA200 -- a major bearish trend signal.
 *
 * We use EMA50 and EMA200 from the indicator data as the proxy for the
 * traditional 50-SMA and 200-SMA. In practice, the crossover behavior
 * is extremely similar and EMAs respond faster, making them arguably
 * better for shorter swing-trade time frames (5-7 days).
 *
 * Detection window: we scan the last 5 trading days for the crossover.
 *
 * Signal strength is based on:
 *   - EMA divergence after the crossover (steeper separation = stronger)
 *   - Volume confirmation on/around the crossover bar
 *   - RSI confirmation (momentum aligned with the cross direction)
 *   - Price position relative to the EMA200 (confirming trend commitment)
 *
 * Trade levels:
 *   Entry:  current close
 *   SL:     recent swing low (golden cross) or swing high (death cross)
 *   Target1: 2x ATR from entry
 *   Target2: based on recent resistance (golden) or support (death),
 *            falling back to 3x ATR if no clear pivot is found
 */
export const goldenCross: PatternDetector = {
  name: 'golden_cross',
  category: 'crossover',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    return detectGoldenDeathCross('golden_cross', 'bullish', candles, indicators);
  },
};

export const deathCross: PatternDetector = {
  name: 'death_cross',
  category: 'crossover',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    return detectGoldenDeathCross('death_cross', 'bearish', candles, indicators);
  },
};

/**
 * Core detection logic shared between golden cross and death cross.
 */
function detectGoldenDeathCross(
  patternName: string,
  expectedDirection: PatternDirection,
  candles: CandleData[],
  indicators: IndicatorData
): PatternResult {
  const len = candles.length;
  const ema50 = indicators.ema50;
  const ema200 = indicators.ema200;

  // Need sufficient data
  if (len < 5 || ema50.length < 6 || ema200.length < 6) {
    return noDetection(patternName);
  }

  const e50Len = ema50.length;
  const e200Len = ema200.length;

  // Scan the last 5 bars for a crossover
  let crossoverIdx = -1; // how many bars ago the crossover occurred (1 = most recent)

  for (let offset = 1; offset <= 5; offset++) {
    const i50 = e50Len - offset;
    const i200 = e200Len - offset;
    const i50Prev = i50 - 1;
    const i200Prev = i200 - 1;

    if (i50Prev < 0 || i200Prev < 0) continue;

    const ema50Now = ema50[i50];
    const ema200Now = ema200[i200];
    const ema50Prev = ema50[i50Prev];
    const ema200Prev = ema200[i200Prev];

    if (expectedDirection === 'bullish') {
      // Golden Cross: EMA50 was below/at EMA200, now above
      if (ema50Prev <= ema200Prev && ema50Now > ema200Now) {
        crossoverIdx = offset;
        break;
      }
    } else {
      // Death Cross: EMA50 was above/at EMA200, now below
      if (ema50Prev >= ema200Prev && ema50Now < ema200Now) {
        crossoverIdx = offset;
        break;
      }
    }
  }

  if (crossoverIdx === -1) {
    return noDetection(patternName);
  }

  // ---- Current values ----
  const currentClose = candles[len - 1].close;
  const currentEma50 = ema50[e50Len - 1];
  const currentEma200 = ema200[e200Len - 1];
  const currentAtr = indicators.atr.length > 0
    ? indicators.atr[indicators.atr.length - 1]
    : 0;
  const currentRsi = indicators.rsi.length > 0
    ? indicators.rsi[indicators.rsi.length - 1]
    : 50;

  // ---- Confirmation scores (0 to 1) ----

  // 1. EMA divergence: how far apart EMA50 and EMA200 are now
  const emaDivergencePct = currentEma200 !== 0
    ? Math.abs(currentEma50 - currentEma200) / currentEma200
    : 0;
  // Golden/Death Cross divergences are usually small. Normalize so that
  // 0.5% = 0.5, 1%+ = ~1.0
  const divergenceScore = Math.min(1, emaDivergencePct / 0.01);

  // 2. Volume confirmation around the crossover bar
  const crossoverBarCandle = len - crossoverIdx;
  const avgVolume = indicators.avgVolume > 0 ? indicators.avgVolume : 1;

  // Average volume of the crossover bar and the bar after it
  let volSum = 0;
  let volCount = 0;
  for (let i = crossoverBarCandle; i < len && i <= crossoverBarCandle + 1; i++) {
    if (i >= 0 && i < len) {
      volSum += candles[i].volume;
      volCount++;
    }
  }
  const crossoverAvgVol = volCount > 0 ? volSum / volCount : 0;
  const volumeRatio = crossoverAvgVol / avgVolume;
  const volumeScore = Math.min(1, volumeRatio / 1.5);

  // 3. RSI confirmation
  let rsiScore = 0;
  if (expectedDirection === 'bullish') {
    // For Golden Cross, RSI above 50 but not overbought is ideal
    if (currentRsi >= 50 && currentRsi <= 70) {
      rsiScore = 1.0;
    } else if (currentRsi > 70 && currentRsi <= 80) {
      rsiScore = 0.5;
    } else if (currentRsi >= 40 && currentRsi < 50) {
      rsiScore = 0.4;
    } else {
      rsiScore = 0.2;
    }
  } else {
    // For Death Cross, RSI below 50 but not oversold
    if (currentRsi >= 30 && currentRsi <= 50) {
      rsiScore = 1.0;
    } else if (currentRsi >= 20 && currentRsi < 30) {
      rsiScore = 0.5;
    } else if (currentRsi > 50 && currentRsi <= 60) {
      rsiScore = 0.4;
    } else {
      rsiScore = 0.2;
    }
  }

  // 4. Price position relative to EMA200 (confirms trend commitment)
  let pricePositionScore = 0;
  if (expectedDirection === 'bullish') {
    pricePositionScore = currentClose > currentEma200 ? 1.0 : 0.3;
  } else {
    pricePositionScore = currentClose < currentEma200 ? 1.0 : 0.3;
  }

  // 5. Recency of crossover
  const recencyScore = crossoverIdx <= 2 ? 1.0 : crossoverIdx <= 4 ? 0.7 : 0.5;

  // ---- Confidence & signal strength ----
  const confidence =
    divergenceScore * 0.25 +
    volumeScore * 0.25 +
    rsiScore * 0.15 +
    pricePositionScore * 0.20 +
    recencyScore * 0.15;

  const signalStrength = computeSignalStrength({
    patternConfidence: confidence,
    volumeConfirmation: volumeScore,
    trendAlignment: pricePositionScore,
    proximityToBreakout: recencyScore,
  });

  // ---- Trade levels ----
  const entryPrice = currentClose;
  let stopLoss: number;
  let target1: number;
  let target2: number;

  if (expectedDirection === 'bullish') {
    // Stop loss at recent swing low (last 20 bars) but not above EMA200
    const swingLow = recentSwingLow(candles, 20);
    stopLoss = Math.min(swingLow, currentEma200);
    // If the stop is too close (less than 0.5 ATR), widen it
    if (currentAtr > 0 && Math.abs(entryPrice - stopLoss) < 0.5 * currentAtr) {
      stopLoss = entryPrice - 1.0 * currentAtr;
    }

    target1 = entryPrice + 2 * currentAtr;

    // Target2: try to find a recent resistance level (pivot high above current price)
    const pivotHighs = findPivotHighs(candles, 3, 3);
    const resistance = pivotHighs
      .filter((p) => p.price > currentClose)
      .sort((a, b) => a.price - b.price)[0];
    target2 = resistance ? resistance.price : entryPrice + 3 * currentAtr;
  } else {
    // Death cross: stop loss at recent swing high
    const swingHigh = recentSwingHigh(candles, 20);
    stopLoss = Math.max(swingHigh, currentEma200);
    if (currentAtr > 0 && Math.abs(stopLoss - entryPrice) < 0.5 * currentAtr) {
      stopLoss = entryPrice + 1.0 * currentAtr;
    }

    target1 = entryPrice - 2 * currentAtr;

    // Target2: try to find a recent support level (pivot low below current price)
    const pivotLows = findPivotLows(candles, 3, 3);
    const support = pivotLows
      .filter((p) => p.price < currentClose)
      .sort((a, b) => b.price - a.price)[0];
    target2 = support ? support.price : entryPrice - 3 * currentAtr;
  }

  const riskRewardRatio = calculateRiskReward(entryPrice, stopLoss, target1);

  return {
    detected: true,
    patternName,
    category: 'crossover',
    direction: expectedDirection,
    signalStrength,
    confidence,
    entryPrice,
    stopLoss,
    target1,
    target2,
    riskRewardRatio,
    patternData: {
      crossoverBarsAgo: crossoverIdx,
      ema50Value: currentEma50,
      ema200Value: currentEma200,
      emaDivergencePct: +(emaDivergencePct * 100).toFixed(4),
      volumeRatio: +volumeRatio.toFixed(2),
      rsi: +currentRsi.toFixed(2),
      atr: +currentAtr.toFixed(4),
      priceAboveEma200: currentClose > currentEma200,
    },
  };
}
