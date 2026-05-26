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
  computeSignalStrength,
  calculateRiskReward,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME = 'channel_breakdown';
const DIR: PatternDirection = 'bearish';
const MIN_CANDLES = 20;
const MIN_CHANNEL_LENGTH = 15;
const MAX_CHANNEL_LENGTH = 40;
const SLOPE_SIMILARITY_THRESHOLD = 0.4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a "not detected" result. */
function noDetection(): PatternResult {
  return {
    detected: false,
    patternName: NAME,
    category: 'chart',
    direction: DIR,
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
 * Determines whether two slopes are approximately parallel.
 * Both must have the same sign and be within a percentage tolerance.
 */
function areSlopesParallel(
  slope1: number,
  slope2: number,
  tolerance: number = SLOPE_SIMILARITY_THRESHOLD,
): boolean {
  if ((slope1 > 0 && slope2 < 0) || (slope1 < 0 && slope2 > 0)) {
    return false;
  }

  const maxSlope = Math.max(Math.abs(slope1), Math.abs(slope2));
  if (maxSlope === 0) return true;

  const diff = Math.abs(slope1 - slope2);
  return diff / maxSlope <= tolerance;
}

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

/**
 * **Channel Breakdown** - Bearish continuation pattern.
 *
 * Mirror of Channel Breakout. Price travels within parallel trendlines then
 * breaks BELOW the lower channel support line.
 *
 * Confirmation factors:
 * - Support and resistance slopes are roughly parallel
 * - Channel has been in place for 15-40 candles
 * - Breakdown candle closes below the support line
 * - Volume increases on the breakdown candle
 */
export const channelBreakdownDetector: PatternDetector = {
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

    // ----- Slopes must be roughly parallel -----
    if (!areSlopesParallel(resistanceLine.slope, supportLine.slope)) {
      return noDetection();
    }

    // ----- Channel length check -----
    const channelStart = Math.min(
      pivotHighs[0].index,
      pivotLows[0].index,
    );
    const channelEnd = Math.max(
      pivotHighs[pivotHighs.length - 1].index,
      pivotLows[pivotLows.length - 1].index,
    );
    const channelLength = channelEnd - channelStart;

    if (channelLength < MIN_CHANNEL_LENGTH || channelLength > MAX_CHANNEL_LENGTH) {
      return noDetection();
    }

    // ----- Trendline quality -----
    const avgRSquared = (resistanceLine.rSquared + supportLine.rSquared) / 2;
    if (avgRSquared < 0.5) return noDetection();

    // ----- Channel width -----
    const lastIdx = candles.length - 1;
    const resistanceAtLast =
      resistanceLine.slope * lastIdx + resistanceLine.intercept;
    const supportAtLast =
      supportLine.slope * lastIdx + supportLine.intercept;
    const channelWidth = resistanceAtLast - supportAtLast;

    if (channelWidth <= 0) return noDetection();

    // ----- Breakdown below support -----
    const lastCandle = candles[lastIdx];
    const prevCandle = candles[lastIdx - 1];
    const supportAtPrev =
      supportLine.slope * (lastIdx - 1) + supportLine.intercept;

    const brokeBelow =
      lastCandle.close < supportAtLast &&
      prevCandle.close >= supportAtPrev;

    if (!brokeBelow) return noDetection();

    // ----- Volume confirmation -----
    const avgVolume = indicators.avgVolume > 0 ? indicators.avgVolume : 1;
    const breakdownVolumeRatio = lastCandle.volume / avgVolume;
    const hasVolumeSurge = breakdownVolumeRatio >= 1.3;

    // ----- Signal scoring -----
    const slopeSimilarity =
      1 -
      Math.abs(resistanceLine.slope - supportLine.slope) /
        Math.max(Math.abs(resistanceLine.slope), Math.abs(supportLine.slope), 0.0001);

    const patternConfidence = Math.min(
      1,
      avgRSquared * 0.4 +
        slopeSimilarity * 0.3 +
        Math.min(1, (pivotHighs.length + pivotLows.length) / 6) * 0.3,
    );

    const volumeConfirmation = hasVolumeSurge
      ? Math.min(1, breakdownVolumeRatio / 2.5)
      : 0.3;

    // Bearish breakdown aligns with downward channel more than upward
    const trendAlignment =
      supportLine.slope < 0 ? 0.8 : supportLine.slope === 0 ? 0.6 : 0.5;

    const proximityToBreakout = 1.0; // breakdown already happened

    const signalStrength = computeSignalStrength({
      patternConfidence,
      volumeConfirmation,
      trendAlignment,
      proximityToBreakout,
    });

    const confidence = Math.min(
      1,
      (patternConfidence * 0.4 + volumeConfirmation * 0.3 + avgRSquared * 0.3),
    );

    // ----- Trade levels -----
    const entryPrice = lastCandle.close;
    // Stop loss: last resistance touch (approximate via last pivot high)
    const lastPivotHigh = pivotHighs[pivotHighs.length - 1];
    const stopLoss = lastPivotHigh.price;
    const target1 = entryPrice - channelWidth;
    const target2 = entryPrice - channelWidth * 1.618;
    const riskRewardRatio = calculateRiskReward(entryPrice, stopLoss, target1);

    return {
      detected: true,
      patternName: NAME,
      category: 'chart',
      direction: DIR,
      signalStrength: parseFloat(signalStrength.toFixed(3)),
      confidence: parseFloat(confidence.toFixed(3)),
      entryPrice: parseFloat(entryPrice.toFixed(2)),
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      target1: parseFloat(target1.toFixed(2)),
      target2: parseFloat(target2.toFixed(2)),
      riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
      patternData: {
        resistanceSlope: resistanceLine.slope,
        supportSlope: supportLine.slope,
        resistanceRSquared: resistanceLine.rSquared,
        supportRSquared: supportLine.rSquared,
        channelLength,
        channelWidth: parseFloat(channelWidth.toFixed(2)),
        slopeSimilarity: parseFloat(slopeSimilarity.toFixed(3)),
        breakdownVolumeRatio: parseFloat(breakdownVolumeRatio.toFixed(2)),
        hasVolumeSurge,
        pivotHighCount: pivotHighs.length,
        pivotLowCount: pivotLows.length,
      },
    };
  },
};
