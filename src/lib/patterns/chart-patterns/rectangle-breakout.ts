import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternDetector,
  PatternDirection,
} from '@/types/pattern';
import {
  findPivotHighs,
  findPivotLows,
  fitTrendline,
  isFlat,
  isVolumeDecreasing,
  computeSignalStrength,
  calculateRiskReward,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME = 'rectangle_breakout';
const MIN_CANDLES = 20;
const MIN_TOTAL_TOUCHES = 3;
const FLAT_THRESHOLD = 0.0005; // very flat slope threshold

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
 * Count pivots that lie within tolerance of a horizontal level.
 */
function countTouchesAtLevel(
  pivots: { index: number; price: number }[],
  level: number,
  tolerancePct: number = 1.5,
): number {
  let touches = 0;
  for (const p of pivots) {
    if (level === 0) continue;
    const diff = Math.abs(p.price - level) / level;
    if (diff <= tolerancePct / 100) {
      touches++;
    }
  }
  return touches;
}

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

/**
 * **Rectangle Breakout** - Continuation or reversal pattern.
 *
 * Price consolidates between flat, horizontal support and resistance levels.
 * A breakout above resistance is bullish; a breakdown below support is bearish.
 *
 * Confirmation factors:
 * - Both trendlines are approximately flat (horizontal)
 * - At least 3 total touches across both lines
 * - Volume decreases during the consolidation rectangle
 * - Breakout confirmed by volume surge on the breakout candle
 */
export const rectangleBreakoutDetector: PatternDetector = {
  name: NAME,
  category: 'chart',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    if (candles.length < MIN_CANDLES) return noDetection();

    // ----- Identify pivot points -----
    const pivotHighs = findPivotHighs(candles, 3, 3);
    const pivotLows = findPivotLows(candles, 3, 3);

    if (pivotHighs.length < 2 || pivotLows.length < 2) {
      return noDetection();
    }

    // ----- Fit trendlines -----
    const resistanceLine = fitTrendline(pivotHighs);
    const supportLine = fitTrendline(pivotLows);

    if (!resistanceLine || !supportLine) return noDetection();

    // ----- Both trendlines must be approximately flat -----
    if (!isFlat(resistanceLine.slope, FLAT_THRESHOLD) ||
        !isFlat(supportLine.slope, FLAT_THRESHOLD)) {
      return noDetection();
    }

    // ----- Compute horizontal levels -----
    // For flat lines, the intercept is a good approximation of the level,
    // but we also average the pivot prices for robustness.
    const resistanceLevel =
      pivotHighs.reduce((sum, p) => sum + p.price, 0) / pivotHighs.length;
    const supportLevel =
      pivotLows.reduce((sum, p) => sum + p.price, 0) / pivotLows.length;

    if (resistanceLevel <= supportLevel) return noDetection();

    const rectangleHeight = resistanceLevel - supportLevel;
    const midPrice = (resistanceLevel + supportLevel) / 2;

    // Reject if rectangle is too thin (< 1% of price) or too wide (> 15%)
    const rectanglePct = (rectangleHeight / midPrice) * 100;
    if (rectanglePct < 1 || rectanglePct > 15) return noDetection();

    // ----- Minimum touches -----
    const resistanceTouches = countTouchesAtLevel(pivotHighs, resistanceLevel);
    const supportTouches = countTouchesAtLevel(pivotLows, supportLevel);
    const totalTouches = resistanceTouches + supportTouches;

    if (totalTouches < MIN_TOTAL_TOUCHES) return noDetection();

    // ----- Volume decreasing during rectangle -----
    const rectStart = Math.min(pivotHighs[0].index, pivotLows[0].index);
    const rectEnd = candles.length - 2; // exclude the breakout candle
    const volDecreasing = rectEnd > rectStart
      ? isVolumeDecreasing(candles, rectStart, rectEnd)
      : false;

    // ----- Detect breakout direction -----
    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];

    const breakoutAbove = lastCandle.close > resistanceLevel &&
      prevCandle.close <= resistanceLevel;
    const breakdownBelow = lastCandle.close < supportLevel &&
      prevCandle.close >= supportLevel;

    if (!breakoutAbove && !breakdownBelow) return noDetection();

    const direction: PatternDirection = breakoutAbove ? 'bullish' : 'bearish';

    // ----- Volume surge on breakout -----
    const avgVolume = indicators.avgVolume > 0 ? indicators.avgVolume : 1;
    const breakoutVolumeRatio = lastCandle.volume / avgVolume;
    const hasVolumeSurge = breakoutVolumeRatio >= 1.5;

    // ----- Signal scoring -----
    const patternConfidence = Math.min(
      1,
      (resistanceLine.rSquared + supportLine.rSquared) / 2 * 0.4 +
        Math.min(1, totalTouches / 6) * 0.3 +
        (volDecreasing ? 0.3 : 0.1),
    );
    const volumeConfirmation = hasVolumeSurge
      ? Math.min(1, breakoutVolumeRatio / 3)
      : 0.3;
    const trendAlignment = 0.7; // Rectangle breakouts are self-confirming
    const proximityToBreakout = 1.0; // Breakout already happened

    const signalStrength = computeSignalStrength({
      patternConfidence,
      volumeConfirmation,
      trendAlignment,
      proximityToBreakout,
    });

    const confidence = Math.min(
      1,
      (patternConfidence * 0.4 +
        volumeConfirmation * 0.3 +
        (totalTouches >= 4 ? 0.3 : totalTouches >= 3 ? 0.2 : 0.1)),
    );

    // ----- Trade levels -----
    let entryPrice: number;
    let stopLoss: number;
    let target1: number;
    let target2: number;

    if (direction === 'bullish') {
      entryPrice = lastCandle.close;
      stopLoss = supportLevel;
      target1 = entryPrice + rectangleHeight;
      target2 = entryPrice + rectangleHeight * 1.618;
    } else {
      entryPrice = lastCandle.close;
      stopLoss = resistanceLevel;
      target1 = entryPrice - rectangleHeight;
      target2 = entryPrice - rectangleHeight * 1.618;
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
        resistanceLevel: parseFloat(resistanceLevel.toFixed(2)),
        supportLevel: parseFloat(supportLevel.toFixed(2)),
        rectangleHeight: parseFloat(rectangleHeight.toFixed(2)),
        rectanglePct: parseFloat(rectanglePct.toFixed(2)),
        resistanceTouches,
        supportTouches,
        totalTouches,
        volumeDecreasingDuringRect: volDecreasing,
        breakoutVolumeRatio: parseFloat(breakoutVolumeRatio.toFixed(2)),
        hasVolumeSurge,
        breakoutDirection: direction,
      },
    };
  },
};
