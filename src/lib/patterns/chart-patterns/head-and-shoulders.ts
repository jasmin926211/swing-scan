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
  isPriceNear,
  fitTrendline,
  computeSignalStrength,
  calculateRiskReward,
  confirmedBreakDown,
  hasPriorUptrend,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME = 'head_and_shoulders';
const CATEGORY: PatternCategory = 'chart';
const DIRECTION: PatternDirection = 'bearish';

/** Minimum candles required to scan for the pattern. */
const MIN_CANDLES = 40;
/** Maximum lookback window. */
const MAX_LOOKBACK = 80;

/** Left and right shoulder must be within this % of each other. */
const SHOULDER_TOLERANCE_PCT = 5;
/** Head must be at least this % above the higher shoulder. */
const MIN_HEAD_ELEVATION_PCT = 2;

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
 * Given the window candles, find the lowest low between two indices (exclusive).
 * Returns the index and price of that trough.
 */
function findTroughBetween(
  candles: CandleData[],
  startIdx: number,
  endIdx: number,
): { index: number; price: number } | null {
  if (startIdx >= endIdx || startIdx < 0 || endIdx >= candles.length) return null;

  let minIdx = startIdx + 1;
  let minPrice = Infinity;

  for (let i = startIdx + 1; i < endIdx; i++) {
    if (candles[i].low < minPrice) {
      minPrice = candles[i].low;
      minIdx = i;
    }
  }

  if (minPrice === Infinity) return null;
  return { index: minIdx, price: minPrice };
}

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

