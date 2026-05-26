import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternDetector,
  PatternCategory,
  PatternDirection,
} from '@/types/pattern';
import {
  findPivotLows,
  findPivotHighs,
  isPriceNear,
  fitTrendline,
  computeSignalStrength,
  calculateRiskReward,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME = 'inverse_head_and_shoulders';
const CATEGORY: PatternCategory = 'chart';
const DIRECTION: PatternDirection = 'bullish';

/** Minimum candles required. */
const MIN_CANDLES = 40;
/** Maximum lookback window. */
const MAX_LOOKBACK = 80;

/** Left and right shoulder must be within this % of each other. */
const SHOULDER_TOLERANCE_PCT = 5;
/** Head must be at least this % below the lower shoulder. */
const MIN_HEAD_DEPTH_PCT = 2;

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

/**
 * Find the highest high between two bar indices (exclusive).
 */
function findPeakBetween(
  candles: CandleData[],
  startIdx: number,
  endIdx: number,
): { index: number; price: number } | null {
  if (startIdx >= endIdx || startIdx < 0 || endIdx >= candles.length) return null;

  let maxIdx = startIdx + 1;
  let maxPrice = -Infinity;

  for (let i = startIdx + 1; i < endIdx; i++) {
    if (candles[i].high > maxPrice) {
      maxPrice = candles[i].high;
      maxIdx = i;
    }
  }

  if (maxPrice === -Infinity) return null;
  return { index: maxIdx, price: maxPrice };
}

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

export const inverseHeadAndShouldersDetector: PatternDetector = {
  name: NAME,
  category: CATEGORY,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    if (candles.length < MIN_CANDLES) return noDetection();

    const lookback = Math.min(candles.length, MAX_LOOKBACK);
    const windowCandles = candles.slice(-lookback);
    const offset = candles.length - lookback;

    // ----- Step 1: Find all pivot lows -----
    const pivotLows = findPivotLows(windowCandles, 3, 3);
    if (pivotLows.length < 3) return noDetection();

    // ----- Step 2: Search for valid L-Shoulder / Head / R-Shoulder triplet -----
    let bestLS: { index: number; price: number } | null = null;
    let bestHead: { index: number; price: number } | null = null;
    let bestRS: { index: number; price: number } | null = null;
    let bestPeak1: { index: number; price: number } | null = null;
    let bestPeak2: { index: number; price: number } | null = null;

    for (let k = pivotLows.length - 1; k >= 2; k--) {
      for (let j = k - 1; j >= 1; j--) {
        for (let i = j - 1; i >= 0; i--) {
          const ls = pivotLows[i]; // left shoulder (higher low)
          const head = pivotLows[j]; // head (lowest low)
          const rs = pivotLows[k]; // right shoulder (higher low)

          // Head must be the lowest of the three
          if (head.price >= ls.price || head.price >= rs.price) continue;

          // Head must be at least MIN_HEAD_DEPTH_PCT below both shoulders
          const lowerShoulder = Math.min(ls.price, rs.price);
          const depthPct =
            ((lowerShoulder - head.price) / lowerShoulder) * 100;
          if (depthPct < MIN_HEAD_DEPTH_PCT) continue;

          // Shoulders should be at approximately the same level
          if (!isPriceNear(ls.price, rs.price, SHOULDER_TOLERANCE_PCT)) continue;

          // Ensure reasonable spacing
          if (head.index - ls.index < 5 || rs.index - head.index < 5) continue;

          // Find peaks (neckline points) between LS-Head and Head-RS
          const peak1 = findPeakBetween(windowCandles, ls.index, head.index);
          const peak2 = findPeakBetween(windowCandles, head.index, rs.index);
          if (!peak1 || !peak2) continue;

          bestLS = ls;
          bestHead = head;
          bestRS = rs;
          bestPeak1 = peak1;
          bestPeak2 = peak2;
          break;
        }
        if (bestLS) break;
      }
      if (bestLS) break;
    }

    if (!bestLS || !bestHead || !bestRS || !bestPeak1 || !bestPeak2) {
      return noDetection();
    }

    // ----- Step 3: Compute neckline through the two peaks -----
    const necklineTrendline = fitTrendline([bestPeak1, bestPeak2]);
    const currentBarIdx = windowCandles.length - 1;
    const necklineAtCurrent = necklineTrendline
      ? necklineTrendline.slope * currentBarIdx + necklineTrendline.intercept
      : (bestPeak1.price + bestPeak2.price) / 2;

    // Neckline at head index for pattern height
    const necklineAtHead = necklineTrendline
      ? necklineTrendline.slope * bestHead.index + necklineTrendline.intercept
      : (bestPeak1.price + bestPeak2.price) / 2;

    const patternHeight = necklineAtHead - bestHead.price;

    // ----- Step 4: Check current price relative to neckline -----
    const currentPrice = windowCandles[windowCandles.length - 1].close;

    // Price must be near or above the neckline (within 3% below is ok)
    if (currentPrice < necklineAtCurrent * 0.97) return noDetection();

    // ----- Step 5: Volume analysis -----
    // Ideal iH&S: volume increases through the pattern (especially on breakout)
    const lsOrigIdx = bestLS.index + offset;
    const headOrigIdx = bestHead.index + offset;
    const rsOrigIdx = bestRS.index + offset;

    const volLS = candles[lsOrigIdx]?.volume ?? 0;
    const volHead = candles[headOrigIdx]?.volume ?? 0;
    const volRS = candles[rsOrigIdx]?.volume ?? 0;

    let volumeScore = 0.5;
    if (volRS > volHead && volHead > volLS) {
      volumeScore = 1.0; // ideal increasing volume
    } else if (volRS > volLS) {
      volumeScore = 0.7; // partially increasing
    }

    const latestVolRatio =
      indicators.volumeRatios.length > 0
        ? indicators.volumeRatios[indicators.volumeRatios.length - 1]
        : 1;
    const breakoutVolumeScore = Math.min(1, latestVolRatio / 1.5);

    // ----- Step 6: Confidence metrics -----
    const shoulderSymmetry =
      1 - Math.abs(bestLS.price - bestRS.price) / ((bestLS.price + bestRS.price) / 2);

    const proximityToBreakout =
      currentPrice >= necklineAtCurrent
        ? 1.0
        : Math.max(
            0,
            1 - (necklineAtCurrent - currentPrice) / patternHeight,
          );

    const patternConfidence = Math.min(
      1,
      (shoulderSymmetry * 0.4 + (necklineTrendline?.rSquared ?? 0.5) * 0.3 + 0.3),
    );

    // Trend alignment: prior downtrend favors bullish reversal
    let trendAlignment = 0.5;
    if (indicators.ema50.length >= 10) {
      const recentEma50 = indicators.ema50[indicators.ema50.length - 1];
      const olderEma50 = indicators.ema50[indicators.ema50.length - 10];
      if (olderEma50 > recentEma50) {
        trendAlignment = 0.8; // prior downtrend supports bullish reversal
      }
    }

    const signalStrength = computeSignalStrength({
      patternConfidence,
      volumeConfirmation: (volumeScore + breakoutVolumeScore) / 2,
      trendAlignment,
      proximityToBreakout,
    });

    const confidence = parseFloat(
      (
        patternConfidence * 0.4 +
        shoulderSymmetry * 0.3 +
        volumeScore * 0.3
      ).toFixed(3),
    );

    // ----- Step 7: Trade levels -----
    const entryPrice = parseFloat(necklineAtCurrent.toFixed(2));
    const stopLoss = parseFloat((bestRS.price * 0.99).toFixed(2)); // below right shoulder
    const target1 = parseFloat((necklineAtCurrent + patternHeight).toFixed(2));
    const target2 = parseFloat(
      (necklineAtCurrent + 1.5 * patternHeight).toFixed(2),
    );
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
        leftShoulder: {
          index: lsOrigIdx,
          price: bestLS.price,
        },
        head: {
          index: headOrigIdx,
          price: bestHead.price,
        },
        rightShoulder: {
          index: rsOrigIdx,
          price: bestRS.price,
        },
        peak1: {
          index: bestPeak1.index + offset,
          price: bestPeak1.price,
        },
        peak2: {
          index: bestPeak2.index + offset,
          price: bestPeak2.price,
        },
        necklineSlope: necklineTrendline?.slope ?? 0,
        necklineIntercept: necklineTrendline?.intercept ?? 0,
        necklineRSquared: necklineTrendline?.rSquared ?? 0,
        necklineAtCurrent: parseFloat(necklineAtCurrent.toFixed(2)),
        patternHeight: parseFloat(patternHeight.toFixed(2)),
        shoulderSymmetry: parseFloat(shoulderSymmetry.toFixed(4)),
        volumeLeftShoulder: volLS,
        volumeHead: volHead,
        volumeRightShoulder: volRS,
        volumeIncreasing: volRS > volHead && volHead > volLS,
        currentPrice,
        priceAboveNeckline: currentPrice >= necklineAtCurrent,
      },
    };
  },
};
