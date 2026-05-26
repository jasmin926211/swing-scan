import { CandleData, IndicatorData } from '@/types/stock';
import { PatternDetector, PatternResult, PatternDirection } from '@/types/pattern';
import { computeSignalStrength, calculateRiskReward } from '../utils';

/**
 * Creates a no-detection result for a given crossover pattern.
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
 * Generic EMA crossover detection logic.
 *
 * Looks at the last 3 bars for a crossover between `fastEma` and `slowEma`.
 * A bullish crossover occurs when the fast EMA crosses above the slow EMA.
 * A bearish crossover occurs when the fast EMA crosses below the slow EMA.
 *
 * Signal strength is derived from:
 *   - Crossover angle (how steeply the EMAs diverge after crossing)
 *   - Volume confirmation on the crossover bar
 *   - RSI confirmation (50-70 for bullish, 30-50 for bearish)
 *
 * Entry: current close price.
 * Stop loss: below the slow EMA for bullish, above the slow EMA for bearish.
 * Target1: entry +/- 2x ATR.
 * Target2: entry +/- 3x ATR.
 */
function detectEmaCrossover(
  patternName: string,
  candles: CandleData[],
  indicators: IndicatorData,
  fastEma: number[],
  slowEma: number[]
): PatternResult {
  const len = candles.length;

  // Need at least 3 bars and matching indicator lengths
  if (len < 3 || fastEma.length < 3 || slowEma.length < 3) {
    return noDetection(patternName);
  }

  // Use the last 3 values from each EMA array (indices aligned with candles end)
  const fLen = fastEma.length;
  const sLen = slowEma.length;

  // We examine the last 3 candle periods for a crossover.
  // Index mapping: the last element in the EMA array corresponds to the last candle.
  // We look at positions -3, -2, -1 (i.e., 3 bars ago, 2 bars ago, most recent).
  let crossoverIdx = -1; // which of the last 3 bars had the crossover
  let direction: PatternDirection = 'neutral';

  for (let offset = 1; offset <= 3; offset++) {
    const fi = fLen - offset;       // current bar index in fastEma
    const si = sLen - offset;       // current bar index in slowEma
    const fiPrev = fi - 1;          // previous bar index in fastEma
    const siPrev = si - 1;          // previous bar index in slowEma

    if (fiPrev < 0 || siPrev < 0) continue;

    const fastNow = fastEma[fi];
    const slowNow = slowEma[si];
    const fastPrev = fastEma[fiPrev];
    const slowPrev = slowEma[siPrev];

    // Bullish crossover: fast was below slow, now fast is above slow
    if (fastPrev <= slowPrev && fastNow > slowNow) {
      crossoverIdx = offset;
      direction = 'bullish';
      break;
    }

    // Bearish crossover: fast was above slow, now fast is below slow
    if (fastPrev >= slowPrev && fastNow < slowNow) {
      crossoverIdx = offset;
      direction = 'bearish';
      break;
    }
  }

  if (crossoverIdx === -1 || direction === 'neutral') {
    return noDetection(patternName);
  }

  // ------- Compute confirmation scores (each 0 to 1) -------

  const currentClose = candles[len - 1].close;
  const currentFast = fastEma[fLen - 1];
  const currentSlow = slowEma[sLen - 1];
  const currentAtr = indicators.atr.length > 0
    ? indicators.atr[indicators.atr.length - 1]
    : 0;
  const currentRsi = indicators.rsi.length > 0
    ? indicators.rsi[indicators.rsi.length - 1]
    : 50;

  // 1. Crossover angle: measure the percentage gap between the EMAs now vs at crossover.
  //    Larger divergence after the cross = stronger signal.
  const emaDivergencePct = currentSlow !== 0
    ? Math.abs(currentFast - currentSlow) / currentSlow
    : 0;
  // Normalize: 0.5% divergence = score 0.5, 1%+ = score ~1.0
  const angleScore = Math.min(1, emaDivergencePct / 0.01);

  // 2. Volume confirmation: crossover bar volume vs average volume.
  const crossoverBarIndex = len - crossoverIdx;
  const crossoverVolume = crossoverBarIndex >= 0 && crossoverBarIndex < len
    ? candles[crossoverBarIndex].volume
    : 0;
  const avgVolume = indicators.avgVolume > 0 ? indicators.avgVolume : 1;
  const volumeRatio = crossoverVolume / avgVolume;
  // Volume >= 1.5x average = full score; below average = partial
  const volumeScore = Math.min(1, volumeRatio / 1.5);

  // 3. RSI confirmation
  //    Bullish: RSI in 50-70 is ideal (above 50 shows momentum, not yet overbought)
  //    Bearish: RSI in 30-50 is ideal (below 50 shows weakness, not yet oversold)
  let rsiScore = 0;
  if (direction === 'bullish') {
    if (currentRsi >= 50 && currentRsi <= 70) {
      rsiScore = 1.0;
    } else if (currentRsi >= 40 && currentRsi < 50) {
      rsiScore = 0.5;
    } else if (currentRsi > 70 && currentRsi <= 80) {
      rsiScore = 0.4;
    } else {
      rsiScore = 0.2;
    }
  } else {
    if (currentRsi >= 30 && currentRsi <= 50) {
      rsiScore = 1.0;
    } else if (currentRsi > 50 && currentRsi <= 60) {
      rsiScore = 0.5;
    } else if (currentRsi >= 20 && currentRsi < 30) {
      rsiScore = 0.4;
    } else {
      rsiScore = 0.2;
    }
  }

  // 4. Recency: more recent crossover = stronger signal
  //    crossoverIdx 1 (most recent bar) = 1.0, 2 = 0.7, 3 = 0.5
  const recencyScore = crossoverIdx === 1 ? 1.0 : crossoverIdx === 2 ? 0.7 : 0.5;

  // ------- Confidence & signal strength -------
  const confidence = (angleScore * 0.3 + volumeScore * 0.3 + rsiScore * 0.2 + recencyScore * 0.2);

  const signalStrength = computeSignalStrength({
    patternConfidence: confidence,
    volumeConfirmation: volumeScore,
    trendAlignment: direction === 'bullish'
      ? (currentClose > currentSlow ? 1.0 : 0.4)
      : (currentClose < currentSlow ? 1.0 : 0.4),
    proximityToBreakout: recencyScore,
  });

  // ------- Trade levels -------
  const entryPrice = currentClose;
  let stopLoss: number;
  let target1: number;
  let target2: number;

  if (direction === 'bullish') {
    // Stop loss below the slow EMA (with a small buffer of 0.5 * ATR)
    stopLoss = currentAtr > 0
      ? currentSlow - 0.5 * currentAtr
      : currentSlow * 0.99;
    target1 = entryPrice + 2 * currentAtr;
    target2 = entryPrice + 3 * currentAtr;
  } else {
    // Stop loss above the slow EMA (with a small buffer)
    stopLoss = currentAtr > 0
      ? currentSlow + 0.5 * currentAtr
      : currentSlow * 1.01;
    target1 = entryPrice - 2 * currentAtr;
    target2 = entryPrice - 3 * currentAtr;
  }

  const riskRewardRatio = calculateRiskReward(entryPrice, stopLoss, target1);

  return {
    detected: true,
    patternName,
    category: 'crossover',
    direction,
    signalStrength,
    confidence,
    entryPrice,
    stopLoss,
    target1,
    target2,
    riskRewardRatio,
    patternData: {
      crossoverBarsAgo: crossoverIdx,
      fastEmaValue: currentFast,
      slowEmaValue: currentSlow,
      emaDivergencePct: +(emaDivergencePct * 100).toFixed(4),
      volumeRatio: +volumeRatio.toFixed(2),
      rsi: +currentRsi.toFixed(2),
      atr: +currentAtr.toFixed(4),
    },
  };
}

