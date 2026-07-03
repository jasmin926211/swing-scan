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
  computeSignalStrength,
  calculateRiskReward,
  confirmedBreakDown,
  hasPriorUptrend,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME = 'double_top';
const CATEGORY: PatternCategory = 'chart';
const DIRECTION: PatternDirection = 'bearish';

/** Minimum candles required. */
const MIN_CANDLES = 30;
/** Maximum lookback window. */
const MAX_LOOKBACK = 70;

/** The two tops must be within this percentage of each other. */
const TOP_TOLERANCE_PCT = 3;
/** Minimum bars between the two tops. */
const MIN_BARS_BETWEEN_TOPS = 10;
/** Maximum bars between the two tops. */
const MAX_BARS_BETWEEN_TOPS = 40;
/** The neckline trough must be at least this % below the top level. */
const MIN_NECKLINE_DIP_PCT = 5;

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

export const doubleTopDetector: PatternDetector = {
  name: NAME,
  category: CATEGORY,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    if (candles.length < MIN_CANDLES) return noDetection();

    const lookback = Math.min(candles.length, MAX_LOOKBACK);
    const windowCandles = candles.slice(-lookback);
    const offset = candles.length - lookback;

    // ----- Step 1: Find pivot highs -----
    const pivotHighs = findPivotHighs(windowCandles, 3, 3);
    if (pivotHighs.length < 2) return noDetection();

    // ----- Step 2: Search for a valid pair of tops (most recent first) -----
    let bestTop1: { index: number; price: number } | null = null;
    let bestTop2: { index: number; price: number } | null = null;
    let bestNecklinePrice = 0;
    let bestNecklineIdx = -1;

    for (let j = pivotHighs.length - 1; j >= 1; j--) {
      for (let i = j - 1; i >= 0; i--) {
        const t1 = pivotHighs[i]; // first top (earlier)
        const t2 = pivotHighs[j]; // second top (later)

        const barsBetween = t2.index - t1.index;
        if (barsBetween < MIN_BARS_BETWEEN_TOPS || barsBetween > MAX_BARS_BETWEEN_TOPS) {
          continue;
        }

        if (!isPriceNear(t1.price, t2.price, TOP_TOLERANCE_PCT)) {
          continue;
        }

        // ----- Step 3: Find the neckline trough between the two tops -----
        const troughsBetween = findPivotLows(
          windowCandles.slice(t1.index, t2.index + 1),
          2,
          2,
        );
        const adjustedTroughs = troughsBetween.map((p) => ({
          index: p.index + t1.index,
          price: p.price,
        }));

        if (adjustedTroughs.length === 0) continue;

        // Pick the lowest trough as the neckline
        const necklinePivot = adjustedTroughs.reduce((best, p) =>
          p.price < best.price ? p : best,
        );

        const topLevel = (t1.price + t2.price) / 2;
        const necklineDipPct =
          ((topLevel - necklinePivot.price) / topLevel) * 100;

        if (necklineDipPct < MIN_NECKLINE_DIP_PCT) continue;

        bestTop1 = t1;
        bestTop2 = t2;
        bestNecklinePrice = necklinePivot.price;
        bestNecklineIdx = necklinePivot.index;
        break;
      }
      if (bestTop1) break;
    }

    if (!bestTop1 || !bestTop2) return noDetection();

    // ----- Step 4: Require prior uptrend + a CONFIRMED neckline breakdown -----
    const t1OrigIdx = bestTop1.index + offset;
    const t2OrigIdx = bestTop2.index + offset;
    const topLevel = (bestTop1.price + bestTop2.price) / 2;
    const patternHeight = topLevel - bestNecklinePrice;

    // Context gate: a double top must cap an advance, not appear mid-range or in a
    // downtrend. (This was previously only a soft score nudge.)
    if (!hasPriorUptrend(candles, t1OrigIdx, 20, 6)) return noDetection();

    // Confirmation gate: the last bar must CLOSE below the neckline having been
    // at/above it on the prior bar — a fresh, confirmed breakdown. This replaces the
    // old "within 3% above the neckline, no lower bound" test that fired both before
    // the break AND long after price had already collapsed through it (stale signals).
    const lastIdx = candles.length - 1;
    const lastClose = candles[lastIdx].close;
    const prevClose = candles[lastIdx - 1].close;
    if (!confirmedBreakDown(lastClose, prevClose, bestNecklinePrice, bestNecklinePrice)) {
      return noDetection();
    }
    const currentPrice = lastClose;

    // ----- Step 5: Volume analysis -----
    const vol1 = candles[t1OrigIdx]?.volume ?? 0;
    const vol2 = candles[t2OrigIdx]?.volume ?? 0;
    // Volume typically lower on second top (bearish divergence)
    const volumeConfirmation = vol2 < vol1 ? 0.9 : 0.5;

    const latestVolRatio =
      indicators.volumeRatios.length > 0
        ? indicators.volumeRatios[indicators.volumeRatios.length - 1]
        : 1;
    const breakoutVolumeScore = Math.min(1, latestVolRatio / 1.5);

    // ----- Step 6: Confidence factors -----
    const symmetryPct =
      1 - Math.abs(bestTop1.price - bestTop2.price) / topLevel;

    const proximityToBreakout =
      currentPrice <= bestNecklinePrice
        ? 1.0
        : Math.max(0, 1 - (currentPrice - bestNecklinePrice) / patternHeight);

    const patternConfidence = Math.min(1, (symmetryPct + 0.8) / 1.8);

    // Trend alignment: prior uptrend into the pattern supports bearish reversal
    let trendAlignment = 0.5;
    if (indicators.ema50.length >= 10) {
      const recentEma50 = indicators.ema50[indicators.ema50.length - 1];
      const olderEma50 = indicators.ema50[indicators.ema50.length - 10];
      if (olderEma50 < recentEma50) {
        trendAlignment = 0.8; // prior uptrend -- good for bearish reversal
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
    const stopLoss = parseFloat((bestTop2.price * 1.01).toFixed(2)); // just above second top
    const target1 = parseFloat((bestNecklinePrice - patternHeight).toFixed(2));
    const target2 = parseFloat(
      (bestNecklinePrice - 1.5 * patternHeight).toFixed(2),
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
        top1: {
          index: t1OrigIdx,
          price: bestTop1.price,
        },
        top2: {
          index: t2OrigIdx,
          price: bestTop2.price,
        },
        necklinePrice: bestNecklinePrice,
        necklineIndex: bestNecklineIdx + offset,
        topLevel,
        patternHeight,
        symmetryPct: parseFloat(symmetryPct.toFixed(4)),
        barsBetweenTops: bestTop2.index - bestTop1.index,
        volumeTop1: vol1,
        volumeTop2: vol2,
        volumeDecliningOnSecondTop: vol2 < vol1,
        currentPrice,
        priceBelowNeckline: currentPrice <= bestNecklinePrice,
      },
    };
  },
};
