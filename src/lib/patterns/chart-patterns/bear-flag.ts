import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternDetector,
  PatternCategory,
  PatternDirection,
} from '@/types/pattern';
import {
  linearRegression,
  fitTrendline,
  findPivotHighs,
  findPivotLows,
  isVolumeDecreasing,
  priceRangeTightness,
  computeSignalStrength,
  calculateRiskReward,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_CANDLES = 20;
const POLE_MIN_BARS = 5;
const POLE_MAX_BARS = 15;
const FLAG_MIN_BARS = 5;
const FLAG_MAX_BARS = 15;
const MIN_POLE_MOVE_PCT = 5; // Pole must drop at least 5%
const MAX_FLAG_RETRACE_PCT = 50; // Flag must not retrace > 50% of pole

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noDetection(): PatternResult {
  return {
    detected: false,
    patternName: 'bear_flag',
    category: 'chart' as PatternCategory,
    direction: 'bearish' as PatternDirection,
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

/** Return the last element of an array (or `undefined`). */
function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

// ---------------------------------------------------------------------------
// Bear Flag Detector
// ---------------------------------------------------------------------------

export const bearFlagDetector: PatternDetector = {
  name: 'bear_flag',
  category: 'chart',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    // ----- Guard: minimum data -----
    if (candles.length < MIN_CANDLES) return noDetection();

    // Analyse the most recent 50 candles (or fewer)
    const lookback = Math.min(candles.length, 50);
    const slice = candles.slice(-lookback);

    // ----- Step 1: Search for best pole + flag combination -----
    let bestScore = -1;
    let bestPole: { startIdx: number; endIdx: number; height: number; slope: number } | null = null;
    let bestFlag: {
      startIdx: number;
      endIdx: number;
      upperSlope: number;
      lowerSlope: number;
      resistance: number;
      support: number;
    } | null = null;

    for (let poleEnd = POLE_MIN_BARS; poleEnd <= lookback - FLAG_MIN_BARS; poleEnd++) {
      for (
        let poleLen = POLE_MIN_BARS;
        poleLen <= Math.min(POLE_MAX_BARS, poleEnd);
        poleLen++
      ) {
        const poleStart = poleEnd - poleLen;
        const poleStartPrice = slice[poleStart].high;
        const poleEndPrice = slice[poleEnd].low;
        const poleHeight = poleStartPrice - poleEndPrice; // positive for a downward pole
        const poleMovePct = (poleHeight / poleStartPrice) * 100;

        // --- Pole validation ---
        if (poleMovePct < MIN_POLE_MOVE_PCT) continue;

        // Check pole slope is strongly negative
        const polePoints = [];
        for (let i = poleStart; i <= poleEnd; i++) {
          polePoints.push({ x: i, y: slice[i].close });
        }
        const poleReg = linearRegression(polePoints);
        if (poleReg.slope >= 0) continue; // Must be negative (downward)

        // --- Flag detection ---
        const flagStart = poleEnd + 1;
        const maxFlagEnd = Math.min(flagStart + FLAG_MAX_BARS - 1, slice.length - 1);

        if (flagStart >= slice.length) continue;

        const flagEnd = maxFlagEnd;
        const flagLen = flagEnd - flagStart + 1;
        if (flagLen < FLAG_MIN_BARS) continue;

        // Flag slope: slight upward or sideways drift (consolidation after drop)
        const flagPoints = [];
        for (let i = flagStart; i <= flagEnd; i++) {
          flagPoints.push({ x: i - flagStart, y: slice[i].close });
        }
        const flagReg = linearRegression(flagPoints);

        // Normalise slope
        const flagAvgPrice =
          flagPoints.reduce((s, p) => s + p.y, 0) / flagPoints.length;
        const normFlagSlope = flagAvgPrice > 0 ? flagReg.slope / flagAvgPrice : 0;

        // Reject if flag is trending strongly downward (continuation, not consolidation)
        if (normFlagSlope < -0.005) continue;

        // Flag retracement: the highest point in the flag should not rise more
        // than MAX_FLAG_RETRACE_PCT of the pole height above the pole bottom
        let flagLow = Infinity;
        let flagHigh = -Infinity;
        for (let i = flagStart; i <= flagEnd; i++) {
          if (slice[i].low < flagLow) flagLow = slice[i].low;
          if (slice[i].high > flagHigh) flagHigh = slice[i].high;
        }

        const retracementPct = ((flagHigh - poleEndPrice) / poleHeight) * 100;
        if (retracementPct > MAX_FLAG_RETRACE_PCT) continue;

        // Volume should decrease during the flag
        const volDecreasing = isVolumeDecreasing(slice, flagStart, flagEnd);

        // Price range should be tight
        const tightness = priceRangeTightness(slice, flagStart, flagEnd);

        // --- Build upper and lower trendlines of the flag channel ---
        const flagHighPivots = findPivotHighs(
          slice.slice(flagStart, flagEnd + 1),
          1,
          1,
        ).map((p) => ({ index: p.index + flagStart, price: p.price }));

        const flagLowPivots = findPivotLows(
          slice.slice(flagStart, flagEnd + 1),
          1,
          1,
        ).map((p) => ({ index: p.index + flagStart, price: p.price }));

        const upperLine =
          flagHighPivots.length >= 2
            ? fitTrendline(flagHighPivots)
            : {
                slope: (flagHigh - slice[flagStart].high) / Math.max(1, flagLen),
                intercept: slice[flagStart].high,
                rSquared: 0.5,
              };

        const lowerLine =
          flagLowPivots.length >= 2
            ? fitTrendline(flagLowPivots)
            : {
                slope: (flagLow - slice[flagStart].low) / Math.max(1, flagLen),
                intercept: slice[flagStart].low,
                rSquared: 0.5,
              };

        if (!upperLine || !lowerLine) continue;

        // Support at the last bar of the flag (lower trendline value)
        const support =
          lowerLine.slope * (flagEnd - flagStart) + lowerLine.intercept;
        const resistance =
          upperLine.slope * (flagEnd - flagStart) + upperLine.intercept;

        // --- Score this candidate ---
        const slopeScore = Math.min(1, poleMovePct / 15);
        const volScore = volDecreasing ? 0.8 : 0.3;
        const tightnessScore = tightness < 0.05 ? 1.0 : tightness < 0.10 ? 0.7 : 0.4;
        const retraceScore = 1 - retracementPct / 100;

        const score =
          slopeScore * 0.3 + volScore * 0.25 + tightnessScore * 0.25 + retraceScore * 0.2;

        if (score > bestScore) {
          bestScore = score;
          bestPole = {
            startIdx: poleStart,
            endIdx: poleEnd,
            height: poleHeight,
            slope: poleReg.slope,
          };
          bestFlag = {
            startIdx: flagStart,
            endIdx: flagEnd,
            upperSlope: upperLine.slope,
            lowerSlope: lowerLine.slope,
            resistance,
            support,
          };
        }
      }
    }

    // ----- No valid pattern found -----
    if (!bestPole || !bestFlag || bestScore < 0.3) return noDetection();

    // ----- Step 2: Breakdown check -----
    const currentPrice = slice[slice.length - 1].close;
    const distToBreakdown = bestFlag.support > 0
      ? (bestFlag.support - currentPrice) / bestFlag.support
      : 0;
    // Proximity to breakdown: 1.0 when at or below support, scales down
    const proximityToBreakout = distToBreakdown >= 0
      ? 1.0
      : Math.max(0, 1.0 + distToBreakdown * 20);

    // ----- Step 3: Trend alignment via EMAs -----
    const ema9 = last(indicators.ema9);
    const ema21 = last(indicators.ema21);
    let trendAlignment = 0.5;
    if (ema9 !== undefined && ema21 !== undefined) {
      trendAlignment = ema9 < ema21 ? 0.9 : 0.3; // Bearish alignment: EMA9 below EMA21
    }

    // ----- Step 4: Volume confirmation -----
    const volRatio = last(indicators.volumeRatios);
    let volumeConfirmation = 0.5;
    if (volRatio !== undefined) {
      volumeConfirmation = volRatio >= 1.5 ? 1.0 : volRatio >= 1.0 ? 0.7 : 0.4;
    }

    // ----- Step 5: Compute final signal strength -----
    const patternConfidence = bestScore;
    const signalStrength = computeSignalStrength({
      patternConfidence,
      volumeConfirmation,
      trendAlignment,
      proximityToBreakout,
    });

    const confidence = parseFloat(
      Math.min(1, (patternConfidence + proximityToBreakout) / 2).toFixed(3),
    );

    // ----- Step 6: Trade levels (bearish) -----
    const entryPrice = bestFlag.support; // breakdown below support
    const stopLoss = bestFlag.resistance; // stop above flag resistance
    const measuredMove = bestPole.height;
    const target1 = entryPrice - measuredMove;
    const target2 = entryPrice - measuredMove * 1.5;
    const riskRewardRatio = calculateRiskReward(entryPrice, stopLoss, target1);

    return {
      detected: true,
      patternName: 'bear_flag',
      category: 'chart',
      direction: 'bearish',
      signalStrength: parseFloat(signalStrength.toFixed(3)),
      confidence,
      entryPrice: parseFloat(entryPrice.toFixed(2)),
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      target1: parseFloat(target1.toFixed(2)),
      target2: parseFloat(target2.toFixed(2)),
      riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
      patternData: {
        poleStartIdx: bestPole.startIdx,
        poleEndIdx: bestPole.endIdx,
        poleHeight: parseFloat(bestPole.height.toFixed(2)),
        poleSlope: parseFloat(bestPole.slope.toFixed(6)),
        flagStartIdx: bestFlag.startIdx,
        flagEndIdx: bestFlag.endIdx,
        flagUpperSlope: parseFloat(bestFlag.upperSlope.toFixed(6)),
        flagLowerSlope: parseFloat(bestFlag.lowerSlope.toFixed(6)),
        flagResistance: parseFloat(bestFlag.resistance.toFixed(2)),
        flagSupport: parseFloat(bestFlag.support.toFixed(2)),
        measuredMove: parseFloat(measuredMove.toFixed(2)),
        proximityToBreakdown: parseFloat(proximityToBreakout.toFixed(3)),
        currentPrice: parseFloat(currentPrice.toFixed(2)),
        volumeDecreasingInFlag: isVolumeDecreasing(
          candles,
          candles.length - (slice.length - bestFlag.startIdx),
          candles.length - (slice.length - bestFlag.endIdx),
        ),
      },
    };
  },
};