export const headAndShouldersDetector: PatternDetector = {
  name: NAME,
  category: CATEGORY,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    if (candles.length < MIN_CANDLES) return noDetection();

    const lookback = Math.min(candles.length, MAX_LOOKBACK);
    const windowCandles = candles.slice(-lookback);
    const offset = candles.length - lookback;

    // ----- Step 1: Find all pivot highs -----
    const pivotHighs = findPivotHighs(windowCandles, 3, 3);
    if (pivotHighs.length < 3) return noDetection();

    // ----- Step 2: Search for valid L-Shoulder / Head / R-Shoulder triplet -----
    // Try combinations from the most recent backwards.
    let bestLS: { index: number; price: number } | null = null;
    let bestHead: { index: number; price: number } | null = null;
    let bestRS: { index: number; price: number } | null = null;
    let bestTrough1: { index: number; price: number } | null = null;
    let bestTrough2: { index: number; price: number } | null = null;

    for (let k = pivotHighs.length - 1; k >= 2; k--) {
      for (let j = k - 1; j >= 1; j--) {
        for (let i = j - 1; i >= 0; i--) {
          const ls = pivotHighs[i]; // left shoulder
          const head = pivotHighs[j]; // head
          const rs = pivotHighs[k]; // right shoulder

          // Head must be the highest of the three
          if (head.price <= ls.price || head.price <= rs.price) continue;

          // Head must be at least MIN_HEAD_ELEVATION_PCT above both shoulders
          const higherShoulder = Math.max(ls.price, rs.price);
          const elevationPct =
            ((head.price - higherShoulder) / higherShoulder) * 100;
          if (elevationPct < MIN_HEAD_ELEVATION_PCT) continue;

          // Shoulders should be at approximately the same level
          if (!isPriceNear(ls.price, rs.price, SHOULDER_TOLERANCE_PCT)) continue;

          // Ensure reasonable spacing: each leg should be at least 5 bars
          if (head.index - ls.index < 5 || rs.index - head.index < 5) continue;

          // Find troughs between LS-Head and Head-RS
          const trough1 = findTroughBetween(windowCandles, ls.index, head.index);
          const trough2 = findTroughBetween(windowCandles, head.index, rs.index);
          if (!trough1 || !trough2) continue;

          bestLS = ls;
          bestHead = head;
          bestRS = rs;
          bestTrough1 = trough1;
          bestTrough2 = trough2;
          break; // found best for this k
        }
        if (bestLS) break;
      }
      if (bestLS) break;
    }

    if (!bestLS || !bestHead || !bestRS || !bestTrough1 || !bestTrough2) {
      return noDetection();
    }

    // ----- Step 3: Compute neckline -----
    const necklineTrendline = fitTrendline([bestTrough1, bestTrough2]);
    // Neckline value at the current bar
    const currentBarIdx = windowCandles.length - 1;
    const necklineAtCurrent = necklineTrendline
      ? necklineTrendline.slope * currentBarIdx + necklineTrendline.intercept
      : (bestTrough1.price + bestTrough2.price) / 2;

    // Neckline at the head index (for pattern height measurement)
    const necklineAtHead = necklineTrendline
      ? necklineTrendline.slope * bestHead.index + necklineTrendline.intercept
      : (bestTrough1.price + bestTrough2.price) / 2;

    const patternHeight = bestHead.price - necklineAtHead;

    // ----- Step 4: Prior uptrend + CONFIRMED neckline breakdown -----
    // H&S is a reversal: it must cap an advance, and only triggers on a confirmed
    // close below the (sloped) neckline. (Was "within 3% above the neckline" — which
    // fired before the break AND long after price had already collapsed through it.)
    if (!hasPriorUptrend(candles, bestLS.index + offset, 20, 6)) return noDetection();

    const lastWinIdx = windowCandles.length - 1;
    const currentPrice = windowCandles[lastWinIdx].close;
    const prevClose = windowCandles[lastWinIdx - 1].close;
    const necklineAtPrev = necklineTrendline
      ? necklineTrendline.slope * (lastWinIdx - 1) + necklineTrendline.intercept
      : necklineAtCurrent;
    if (!confirmedBreakDown(currentPrice, prevClose, necklineAtCurrent, necklineAtPrev)) {
      return noDetection();
    }

    // ----- Step 5: Volume analysis -----
    // Classic H&S: volume decreases from left shoulder to head to right shoulder
    const lsOrigIdx = bestLS.index + offset;
    const headOrigIdx = bestHead.index + offset;
    const rsOrigIdx = bestRS.index + offset;

    const volLS = candles[lsOrigIdx]?.volume ?? 0;
    const volHead = candles[headOrigIdx]?.volume ?? 0;
    const volRS = candles[rsOrigIdx]?.volume ?? 0;

    let volumeScore = 0.5; // neutral
    if (volLS > volHead && volHead > volRS) {
      volumeScore = 1.0; // ideal declining volume pattern
    } else if (volLS > volRS) {
      volumeScore = 0.7; // partially declining
    }

    // Breakout volume on current bar
    const latestVolRatio =
      indicators.volumeRatios.length > 0
        ? indicators.volumeRatios[indicators.volumeRatios.length - 1]
        : 1;
    const breakoutVolumeScore = Math.min(1, latestVolRatio / 1.5);

    // ----- Step 6: Confidence metrics -----
    const shoulderSymmetry =
      1 - Math.abs(bestLS.price - bestRS.price) / ((bestLS.price + bestRS.price) / 2);

    // How close is current price to the neckline?
    const proximityToBreakout =
      currentPrice <= necklineAtCurrent
        ? 1.0
        : Math.max(
            0,
            1 - (currentPrice - necklineAtCurrent) / patternHeight,
          );

    const patternConfidence = Math.min(
      1,
      (shoulderSymmetry * 0.4 + (necklineTrendline?.rSquared ?? 0.5) * 0.3 + 0.3),
    );

    // Trend alignment: prior uptrend favors bearish reversal
    let trendAlignment = 0.5;
    if (indicators.ema50.length >= 10) {
      const recentEma50 = indicators.ema50[indicators.ema50.length - 1];
      const olderEma50 = indicators.ema50[indicators.ema50.length - 10];
      if (olderEma50 < recentEma50) {
        trendAlignment = 0.8;
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
    const stopLoss = parseFloat((bestRS.price * 1.01).toFixed(2)); // above right shoulder
    const target1 = parseFloat((necklineAtCurrent - patternHeight).toFixed(2));
    const target2 = parseFloat(
      (necklineAtCurrent - 1.5 * patternHeight).toFixed(2),
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
        trough1: {
          index: bestTrough1.index + offset,
          price: bestTrough1.price,
        },
        trough2: {
          index: bestTrough2.index + offset,
          price: bestTrough2.price,
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
        volumeDeclining: volLS > volHead && volHead > volRS,
        currentPrice,
        priceBelowNeckline: currentPrice <= necklineAtCurrent,
      },
    };
  },
};
