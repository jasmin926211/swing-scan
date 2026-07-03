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
  confirmedBreakUp,
  confirmedBreakDown,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME = 'symmetrical_triangle';
const MIN_CANDLES = 20;
const MIN_TOUCHES = 2;
/** Bound the triangle to a recent window (was fit over the full history). */
const MAX_LOOKBACK = 50;

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
 * Determine the prior trend direction by looking at the candles before the
 * triangle formation. Returns 'bullish' if the prior trend was up, 'bearish'
 * if down, and 'neutral' if unclear.
 */
function determinePriorTrend(
  candles: CandleData[],
  triangleStartIdx: number,
): PatternDirection {
  // Look at 10-20 candles before the triangle
  const lookback = Math.min(20, triangleStartIdx);
  if (lookback < 5) return 'neutral';

  const startIdx = triangleStartIdx - lookback;
  const startPrice = candles[startIdx].close;
  const endPrice = candles[triangleStartIdx].close;

  const changePct = ((endPrice - startPrice) / startPrice) * 100;

  if (changePct > 3) return 'bullish';
  if (changePct < -3) return 'bearish';
  return 'neutral';
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
 * **Symmetrical Triangle** - Continuation or reversal pattern.
 *
 * Converging trendlines: descending highs + ascending lows. The trendlines
 * meet at an apex. Volume typically decreases as the pattern forms.
 *
 * Direction is determined by:
 * 1. Which trendline breaks first
 * 2. If no breakout yet, the prior trend (continuation bias)
 *
 * Entry: at or just beyond the broken trendline.
 * Stop loss: opposite trendline.
 * Target: base width of the triangle projected from the breakout point.
 */
export const symmetricalTriangleDetector: PatternDetector = {
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

    // ----- Symmetrical triangle: resistance slopes DOWN, support slopes UP -----
    if (resistanceLine.slope >= 0) return noDetection(); // must be descending highs
    if (supportLine.slope <= 0) return noDetection();     // must be ascending lows

    // ----- Lines must converge (slopes have opposite signs already) -----
    // Compute apex: solve for x where both lines intersect
    const slopeDiff = supportLine.slope - resistanceLine.slope;
    if (Math.abs(slopeDiff) < 1e-10) return noDetection(); // parallel (unlikely)

    const apexX = (resistanceLine.intercept - supportLine.intercept) / slopeDiff;
    const lastIdx = win.length - 1;

    // Apex should be ahead of or near the current candle
    if (apexX < lastIdx - 5) return noDetection(); // apex is too far in the past

    // ----- Minimum touches on each line -----
    const resistanceTouches = countTouches(pivotHighs, resistanceLine);
    const supportTouches = countTouches(pivotLows, supportLine);

    if (resistanceTouches < MIN_TOUCHES || supportTouches < MIN_TOUCHES) {
      return noDetection();
    }

    // ----- Trendline quality -----
    const avgRSquared = (resistanceLine.rSquared + supportLine.rSquared) / 2;
    if (avgRSquared < 0.4) return noDetection();

    // ----- Triangle width (base) -----
    const triStart = Math.min(pivotHighs[0].index, pivotLows[0].index);
    const resistanceAtStart =
      resistanceLine.slope * triStart + resistanceLine.intercept;
    const supportAtStart =
      supportLine.slope * triStart + supportLine.intercept;
    const baseWidth = resistanceAtStart - supportAtStart;

    if (baseWidth <= 0) return noDetection();

    // Current width
    const resistanceAtLast =
      resistanceLine.slope * lastIdx + resistanceLine.intercept;
    const supportAtLast =
      supportLine.slope * lastIdx + supportLine.intercept;
    const currentWidth = resistanceAtLast - supportAtLast;

    // Must have narrowed meaningfully
    if (currentWidth <= 0 || currentWidth >= baseWidth * 0.85) {
      return noDetection();
    }

    // ----- Volume decreasing -----
    const volDecreasing = isVolumeDecreasing(win, triStart, lastIdx);

    // ----- Direction is UNKNOWN until a confirmed break -----
    // The old code guessed a direction and defaulted to bullish while price was
    // still mid-triangle — a wrong-way signal half the time. Now we require a
    // confirmed close beyond a boundary, else no signal.
    const lastClose = win[lastIdx].close;
    const prevClose = win[lastIdx - 1].close;
    const resistanceAtPrev = resistanceLine.slope * (lastIdx - 1) + resistanceLine.intercept;
    const supportAtPrev = supportLine.slope * (lastIdx - 1) + supportLine.intercept;

    let direction: PatternDirection;
    if (confirmedBreakUp(lastClose, prevClose, resistanceAtLast, resistanceAtPrev)) {
      direction = 'bullish';
    } else if (confirmedBreakDown(lastClose, prevClose, supportAtLast, supportAtPrev)) {
      direction = 'bearish';
    } else {
      return noDetection();
    }

    const proximityToBreakout = 1.0; // break already confirmed

    // Convergence ratio
    const convergenceRatio = 1 - (currentWidth / baseWidth);

    // ----- Signal scoring -----
    const patternConfidence = Math.min(
      1,
      avgRSquared * 0.4 +
        convergenceRatio * 0.3 +
        Math.min(1, (resistanceTouches + supportTouches) / 6) * 0.3,
    );

    const volumeConfirmation = volDecreasing ? 0.8 : 0.35;
    const trendAlignment = (direction as string) !== 'neutral' ? 0.7 : 0.4;

    const signalStrength = computeSignalStrength({
      patternConfidence,
      volumeConfirmation,
      trendAlignment,
      proximityToBreakout,
    });

    const confidence = Math.min(
      1,
      avgRSquared * 0.25 +
        (volDecreasing ? 0.2 : 0.08) +
        convergenceRatio * 0.25 +
        Math.min(1, (resistanceTouches + supportTouches) / 6) * 0.3,
    );

    // ----- Trade levels -----
    let entryPrice: number;
    let stopLoss: number;
    let target1: number;
    let target2: number;

    if (direction === 'bullish') {
      entryPrice = resistanceAtLast;
      stopLoss = supportAtLast;
      target1 = entryPrice + baseWidth;
      target2 = entryPrice + baseWidth * 1.618;
    } else {
      entryPrice = supportAtLast;
      stopLoss = resistanceAtLast;
      target1 = entryPrice - baseWidth;
      target2 = entryPrice - baseWidth * 1.618;
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
        resistanceSlope: resistanceLine.slope,
        supportSlope: supportLine.slope,
        resistanceRSquared: resistanceLine.rSquared,
        supportRSquared: supportLine.rSquared,
        resistanceTouches,
        supportTouches,
        baseWidth: parseFloat(baseWidth.toFixed(2)),
        currentWidth: parseFloat(currentWidth.toFixed(2)),
        convergenceRatio: parseFloat(convergenceRatio.toFixed(3)),
        apexIndex: parseFloat(apexX.toFixed(1)),
        volumeDecreasing: volDecreasing,
        priorTrend: determinePriorTrend(win, triStart),
        breakoutConfirmed: true,
      },
    };
  },
};
