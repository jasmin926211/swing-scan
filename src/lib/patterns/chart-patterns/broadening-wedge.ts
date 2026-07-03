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
  confirmedBreakDown,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME = 'broadening_wedge';
const DIR: PatternDirection = 'bearish';
const MIN_CANDLES = 20;
const MIN_TOUCHES = 2;
/** Bound the wedge to a recent window (was fit over the full history). */
const MAX_LOOKBACK = 50;

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
 * Count how many pivots lie close to a regression line.
 */
function countTouches(
  pivots: { index: number; price: number }[],
  line: { slope: number; intercept: number },
  tolerancePct: number = 1.5,
): number {
  let touches = 0;
  for (const p of pivots) {
    const projected = line.slope * p.index + line.intercept;
    if (projected === 0) continue;
    const diff = Math.abs(p.price - projected) / projected;
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
 * **Broadening Wedge (Broadening Formation)** - Bearish pattern.
 *
 * Diverging trendlines: resistance slopes up while support slopes down,
 * creating higher highs AND lower lows. This signals increasing volatility
 * and typically resolves bearishly.
 *
 * Key characteristics:
 * - Resistance trendline has a positive slope (higher highs)
 * - Support trendline has a negative slope (lower lows)
 * - The range is expanding over time
 * - At least 2 touches on each trendline
 *
 * Entry: below support after a high (anticipating bearish resolution).
 * Stop loss: above the most recent pivot high.
 * Target: entry minus the recent range.
 */
export const broadeningWedgeDetector: PatternDetector = {
  name: NAME,
  category: 'chart',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    if (candles.length < MIN_CANDLES) return noDetection();

    const lookback = Math.min(candles.length, MAX_LOOKBACK);
    const win = candles.slice(-lookback);

    // ----- Identify pivot points (within the window) -----
    const pivotHighs = findPivotHighs(win, 3, 3);
    const pivotLows = findPivotLows(win, 3, 3);

    if (pivotHighs.length < MIN_TOUCHES || pivotLows.length < MIN_TOUCHES) {
      return noDetection();
    }

    // ----- Fit trendlines -----
    const resistanceLine = fitTrendline(pivotHighs);
    const supportLine = fitTrendline(pivotLows);

    if (!resistanceLine || !supportLine) return noDetection();

    // ----- Diverging: resistance slopes UP, support slopes DOWN -----
    if (resistanceLine.slope <= 0) return noDetection(); // higher highs required
    if (supportLine.slope >= 0) return noDetection();     // lower lows required

    // ----- Minimum touches -----
    const resistanceTouches = countTouches(pivotHighs, resistanceLine);
    const supportTouches = countTouches(pivotLows, supportLine);

    if (resistanceTouches < MIN_TOUCHES || supportTouches < MIN_TOUCHES) {
      return noDetection();
    }

    // ----- Trendline quality -----
    const avgRSquared = (resistanceLine.rSquared + supportLine.rSquared) / 2;
    if (avgRSquared < 0.4) return noDetection();

    // ----- Compute widths -----
    const wedgeStart = Math.min(pivotHighs[0].index, pivotLows[0].index);
    const lastIdx = win.length - 1;

    const resistanceAtStart =
      resistanceLine.slope * wedgeStart + resistanceLine.intercept;
    const supportAtStart =
      supportLine.slope * wedgeStart + supportLine.intercept;
    const startWidth = resistanceAtStart - supportAtStart;

    const resistanceAtLast =
      resistanceLine.slope * lastIdx + resistanceLine.intercept;
    const supportAtLast =
      supportLine.slope * lastIdx + supportLine.intercept;
    const currentWidth = resistanceAtLast - supportAtLast;

    // The current width must be larger than the starting width (expanding)
    if (currentWidth <= startWidth || currentWidth <= 0) return noDetection();

    const expansionRatio = currentWidth / Math.max(startWidth, 0.01);

    // ----- Recent range for target calculation -----
    const recentRange = currentWidth;
    const lastClose = win[lastIdx].close;
    const prevClose = win[lastIdx - 1].close;
    const supportAtPrev = supportLine.slope * (lastIdx - 1) + supportLine.intercept;

    // Require a CONFIRMED breakdown below support (was a proximity score, so it
    // fired while price was still inside this already-unreliable expanding shape).
    if (!confirmedBreakDown(lastClose, prevClose, supportAtLast, supportAtPrev)) {
      return noDetection();
    }
    const proximityToBreakout = 1.0;

    // ----- Signal scoring -----
    const patternConfidence = Math.min(
      1,
      avgRSquared * 0.4 +
        Math.min(1, expansionRatio / 2) * 0.3 +
        Math.min(1, (resistanceTouches + supportTouches) / 6) * 0.3,
    );

    // Volume often increases in broadening patterns
    const avgVolume = indicators.avgVolume > 0 ? indicators.avgVolume : 1;
    const lastVolumeRatio =
      indicators.volumeRatios.length > 0
        ? indicators.volumeRatios[indicators.volumeRatios.length - 1]
        : 1;
    const volumeConfirmation = Math.min(1, lastVolumeRatio / 1.5);

    const trendAlignment = 0.65; // broadening patterns are typically bearish

    const signalStrength = computeSignalStrength({
      patternConfidence,
      volumeConfirmation,
      trendAlignment,
      proximityToBreakout,
    });

    const confidence = Math.min(
      1,
      avgRSquared * 0.3 +
        Math.min(1, expansionRatio / 2) * 0.25 +
        Math.min(1, (resistanceTouches + supportTouches) / 6) * 0.25 +
        proximityToBreakout * 0.2,
    );

    // ----- Trade levels -----
    const entryPrice = supportAtLast; // below support
    const lastPivotHigh = pivotHighs[pivotHighs.length - 1];
    const stopLoss = lastPivotHigh.price;
    const target1 = entryPrice - recentRange;
    const target2 = entryPrice - recentRange * 1.618;
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
        resistanceTouches,
        supportTouches,
        startWidth: parseFloat(startWidth.toFixed(2)),
        currentWidth: parseFloat(currentWidth.toFixed(2)),
        expansionRatio: parseFloat(expansionRatio.toFixed(3)),
        breakoutConfirmed: true,
        lastVolumeRatio: parseFloat(lastVolumeRatio.toFixed(2)),
      },
    };
  },
};
