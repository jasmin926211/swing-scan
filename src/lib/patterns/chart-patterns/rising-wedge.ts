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
  isVolumeDecreasing,
  computeSignalStrength,
  calculateRiskReward,
  confirmedBreakDown,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME = 'rising_wedge';
const DIR: PatternDirection = 'bearish';
const MIN_CANDLES = 20;
const MIN_TOUCHES = 2;
/** Bound the wedge to a recent window — fitting over the full 200-bar history
 *  matched almost any trending stock (audited critical bug). */
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
 * A pivot "touches" the line when its price is within `tolerancePct` of the
 * projected value at that index.
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
 * **Rising Wedge** - Bearish continuation / reversal pattern.
 *
 * Both support and resistance trendlines slope upward, but they converge
 * because resistance rises less steeply than support. A breakdown below the
 * support trendline signals the bearish move.
 *
 * Confirmation factors:
 * - Both trendlines have positive slope
 * - Resistance slope < support slope (converging wedge)
 * - At least 2 touches on each trendline
 * - Volume decreasing within the wedge
 */
export const risingWedgeDetector: PatternDetector = {
  name: NAME,
  category: 'chart',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    if (candles.length < MIN_CANDLES) return noDetection();

    // Bound to a recent window so the trendlines describe a real wedge, not a
    // 200-bar regression that matches anything.
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

    // ----- Both slopes must be positive (rising) -----
    if (resistanceLine.slope <= 0 || supportLine.slope <= 0) {
      return noDetection();
    }

    // ----- Converging: resistance slope < support slope -----
    if (resistanceLine.slope >= supportLine.slope) {
      return noDetection();
    }

    // ----- Minimum touches on each line -----
    const resistanceTouches = countTouches(pivotHighs, resistanceLine);
    const supportTouches = countTouches(pivotLows, supportLine);

    if (resistanceTouches < MIN_TOUCHES || supportTouches < MIN_TOUCHES) {
      return noDetection();
    }

    // ----- Trendline quality (R-squared) -----
    const avgRSquared = (resistanceLine.rSquared + supportLine.rSquared) / 2;
    if (avgRSquared < 0.5) return noDetection();

    // ----- Volume decreasing within wedge (window-relative indices) -----
    const wedgeStart = Math.min(pivotHighs[0].index, pivotLows[0].index);
    const lastIdx = win.length - 1;
    const volDecreasing = isVolumeDecreasing(win, wedgeStart, lastIdx);

    // ----- Require a CONFIRMED breakdown below the support line -----
    const lastClose = win[lastIdx].close;
    const prevClose = win[lastIdx - 1].close;
    const supportAtLast = supportLine.slope * lastIdx + supportLine.intercept;
    const supportAtPrev = supportLine.slope * (lastIdx - 1) + supportLine.intercept;
    const resistanceAtLast = resistanceLine.slope * lastIdx + resistanceLine.intercept;
    const wedgeWidth = resistanceAtLast - supportAtLast;

    // Was a circular "how close is price to the line" score; now it must actually break.
    if (!confirmedBreakDown(lastClose, prevClose, supportAtLast, supportAtPrev)) {
      return noDetection();
    }
    const proximityToBreakout = 1.0;

    // ----- Convergence ratio: how much narrower the wedge is vs at start -----
    const supportAtStart = supportLine.slope * wedgeStart + supportLine.intercept;
    const resistanceAtStart = resistanceLine.slope * wedgeStart + resistanceLine.intercept;
    const startWidth = resistanceAtStart - supportAtStart;
    const convergenceRatio = startWidth > 0 ? 1 - (wedgeWidth / startWidth) : 0;

    // ----- Signal scoring -----
    const patternConfidence = Math.min(1, avgRSquared * 0.6 + convergenceRatio * 0.4);
    const volumeConfirmation = volDecreasing ? 0.8 : 0.3;
    const trendAlignment = 0.7; // Rising wedges are bearish regardless of prior trend

    const signalStrength = computeSignalStrength({
      patternConfidence,
      volumeConfirmation,
      trendAlignment,
      proximityToBreakout,
    });

    const confidence = Math.min(
      1,
      (avgRSquared * 0.3 +
        (volDecreasing ? 0.25 : 0.1) +
        Math.min(1, (resistanceTouches + supportTouches) / 6) * 0.25 +
        convergenceRatio * 0.2),
    );

    // ----- Trade levels -----
    const entryPrice = supportAtLast; // breakdown below support
    const lastPivotHigh = pivotHighs[pivotHighs.length - 1];
    const stopLoss = lastPivotHigh.price;
    const target1 = entryPrice - Math.abs(wedgeWidth);
    const target2 = entryPrice - Math.abs(wedgeWidth) * 1.618;
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
        wedgeWidth,
        convergenceRatio: parseFloat(convergenceRatio.toFixed(3)),
        volumeDecreasing: volDecreasing,
        breakoutConfirmed: true,
      },
    };
  },
};