// ---------------------------------------------------------------------------
// Exported PatternDetector instances
// ---------------------------------------------------------------------------

/**
 * Detects 9/21 EMA crossover.
 *
 * The 9/21 crossover is a short-term momentum signal. Suitable for
 * 3-7 day swing trades. A bullish signal fires when EMA9 crosses above
 * EMA21; bearish when EMA9 crosses below EMA21.
 */
export const emaCrossover9_21: PatternDetector = {
  name: 'ema_crossover_9_21',
  category: 'crossover',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    return detectEmaCrossover(
      'ema_crossover_9_21',
      candles,
      indicators,
      indicators.ema9,
      indicators.ema21
    );
  },
};

/**
 * Detects 20/50 EMA crossover.
 *
 * The 20/50 crossover is a medium-term trend signal. A bullish signal fires
 * when EMA20 (approximated by EMA21) crosses above EMA50; bearish when it
 * crosses below. Because the project provides EMA21 rather than EMA20, we
 * use EMA21 as the fast line -- the behavioral difference is negligible.
 */
export const emaCrossover20_50: PatternDetector = {
  name: 'ema_crossover_20_50',
  category: 'crossover',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    return detectEmaCrossover(
      'ema_crossover_20_50',
      candles,
      indicators,
      indicators.ema21,   // EMA21 ≈ EMA20
      indicators.ema50
    );
  },
};
