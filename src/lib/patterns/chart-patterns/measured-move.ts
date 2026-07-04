import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternDetector,
  PatternDirection,
} from '@/types/pattern';
import {
  computeSignalStrength,
  calculateRiskReward,
  confirmedBreakUp,
  confirmedBreakDown,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME = 'measured_move';
const MIN_CANDLES = 20;
const MIN_WAVE_LENGTH = 5;
const MAX_WAVE_LENGTH = 15;
const MIN_RETRACEMENT = 0.38; // 38% Fibonacci
const MAX_RETRACEMENT = 0.62; // 62% Fibonacci

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a "not detected" result. */
function noDetection(direction: PatternDirection = 'neutral'): PatternResult {
  return {
    detected: false,
    patternName: NAME,
    category: 'chart',
    direction,
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
 * Find a strong impulse move (wave) starting from startIdx looking forward.
 * Returns the end index and the move's direction/magnitude.
 *
 * An impulse wave is identified by a sustained directional move over
 * MIN_WAVE_LENGTH to MAX_WAVE_LENGTH candles where the net move is
 * significant relative to price.
 */
function findImpulseWave(
  candles: CandleData[],
  startIdx: number,
  minLen: number,
  maxLen: number,
): {
  endIdx: number;
  startPrice: number;
  endPrice: number;
  magnitude: number;
  direction: 'up' | 'down';
} | null {
  if (startIdx < 0 || startIdx + minLen >= candles.length) return null;

  const startPrice = candles[startIdx].close;
  let bestEndIdx = -1;
  let bestMagnitude = 0;

  const limit = Math.min(startIdx + maxLen, candles.length - 1);

  for (let i = startIdx + minLen; i <= limit; i++) {
    const endPrice = candles[i].close;
    const magnitude = Math.abs(endPrice - startPrice);
    const pctMove = (magnitude / startPrice) * 100;

    // Impulse wave must move at least 3% to be meaningful
    if (pctMove >= 3 && magnitude > bestMagnitude) {
      bestMagnitude = magnitude;
      bestEndIdx = i;
    }
  }

  if (bestEndIdx === -1) return null;

  const endPrice = candles[bestEndIdx].close;
  const direction = endPrice > startPrice ? 'up' : 'down';

  return {
    endIdx: bestEndIdx,
    startPrice,
    endPrice,
    magnitude: bestMagnitude,
    direction,
  };
}

/**
 * Find a correction wave after an impulse move. The correction should retrace
 * 38-62% of the impulse wave.
 */
function findCorrectionWave(
  candles: CandleData[],
  startIdx: number,
  impulseDirection: 'up' | 'down',
  impulseMagnitude: number,
  impulseStartPrice: number,
  impulseEndPrice: number,
): {
  endIdx: number;
  retracementPct: number;
  correctionEndPrice: number;
} | null {
  if (startIdx >= candles.length) return null;

  const limit = Math.min(startIdx + MAX_WAVE_LENGTH, candles.length - 1);
  let bestEndIdx = -1;
  let bestRetracementPct = 0;

  for (let i = startIdx + 1; i <= limit; i++) {
    const price = candles[i].close;
    let retracement: number;

    if (impulseDirection === 'up') {
      // Correction is downward from impulse end
      retracement = impulseEndPrice - price;
    } else {
      // Correction is upward from impulse end
      retracement = price - impulseEndPrice;
    }

    const retracementPct = impulseMagnitude > 0 ? retracement / impulseMagnitude : 0;

    // Must be a retracement (positive value), within our Fibonacci range
    if (
      retracementPct >= MIN_RETRACEMENT &&
      retracementPct <= MAX_RETRACEMENT &&
      retracementPct > bestRetracementPct
    ) {
      bestRetracementPct = retracementPct;
      bestEndIdx = i;
    }
  }

  if (bestEndIdx === -1) return null;

  return {
    endIdx: bestEndIdx,
    retracementPct: bestRetracementPct,
    correctionEndPrice: candles[bestEndIdx].close,
  };
}

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

/**
 * **Measured Move (AB=CD)** - Trend continuation pattern.
 *
 * Two equal impulse waves separated by a correction. Wave 1 (A->B) is the
 * first impulse, followed by a correction (B->C) that retraces 38-62% of
 * wave 1. Wave 3 (C->D) is expected to equal wave 1 in magnitude.
 *
 * If wave 3 is starting or in progress, the pattern signals a trade.
 *
 * Bullish: upward impulse waves.
 * Bearish: downward impulse waves.
 *
 * Entry: end of correction (point C).
 * Stop loss: below correction low (bullish) or above correction high (bearish).
 * Target: entry + wave 1 magnitude.
 */
export const measuredMoveDetector: PatternDetector = {
  name: NAME,
  category: 'chart',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    if (candles.length < MIN_CANDLES) return noDetection();

    // Try multiple starting points to find the best measured move pattern
    const maxLookback = Math.min(candles.length - MIN_WAVE_LENGTH * 2, 40);

    for (let lookback = 0; lookback < maxLookback; lookback += 2) {
      const wave1Start = candles.length - MIN_WAVE_LENGTH * 3 - lookback;
      if (wave1Start < 0) continue;

      // ----- Find Wave 1 (impulse) -----
      const wave1 = findImpulseWave(
        candles,
        wave1Start,
        MIN_WAVE_LENGTH,
        MAX_WAVE_LENGTH,
      );

      if (!wave1) continue;

      // ----- Find correction wave -----
      const correction = findCorrectionWave(
        candles,
        wave1.endIdx,
        wave1.direction,
        wave1.magnitude,
        wave1.startPrice,
        wave1.endPrice,
      );

      if (!correction) continue;

      // ----- Wave 3 must RESUME with a confirmed break beyond point C -----
      // The trade trigger: the last bar closes beyond the correction end (C) in the
      // impulse direction, having been inside on the prior bar. This removes the flood
      // of speculative "wave 3 might be starting" signals — measured move now fires
      // only on the confirmed continuation bar.
      const wave3StartIdx = correction.endIdx;
      const lastIdx = candles.length - 1;
      const candlesSinceCorrection = lastIdx - wave3StartIdx;
      if (candlesSinceCorrection < 1 || candlesSinceCorrection > MAX_WAVE_LENGTH) continue;

      const wave3StartPrice = correction.correctionEndPrice;
      const lastClose = candles[lastIdx].close;
      const prevClose = candles[lastIdx - 1].close;
      const resumed = wave1.direction === 'up'
        ? confirmedBreakUp(lastClose, prevClose, wave3StartPrice, wave3StartPrice)
        : confirmedBreakDown(lastClose, prevClose, wave3StartPrice, wave3StartPrice);
      if (!resumed) continue;

      const wave3CurrentPrice = lastClose;
      const wave3InCorrectDirection = true; // confirmed by the break above

      // ----- Calculate wave 3 progress -----
      const wave3CurrentMagnitude = Math.abs(wave3CurrentPrice - wave3StartPrice);
      const wave3Progress = wave1.magnitude > 0
        ? wave3CurrentMagnitude / wave1.magnitude
        : 0;

      // Wave 3 should not have already exceeded wave 1 significantly
      if (wave3Progress > 1.3) continue;

      // ----- Direction -----
      const direction: PatternDirection =
        wave1.direction === 'up' ? 'bullish' : 'bearish';

      // ----- Signal scoring -----
      // How close the retracement is to ideal 50%
      const idealRetracement = 0.5;
      const retracementQuality =
        1 - Math.abs(correction.retracementPct - idealRetracement) / idealRetracement;

      // Wave 1 strength (larger moves = stronger pattern)
      const wave1PctMove = (wave1.magnitude / wave1.startPrice) * 100;
      const waveStrength = Math.min(1, wave1PctMove / 8); // 8% move = max

      // Wave 3 progress: just starting = higher signal (more opportunity)
      const progressScore =
        wave3Progress <= 0.3 ? 1.0 :
        wave3Progress <= 0.6 ? 0.7 :
        wave3Progress <= 0.9 ? 0.4 : 0.2;

      const patternConfidence = Math.min(
        1,
        retracementQuality * 0.4 + waveStrength * 0.3 + progressScore * 0.3,
      );

      // Volume confirmation: higher volume at start of wave 3 is ideal
      const avgVolume = indicators.avgVolume > 0 ? indicators.avgVolume : 1;
      const recentVolumeRatio = candles[lastIdx].volume / avgVolume;
      const volumeConfirmation = Math.min(1, recentVolumeRatio / 1.5);

      const trendAlignment = wave3InCorrectDirection ? 0.85 : 0.4;
      const proximityToBreakout = 1.0; // confirmed wave-3 break

      const signalStrength = computeSignalStrength({
        patternConfidence,
        volumeConfirmation,
        trendAlignment,
        proximityToBreakout,
      });

      const confidence = Math.min(
        1,
        retracementQuality * 0.3 +
          waveStrength * 0.25 +
          volumeConfirmation * 0.2 +
          (wave3InCorrectDirection ? 0.25 : 0.1),
      );

      // ----- Trade levels -----
      const entryPrice = correction.correctionEndPrice;
      let stopLoss: number;
      let target1: number;
      let target2: number;

      if (direction === 'bullish') {
        // Find the low during the correction for stop loss
        let correctionLow = Infinity;
        for (let i = wave1.endIdx; i <= correction.endIdx && i < candles.length; i++) {
          if (candles[i].low < correctionLow) correctionLow = candles[i].low;
        }
        stopLoss = correctionLow;
        target1 = entryPrice + wave1.magnitude;
        target2 = entryPrice + wave1.magnitude * 1.272; // 127.2% Fib extension
      } else {
        // Find the high during the correction for stop loss
        let correctionHigh = -Infinity;
        for (let i = wave1.endIdx; i <= correction.endIdx && i < candles.length; i++) {
          if (candles[i].high > correctionHigh) correctionHigh = candles[i].high;
        }
        stopLoss = correctionHigh;
        target1 = entryPrice - wave1.magnitude;
        target2 = entryPrice - wave1.magnitude * 1.272;
      }

      const riskRewardRatio = calculateRiskReward(entryPrice, stopLoss, target1);

      return {
        detected: true,
        patternName: NAME,
        category: 'chart',
        direction,
        signalStrength: parseFloat(signalStrength.toFixed(3)),
        confidence: parseFloat(confidence.toFixed(3)),
        entryPrice: parseFloat(entryPrice.toFixed(2)),
        stopLoss: parseFloat(stopLoss.toFixed(2)),
        target1: parseFloat(target1.toFixed(2)),
        target2: parseFloat(target2.toFixed(2)),
        riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
        patternData: {
          wave1Start: wave1Start,
          wave1End: wave1.endIdx,
          wave1Direction: wave1.direction,
          wave1Magnitude: parseFloat(wave1.magnitude.toFixed(2)),
          wave1PctMove: parseFloat(wave1PctMove.toFixed(2)),
          wave1StartPrice: parseFloat(wave1.startPrice.toFixed(2)),
          wave1EndPrice: parseFloat(wave1.endPrice.toFixed(2)),
          correctionEnd: correction.endIdx,
          correctionRetracementPct: parseFloat((correction.retracementPct * 100).toFixed(1)),
          correctionEndPrice: parseFloat(correction.correctionEndPrice.toFixed(2)),
          wave3Progress: parseFloat((wave3Progress * 100).toFixed(1)),
          wave3InCorrectDirection,
          projectedTarget: parseFloat(
            (direction === 'bullish'
              ? entryPrice + wave1.magnitude
              : entryPrice - wave1.magnitude
            ).toFixed(2),
          ),
        },
      };
    }

    return noDetection();
  },
};
