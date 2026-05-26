import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternDetector,
  PatternCategory,
  PatternDirection,
} from '@/types/pattern';
import {
  findPivotHighs,
  findPivotLows,
  fitTrendline,
  isVolumeDecreasing,
  computeSignalStrength,
  calculateRiskReward,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME = 'falling_wedge';
const CATEGORY: PatternCategory = 'chart';
const DIRECTION: PatternDirection = 'bullish';

/** Minimum candles required. */
const MIN_CANDLES = 20;
/** Maximum lookback window. */
const MAX_LOOKBACK = 50;

/** Minimum pivot touches required on each trendline. */
const MIN_TOUCHES = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noDetection(): PatternResult {
  return {
    detected: false,
    patternName: NAME,
    category: CATEGORY,
    direction: DIRECTION,
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

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

export const fallingWedgeDetector: PatternDetector = {
  name: NAME,
  category: CATEGORY,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    if (candles.length < MIN_CANDLES) return noDetection();

    const lookback = Math.min(candles.length, MAX_LOOKBACK);
    const windowCandles = candles.slice(-lookback);
    const offset = candles.length - lookback;

    // ----- Step 1: Find pivot highs (resistance) and pivot lows (support) -----
    const pivotHighs = findPivotHighs(windowCandles, 2, 2);
    const pivotLows = findPivotLows(windowCandles, 2, 2);

    if (pivotHighs.length < MIN_TOUCHES || pivotLows.length < MIN_TOUCHES) {
      return noDetection();
    }

    // ----- Step 2: Fit trendlines -----
    const resistanceLine = fitTrendline(pivotHighs);
    const supportLine = fitTrendline(pivotLows);

    if (!resistanceLine || !supportLine) return noDetection();

    // ----- Step 3: Both trendlines must slope downward -----
    if (resistanceLine.slope >= 0 || supportLine.slope >= 0) {
      return noDetection();
    }

    // ----- Step 4: They must CONVERGE -----
    // Support line must have a steeper negative slope (more negative) than resistance.
    // This means the support line drops faster, so the wedge narrows.
    if (supportLine.slope >= resistanceLine.slope) {
      return noDetection();
    }

    // Verify convergence: the gap between the lines should narrow from start to end
    const firstPivotIdx = Math.min(
      pivotHighs[0].index,
      pivotLows[0].index,
    );
    const lastPivotIdx = Math.max(
      pivotHighs[pivotHighs.length - 1].index,
      pivotLows[pivotLows.length - 1].index,
    );

    const gapAtStart =
      (resistanceLine.slope * firstPivotIdx + resistanceLine.intercept) -
      (supportLine.slope * firstPivotIdx + supportLine.intercept);
    const gapAtEnd =
      (resistanceLine.slope * lastPivotIdx + resistanceLine.intercept) -
      (supportLine.slope * lastPivotIdx + supportLine.intercept);

    if (gapAtEnd >= gapAtStart || gapAtStart <= 0) {
      return noDetection(); // lines not converging or inverted
    }

    // ----- Step 5: Volume should decrease during the wedge -----
    const volDecreasing = isVolumeDecreasing(
      windowCandles,
      firstPivotIdx,
      Math.min(lastPivotIdx, windowCandles.length - 1),
    );

    // ----- Step 6: Breakout check -----
    // Current price should be near or above the resistance trendline
    const currentBarIdx = windowCandles.length - 1;
    const currentPrice = windowCandles[currentBarIdx].close;
    const resistanceAtCurrent =
      resistanceLine.slope * currentBarIdx + resistanceLine.intercept;
    const supportAtCurrent =
      supportLine.slope * currentBarIdx + supportLine.intercept;

    // Price should be above or within 2% of the resistance line
    const breakoutOccurred = currentPrice > resistanceAtCurrent;
    const nearBreakout =
      currentPrice >= resistanceAtCurrent * 0.98;

    if (!nearBreakout) return noDetection();

    // ----- Step 7: Compute pattern metrics -----
    // Wedge height at its widest point (start)
    const widestHeight = gapAtStart;

    // Trendline fit quality
    const avgRSquared =
      (resistanceLine.rSquared + supportLine.rSquared) / 2;

    // Convergence ratio
    const convergenceRatio = gapAtEnd / gapAtStart; // lower = better convergence

    // Find the most recent pivot low for stop loss
    const recentPivotLow = pivotLows[pivotLows.length - 1];

    // Volume confirmation
    const volumeConfirmation = volDecreasing ? 0.8 : 0.4;
    const latestVolRatio =
      indicators.volumeRatios.length > 0
        ? indicators.volumeRatios[indicators.volumeRatios.length - 1]
        : 1;
    // If breakout occurred, higher volume is better confirmation
    const breakoutVolumeBonus = breakoutOccurred
      ? Math.min(1, latestVolRatio / 1.5)
      : 0.5;

    const proximityToBreakout = breakoutOccurred
      ? 1.0
      : Math.max(
          0,
          1 - (resistanceAtCurrent - currentPrice) / widestHeight,
        );

    const patternConfidence = Math.min(
      1,
      avgRSquared * 0.4 + (1 - convergenceRatio) * 0.3 + 0.3,
    );

    // Trend alignment: falling wedge in a downtrend (continuation) or
    // at the bottom (reversal) -- both are valid
    let trendAlignment = 0.6; // neutral-positive
    if (indicators.ema50.length >= 10) {
      const recentEma50 = indicators.ema50[indicators.ema50.length - 1];
      const olderEma50 = indicators.ema50[indicators.ema50.length - 10];
      if (olderEma50 > recentEma50) {
        trendAlignment = 0.8; // downtrend context, reversal scenario
      }
    }

    const signalStrength = computeSignalStrength({
      patternConfidence,
      volumeConfirmation: (volumeConfirmation + breakoutVolumeBonus) / 2,
      trendAlignment,
      proximityToBreakout,
    });

    const confidence = parseFloat(
      (
        patternConfidence * 0.4 +
        avgRSquared * 0.3 +
        volumeConfirmation * 0.3
      ).toFixed(3),
    );

    // ----- Step 8: Trade levels -----
    const entryPrice = parseFloat(resistanceAtCurrent.toFixed(2));
    const stopLoss = parseFloat((recentPivotLow.price * 0.99).toFixed(2));
    const target1 = parseFloat((entryPrice + widestHeight).toFixed(2));
    const target2 = parseFloat((entryPrice + 1.5 * widestHeight).toFixed(2));
    const riskRewardRatio = parseFloat(
      calculateRiskReward(entryPrice, stopLoss, target1).toFixed(2),
    );

    return {
      detected: true,
      patternName: NAME,
      category: CATEGORY,
      direction: DIRECTION,
      signalStrength: parseFloat(signalStrength.toFixed(3)),
      confidence: Math.min(1, parseFloat(confidence.toFixed(3))),
      entryPrice,
      stopLoss,
      target1,
      target2,
      riskRewardRatio,
      patternData: {
        resistanceLine: {
          slope: parseFloat(resistanceLine.slope.toFixed(6)),
          intercept: parseFloat(resistanceLine.intercept.toFixed(2)),
          rSquared: parseFloat(resistanceLine.rSquared.toFixed(4)),
        },
        supportLine: {
          slope: parseFloat(supportLine.slope.toFixed(6)),
          intercept: parseFloat(supportLine.intercept.toFixed(2)),
          rSquared: parseFloat(supportLine.rSquared.toFixed(4)),
        },
        pivotHighs: pivotHighs.map((p) => ({
          index: p.index + offset,
          price: p.price,
        })),
        pivotLows: pivotLows.map((p) => ({
          index: p.index + offset,
          price: p.price,
        })),
        widestHeight: parseFloat(widestHeight.toFixed(2)),
        gapAtStart: parseFloat(gapAtStart.toFixed(2)),
        gapAtEnd: parseFloat(gapAtEnd.toFixed(2)),
        convergenceRatio: parseFloat(convergenceRatio.toFixed(4)),
        resistanceAtCurrent: parseFloat(resistanceAtCurrent.toFixed(2)),
        supportAtCurrent: parseFloat(supportAtCurrent.toFixed(2)),
        volumeDecreasing: volDecreasing,
        breakoutOccurred,
        currentPrice,
      },
    };
  },
};
