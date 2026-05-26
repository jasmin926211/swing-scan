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
  computeSignalStrength,
  calculateRiskReward,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME = 'double_bottom';
const CATEGORY: PatternCategory = 'chart';
const DIRECTION: PatternDirection = 'bullish';

/** Minimum candles required to scan for the pattern. */
const MIN_CANDLES = 30;
/** Maximum lookback window. */
const MAX_LOOKBACK = 70;

/** The two bottoms must be within this percentage of each other. */
const BOTTOM_TOLERANCE_PCT = 3;
/** Minimum number of bars between the two bottoms. */
const MIN_BARS_BETWEEN_BOTTOMS = 10;
/** Maximum number of bars between the two bottoms. */
const MAX_BARS_BETWEEN_BOTTOMS = 40;
/** The neckline peak must be at least this % above the bottom level. */
const MIN_NECKLINE_RISE_PCT = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a "not detected" result. */
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

export const doubleBottomDetector: PatternDetector = {
  name: NAME,
  category: CATEGORY,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    if (candles.length < MIN_CANDLES) return noDetection();

    // Determine the working window
    const lookback = Math.min(candles.length, MAX_LOOKBACK);
    const windowCandles = candles.slice(-lookback);
    const offset = candles.length - lookback; // to map back to original indices

    // ----- Step 1: Find pivot lows in the window -----
    const pivotLows = findPivotLows(windowCandles, 3, 3);
    if (pivotLows.length < 2) return noDetection();

    // ----- Step 2: Search for a valid pair of bottoms -----
    // Iterate from the most recent pair backwards so we detect the freshest pattern.
    let bestBottom1: { index: number; price: number } | null = null;
    let bestBottom2: { index: number; price: number } | null = null;
    let bestNecklinePrice = 0;
    let bestNecklineIdx = -1;

    for (let j = pivotLows.length - 1; j >= 1; j--) {
      for (let i = j - 1; i >= 0; i--) {
        const b1 = pivotLows[i]; // first bottom (earlier)
        const b2 = pivotLows[j]; // second bottom (later)

        // Check bar separation
        const barsBetween = b2.index - b1.index;
        if (barsBetween < MIN_BARS_BETWEEN_BOTTOMS || barsBetween > MAX_BARS_BETWEEN_BOTTOMS) {
          continue;
        }

        // Check that the two bottoms are at approximately the same level
        if (!isPriceNear(b1.price, b2.price, BOTTOM_TOLERANCE_PCT)) {
          continue;
        }

        // ----- Step 3: Find the neckline peak between the two bottoms -----
        const peaksBetween = findPivotHighs(
          windowCandles.slice(b1.index, b2.index + 1),
          2,
          2,
        );
        // Remap indices relative to windowCandles
        const adjustedPeaks = peaksBetween.map((p) => ({
          index: p.index + b1.index,
          price: p.price,
        }));

        if (adjustedPeaks.length === 0) continue;

        // Pick the highest peak as the neckline
        const necklinePivot = adjustedPeaks.reduce((best, p) =>
          p.price > best.price ? p : best,
        );

        const bottomLevel = (b1.price + b2.price) / 2;
        const necklineRisePct =
          ((necklinePivot.price - bottomLevel) / bottomLevel) * 100;

        if (necklineRisePct < MIN_NECKLINE_RISE_PCT) continue;

        // Valid pair found -- take the most recent one
        bestBottom1 = b1;
        bestBottom2 = b2;
        bestNecklinePrice = necklinePivot.price;
        bestNecklineIdx = necklinePivot.index;
        break; // found the best pair for this j
      }
      if (bestBottom1) break; // stop outer loop too
    }

    if (!bestBottom1 || !bestBottom2) return noDetection();

    // ----- Step 4: Assess current price relative to neckline -----
    const currentPrice = windowCandles[windowCandles.length - 1].close;
    const bottomLevel = (bestBottom1.price + bestBottom2.price) / 2;
    const patternHeight = bestNecklinePrice - bottomLevel;

    // Price should be approaching or above the neckline (within 3% below is ok)
    const nearNeckline = currentPrice >= bestNecklinePrice * 0.97;
    if (!nearNeckline) return noDetection();

    // ----- Step 5: Volume analysis -----
    // Ideally volume is higher on the second bottom than the first
    const b1OrigIdx = bestBottom1.index + offset;
    const b2OrigIdx = bestBottom2.index + offset;
    const vol1 = candles[b1OrigIdx]?.volume ?? 0;
    const vol2 = candles[b2OrigIdx]?.volume ?? 0;
    const volumeConfirmation = vol2 > vol1 ? 0.9 : 0.5;

    // Check overall volume ratio on the most recent bar
    const latestVolRatio =
      indicators.volumeRatios.length > 0
        ? indicators.volumeRatios[indicators.volumeRatios.length - 1]
        : 1;
    const breakoutVolumeScore = Math.min(1, latestVolRatio / 1.5);

    // ----- Step 6: Confidence factors -----
    // How symmetric are the bottoms?
    const symmetryPct =
      1 - Math.abs(bestBottom1.price - bestBottom2.price) / bottomLevel;

    // How close is current price to neckline?
    const proximityToBreakout =
      currentPrice >= bestNecklinePrice
        ? 1.0
        : Math.max(0, 1 - (bestNecklinePrice - currentPrice) / patternHeight);

    // Pattern confidence from symmetry and neckline definition
    const patternConfidence = Math.min(1, (symmetryPct + 0.8) / 1.8);

    // Trend alignment: is price in a larger downtrend leading into the pattern?
    // Check if EMA50 was declining (supportive of reversal)
    let trendAlignment = 0.5; // neutral default
    if (indicators.ema50.length >= 10) {
      const recentEma50 = indicators.ema50[indicators.ema50.length - 1];
      const olderEma50 = indicators.ema50[indicators.ema50.length - 10];
      if (olderEma50 > recentEma50) {
        trendAlignment = 0.8; // prior downtrend -- good for bullish reversal
      }
    }

    const signalStrength = computeSignalStrength({
      patternConfidence,
      volumeConfirmation: (volumeConfirmation + breakoutVolumeScore) / 2,
      trendAlignment,
      proximityToBreakout,
    });

    const confidence = parseFloat(
      ((patternConfidence * 0.5 + symmetryPct * 0.3 + volumeConfirmation * 0.2)).toFixed(3),
    );

    // ----- Step 7: Trade levels -----
    const entryPrice = parseFloat(bestNecklinePrice.toFixed(2));
    const stopLoss = parseFloat((bestBottom2.price * 0.99).toFixed(2)); // just below second bottom
    const target1 = parseFloat((bestNecklinePrice + patternHeight).toFixed(2));
    const target2 = parseFloat(
      (bestNecklinePrice + 1.5 * patternHeight).toFixed(2),
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
        bottom1: {
          index: b1OrigIdx,
          price: bestBottom1.price,
        },
        bottom2: {
          index: b2OrigIdx,
          price: bestBottom2.price,
        },
        necklinePrice: bestNecklinePrice,
        necklineIndex: bestNecklineIdx + offset,
        bottomLevel,
        patternHeight,
        symmetryPct: parseFloat(symmetryPct.toFixed(4)),
        barsBetweenBottoms: bestBottom2.index - bestBottom1.index,
        volumeBottom1: vol1,
        volumeBottom2: vol2,
        volumeIncreasingOnSecondBottom: vol2 > vol1,
        currentPrice,
        priceAboveNeckline: currentPrice >= bestNecklinePrice,
      },
    };
  },
};
