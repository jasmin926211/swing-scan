import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternDetector,
  PatternCategory,
  PatternDirection,
} from '@/types/pattern';
import {
  linearRegression,
  isPriceNear,
  isVolumeDecreasing,
  computeSignalStrength,
  calculateRiskReward,
  confirmedBreakUp,
  hasPriorUptrend,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_CANDLES = 30;
const LOOKBACK = 80;
const CUP_MIN_BARS = 20;
const CUP_MAX_BARS = 65;
const CUP_MIN_DEPTH_PCT = 12; // Cup must drop at least 12% from rim
const CUP_MAX_DEPTH_PCT = 35; // Cup must not drop more than 35% from rim
const HANDLE_MIN_BARS = 5;
const HANDLE_MAX_BARS = 15;
const HANDLE_MIN_RETRACE_PCT = 5; // Handle pulls back at least 5% of cup depth
const HANDLE_MAX_RETRACE_PCT = 50; // Handle pulls back at most 50% of cup depth
const RIM_TOLERANCE_PCT = 3; // Left and right rims should be within 3%
const V_SHAPE_MIN_BOTTOM_BARS_RATIO = 0.25; // At least 25% of cup duration should be near bottom

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noDetection(): PatternResult {
  return {
    detected: false,
    patternName: 'cup_and_handle',
    category: 'chart' as PatternCategory,
    direction: 'bullish' as PatternDirection,
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

/**
 * Fit a quadratic curve y = a*x^2 + b*x + c to a set of points.
 * Returns { a, b, c, rSquared }.
 * Uses ordinary least-squares with the normal equation for polynomial regression.
 */
function quadraticFit(
  points: { x: number; y: number }[],
): { a: number; b: number; c: number; rSquared: number } {
  const n = points.length;
  if (n < 3) {
    return { a: 0, b: 0, c: 0, rSquared: 0 };
  }

  // Build sums for normal equations
  let sx = 0, sx2 = 0, sx3 = 0, sx4 = 0;
  let sy = 0, sxy = 0, sx2y = 0;

  for (const p of points) {
    const x = p.x;
    const x2 = x * x;
    sx += x;
    sx2 += x2;
    sx3 += x2 * x;
    sx4 += x2 * x2;
    sy += p.y;
    sxy += x * p.y;
    sx2y += x2 * p.y;
  }

  // Solve the 3x3 system using Cramer's rule
  // | n    sx   sx2  | | c |   | sy   |
  // | sx   sx2  sx3  | | b | = | sxy  |
  // | sx2  sx3  sx4  | | a |   | sx2y |

  const det =
    n * (sx2 * sx4 - sx3 * sx3) -
    sx * (sx * sx4 - sx3 * sx2) +
    sx2 * (sx * sx3 - sx2 * sx2);

  if (Math.abs(det) < 1e-12) {
    return { a: 0, b: 0, c: 0, rSquared: 0 };
  }

  const c =
    (sy * (sx2 * sx4 - sx3 * sx3) -
      sx * (sxy * sx4 - sx2y * sx3) +
      sx2 * (sxy * sx3 - sx2y * sx2)) /
    det;

  const b =
    (n * (sxy * sx4 - sx2y * sx3) -
      sy * (sx * sx4 - sx3 * sx2) +
      sx2 * (sx * sx2y - sxy * sx2)) /
    det;

  const a =
    (n * (sx2 * sx2y - sx3 * sxy) -
      sx * (sx * sx2y - sxy * sx2) +
      sy * (sx * sx3 - sx2 * sx2)) /
    det;

  // R-squared
  const meanY = sy / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of points) {
    const predicted = a * p.x * p.x + b * p.x + c;
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }
  const rSquared = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { a, b, c, rSquared };
}

// ---------------------------------------------------------------------------
// Cup and Handle Detector
// ---------------------------------------------------------------------------

export const cupAndHandleDetector: PatternDetector = {
  name: 'cup_and_handle',
  category: 'chart',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    // ----- Guard: minimum data -----
    if (candles.length < MIN_CANDLES) return noDetection();

    const lookback = Math.min(candles.length, LOOKBACK);
    const slice = candles.slice(-lookback);

    let bestScore = -1;
    let bestCup: {
      leftRimIdx: number;
      rightRimIdx: number;
      bottomIdx: number;
      rimLevel: number;
      bottomLevel: number;
      depth: number;
      depthPct: number;
      quadA: number;
      quadRSquared: number;
      bottomBarsRatio: number;
    } | null = null;
    let bestHandle: {
      startIdx: number;
      endIdx: number;
      handleLow: number;
      handleHigh: number;
      handleRetracePct: number;
    } | null = null;

    // ----- Step 1: Search for the cup -----
    // Try different left rim positions and cup durations
    for (let leftRim = 0; leftRim <= lookback - CUP_MIN_BARS - HANDLE_MIN_BARS; leftRim++) {
      const leftRimPrice = slice[leftRim].high;

      for (
        let cupLen = CUP_MIN_BARS;
        cupLen <= Math.min(CUP_MAX_BARS, lookback - leftRim - HANDLE_MIN_BARS);
        cupLen++
      ) {
        const rightRimIdx = leftRim + cupLen;
        if (rightRimIdx >= slice.length) continue;

        const rightRimPrice = slice[rightRimIdx].high;

        // --- Rim validation: left and right rims should be near each other ---
        if (!isPriceNear(leftRimPrice, rightRimPrice, RIM_TOLERANCE_PCT)) continue;

        const rimLevel = (leftRimPrice + rightRimPrice) / 2;

        // --- Find the bottom of the cup ---
        let bottomIdx = leftRim;
        let bottomPrice = Infinity;
        for (let i = leftRim + 1; i < rightRimIdx; i++) {
          if (slice[i].low < bottomPrice) {
            bottomPrice = slice[i].low;
            bottomIdx = i;
          }
        }

        // --- Cup depth validation ---
        const depth = rimLevel - bottomPrice;
        const depthPct = (depth / rimLevel) * 100;
        if (depthPct < CUP_MIN_DEPTH_PCT || depthPct > CUP_MAX_DEPTH_PCT) continue;

        // --- Bottom should be in the middle-ish area of the cup (not at edges) ---
        const cupMidpoint = leftRim + Math.floor(cupLen / 2);
        const distFromMid = Math.abs(bottomIdx - cupMidpoint);
        const maxDistFromMid = Math.floor(cupLen * 0.35);
        if (distFromMid > maxDistFromMid) continue;

        // --- Fit quadratic to verify U-shape ---
        const cupPoints: { x: number; y: number }[] = [];
        for (let i = leftRim; i <= rightRimIdx; i++) {
          cupPoints.push({ x: i - leftRim, y: slice[i].close });
        }
        const quad = quadraticFit(cupPoints);

        // For a U-shape: coefficient 'a' should be positive (parabola opens upward)
        if (quad.a <= 0) continue;

        // --- Check rounded bottom (NOT V-shaped) ---
        // Count how many candles are within 20% of the depth from the bottom
        const bottomThreshold = bottomPrice + depth * 0.2;
        let nearBottomCount = 0;
        for (let i = leftRim; i <= rightRimIdx; i++) {
          if (slice[i].low <= bottomThreshold) {
            nearBottomCount++;
          }
        }
        const bottomBarsRatio = nearBottomCount / cupLen;
        if (bottomBarsRatio < V_SHAPE_MIN_BOTTOM_BARS_RATIO) continue;

        // --- Handle detection ---
        const handleStart = rightRimIdx + 1;
        const maxHandleEnd = Math.min(
          handleStart + HANDLE_MAX_BARS - 1,
          slice.length - 1,
        );

        if (handleStart >= slice.length) continue;

        // Find the handle: small pullback after the right rim
        let handleEnd = Math.min(handleStart + HANDLE_MIN_BARS - 1, maxHandleEnd);
        let handleLow = Infinity;
        let handleHigh = -Infinity;

        // Extend handle to find the best fit (up to HANDLE_MAX_BARS)
        for (let i = handleStart; i <= maxHandleEnd; i++) {
          if (slice[i].low < handleLow) handleLow = slice[i].low;
          if (slice[i].high > handleHigh) handleHigh = slice[i].high;
          handleEnd = i;
        }

        const handleLen = handleEnd - handleStart + 1;
        if (handleLen < HANDLE_MIN_BARS) continue;

        // Handle should pull back from the rim level
        const handleRetrace = rimLevel - handleLow;
        const handleRetracePct = depth > 0 ? (handleRetrace / depth) * 100 : 0;

        if (handleRetracePct < HANDLE_MIN_RETRACE_PCT || handleRetracePct > HANDLE_MAX_RETRACE_PCT) {
          continue;
        }

        // Handle should drift slightly downward or sideways
        const handlePoints: { x: number; y: number }[] = [];
        for (let i = handleStart; i <= handleEnd; i++) {
          handlePoints.push({ x: i - handleStart, y: slice[i].close });
        }
        const handleReg = linearRegression(handlePoints);
        const handleAvgPrice =
          handlePoints.reduce((s, p) => s + p.y, 0) / handlePoints.length;
        const normHandleSlope =
          handleAvgPrice > 0 ? handleReg.slope / handleAvgPrice : 0;

        // Handle should not be strongly rising
        if (normHandleSlope > 0.005) continue;

        // --- Score this candidate ---
        const quadScore = Math.min(1, quad.rSquared); // Goodness of U-shape fit
        const depthScore = depthPct >= 15 && depthPct <= 30 ? 1.0 : 0.6;
        const roundnessScore = Math.min(1, bottomBarsRatio / 0.4);
        const rimSymmetryScore = isPriceNear(leftRimPrice, rightRimPrice, 1) ? 1.0 : 0.7;
        const handleRetraceScore = handleRetracePct >= 10 && handleRetracePct <= 35 ? 1.0 : 0.6;

        const score =
          quadScore * 0.25 +
          depthScore * 0.15 +
          roundnessScore * 0.25 +
          rimSymmetryScore * 0.15 +
          handleRetraceScore * 0.2;

        if (score > bestScore) {
          bestScore = score;
          bestCup = {
            leftRimIdx: leftRim,
            rightRimIdx: rightRimIdx,
            bottomIdx,
            rimLevel,
            bottomLevel: bottomPrice,
            depth,
            depthPct,
            quadA: quad.a,
            quadRSquared: quad.rSquared,
            bottomBarsRatio,
          };
          bestHandle = {
            startIdx: handleStart,
            endIdx: handleEnd,
            handleLow,
            handleHigh,
            handleRetracePct,
          };
        }
      }
    }

    // ----- No valid pattern found -----
    if (!bestCup || !bestHandle || bestScore < 0.35) return noDetection();

    // ----- Step 2: Prior uptrend into the cup + CONFIRMED rim breakout -----
    // A cup & handle is a continuation pattern: it needs a prior advance, then a
    // confirmed close above the rim. (Was: fired within ~5% below the rim with no
    // prior-trend requirement.)
    const offset = candles.length - lookback;
    if (!hasPriorUptrend(candles, offset + bestCup.leftRimIdx, 20, 8)) return noDetection();

    const lastSliceIdx = slice.length - 1;
    const currentPrice = slice[lastSliceIdx].close;
    const prevClose = slice[lastSliceIdx - 1].close;
    if (!confirmedBreakUp(currentPrice, prevClose, bestCup.rimLevel, bestCup.rimLevel)) {
      return noDetection();
    }
    const proximityToBreakout = 1.0;

    // ----- Step 3: Volume analysis -----
    // Volume should be higher at rims and lower at bottom
    let leftRimVol = 0;
    let bottomVol = 0;
    let rightRimVol = 0;
    const rimWindow = 3;

    for (let i = Math.max(0, bestCup.leftRimIdx - rimWindow); i <= Math.min(slice.length - 1, bestCup.leftRimIdx + rimWindow); i++) {
      leftRimVol += slice[i].volume;
    }
    leftRimVol /= (2 * rimWindow + 1);

    const bottomStart = Math.max(0, bestCup.bottomIdx - rimWindow);
    const bottomEnd = Math.min(slice.length - 1, bestCup.bottomIdx + rimWindow);
    for (let i = bottomStart; i <= bottomEnd; i++) {
      bottomVol += slice[i].volume;
    }
    bottomVol /= (bottomEnd - bottomStart + 1);

    for (let i = Math.max(0, bestCup.rightRimIdx - rimWindow); i <= Math.min(slice.length - 1, bestCup.rightRimIdx + rimWindow); i++) {
      rightRimVol += slice[i].volume;
    }
    rightRimVol /= (2 * rimWindow + 1);

    const volumePatternGood =
      bottomVol < leftRimVol * 0.9 && bottomVol < rightRimVol * 0.9;

    // Volume during handle
    const handleVolDecreasing = isVolumeDecreasing(
      slice,
      bestHandle.startIdx,
      bestHandle.endIdx,
    );

    // ----- Step 4: Trend alignment -----
    const ema9 = last(indicators.ema9);
    const ema21 = last(indicators.ema21);
    const ema50 = last(indicators.ema50);
    let trendAlignment = 0.5;
    if (ema9 !== undefined && ema21 !== undefined) {
      if (ema9 > ema21) trendAlignment = 0.8;
      if (ema50 !== undefined && ema9 > ema50) trendAlignment = 0.95;
    }

    // ----- Step 5: Volume confirmation (current) -----
    const volRatio = last(indicators.volumeRatios);
    let volumeConfirmation = 0.5;
    if (volRatio !== undefined) {
      volumeConfirmation = volRatio >= 1.5 ? 1.0 : volRatio >= 1.0 ? 0.7 : 0.4;
    }
    // Boost if the overall volume pattern is correct
    if (volumePatternGood) {
      volumeConfirmation = Math.min(1, volumeConfirmation + 0.15);
    }

    // ----- Step 6: Signal strength -----
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

    // ----- Step 7: Trade levels -----
    const entryPrice = bestCup.rimLevel; // breakout above the rim
    const stopLoss = bestHandle.handleLow; // stop below handle bottom
    const target1 = entryPrice + bestCup.depth; // measured move = cup depth
    const target2 = entryPrice + bestCup.depth * 1.5;
    const riskRewardRatio = calculateRiskReward(entryPrice, stopLoss, target1);

    return {
      detected: true,
      patternName: 'cup_and_handle',
      category: 'chart',
      direction: 'bullish',
      signalStrength: parseFloat(signalStrength.toFixed(3)),
      confidence,
      entryPrice: parseFloat(entryPrice.toFixed(2)),
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      target1: parseFloat(target1.toFixed(2)),
      target2: parseFloat(target2.toFixed(2)),
      riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
      patternData: {
        cupLeftRimIdx: bestCup.leftRimIdx,
        cupRightRimIdx: bestCup.rightRimIdx,
        cupBottomIdx: bestCup.bottomIdx,
        rimLevel: parseFloat(bestCup.rimLevel.toFixed(2)),
        cupBottom: parseFloat(bestCup.bottomLevel.toFixed(2)),
        cupDepth: parseFloat(bestCup.depth.toFixed(2)),
        cupDepthPct: parseFloat(bestCup.depthPct.toFixed(2)),
        cupDuration: bestCup.rightRimIdx - bestCup.leftRimIdx,
        quadraticCoeffA: parseFloat(bestCup.quadA.toFixed(8)),
        quadraticRSquared: parseFloat(bestCup.quadRSquared.toFixed(3)),
        bottomBarsRatio: parseFloat(bestCup.bottomBarsRatio.toFixed(3)),
        handleStartIdx: bestHandle.startIdx,
        handleEndIdx: bestHandle.endIdx,
        handleLow: parseFloat(bestHandle.handleLow.toFixed(2)),
        handleHigh: parseFloat(bestHandle.handleHigh.toFixed(2)),
        handleRetracePct: parseFloat(bestHandle.handleRetracePct.toFixed(2)),
        handleDuration: bestHandle.endIdx - bestHandle.startIdx + 1,
        volumePatternGood,
        handleVolumeDecreasing: handleVolDecreasing,
        proximityToBreakout: parseFloat(proximityToBreakout.toFixed(3)),
        currentPrice: parseFloat(currentPrice.toFixed(2)),
      },
    };
  },
};
