import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternDetector,
  PatternCategory,
  PatternDirection,
} from '@/types/pattern';
import {
  fitTrendline,
  findPivotHighs,
  findPivotLows,
  isPriceNear,
  isFlat,
  isVolumeDecreasing,
  computeSignalStrength,
  calculateRiskReward,
  confirmedBreakDown,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_CANDLES = 20;
const LOOKBACK = 60;
const MIN_PIVOT_HIGHS = 2;
const MIN_PIVOT_LOWS = 2;
const SUPPORT_TOLERANCE_PCT = 2; // Pivot lows must be within 2% of each other
const MAX_DESCENDING_SLOPE = -0.0001; // Maximum (most negative) slope for descending resistance

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noDetection(): PatternResult {
  return {
    detected: false,
    patternName: 'descending_triangle',
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
// Descending Triangle Detector
// ---------------------------------------------------------------------------

export const descendingTriangleDetector: PatternDetector = {
  name: 'descending_triangle',
  category: 'chart',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    // ----- Guard: minimum data -----
    if (candles.length < MIN_CANDLES) return noDetection();

    const lookback = Math.min(candles.length, LOOKBACK);
    const slice = candles.slice(-lookback);

    // ----- Step 1: Find pivot lows (flat support candidates) -----
    const pivotLows = findPivotLows(slice, 3, 3);
    if (pivotLows.length < MIN_PIVOT_LOWS) return noDetection();

    // ----- Step 2: Check if pivot lows form a flat support line -----
    const supportTrendline = fitTrendline(pivotLows);
    if (!supportTrendline) return noDetection();

    // The slope of the support line should be near zero (flat)
    const avgLowPrice =
      pivotLows.reduce((s, p) => s + p.price, 0) / pivotLows.length;
    const normSupportSlope =
      avgLowPrice > 0 ? supportTrendline.slope / avgLowPrice : 0;

    if (!isFlat(normSupportSlope, 0.002)) return noDetection();

    // All pivot lows should be within the tolerance percentage
    const supportLevel = avgLowPrice;
    const allLowsNear = pivotLows.every((p) =>
      isPriceNear(p.price, supportLevel, SUPPORT_TOLERANCE_PCT),
    );
    if (!allLowsNear) return noDetection();

    // ----- Step 3: Find pivot highs (descending resistance candidates) -----
    const pivotHighs = findPivotHighs(slice, 3, 3);
    if (pivotHighs.length < MIN_PIVOT_HIGHS) return noDetection();

    // ----- Step 4: Check if pivot highs form a descending line -----
    const resistanceTrendline = fitTrendline(pivotHighs);
    if (!resistanceTrendline) return noDetection();

    // Resistance slope should be negative (descending highs)
    if (resistanceTrendline.slope >= MAX_DESCENDING_SLOPE) return noDetection();

    // Verify that successive highs are actually lower
    let descendingHighsCount = 0;
    for (let i = 1; i < pivotHighs.length; i++) {
      if (pivotHighs[i].price < pivotHighs[i - 1].price) {
        descendingHighsCount++;
      }
    }
    // At least half of the transitions should be descending
    if (descendingHighsCount < Math.ceil((pivotHighs.length - 1) * 0.5)) {
      return noDetection();
    }

    // ----- Step 5: The two lines should converge (triangle shape) -----
    const firstIdx = Math.min(pivotHighs[0].index, pivotLows[0].index);
    const lastIdx = slice.length - 1;

    const resistanceAtFirst =
      resistanceTrendline.slope * firstIdx + resistanceTrendline.intercept;
    const supportAtFirst =
      supportTrendline.slope * firstIdx + supportTrendline.intercept;
    const gapAtFirst = resistanceAtFirst - supportAtFirst;

    const resistanceAtLast =
      resistanceTrendline.slope * lastIdx + resistanceTrendline.intercept;
    const supportAtLast =
      supportTrendline.slope * lastIdx + supportTrendline.intercept;
    const gapAtLast = resistanceAtLast - supportAtLast;

    // The gap must be shrinking (converging)
    if (gapAtLast >= gapAtFirst) return noDetection();

    // Ensure the lines haven't already crossed
    if (gapAtLast < 0) return noDetection();

    // ----- Step 6: Volume should generally decrease during formation -----
    const formationStart = firstIdx;
    const formationEnd = lastIdx;
    const volDecreasing = isVolumeDecreasing(slice, formationStart, formationEnd);

    // ----- Step 7: Require a CONFIRMED breakdown below the flat support -----
    // (Was: fired while price was merely within ~5% above the line.)
    const currentPrice = slice[lastIdx].close;
    const prevClose = slice[lastIdx - 1].close;
    if (!confirmedBreakDown(currentPrice, prevClose, supportLevel, supportLevel)) {
      return noDetection();
    }
    const proximityToBreakout = 1.0;

    // ----- Step 8: Pattern quality scoring -----
    const numTouches = pivotHighs.length + pivotLows.length;
    const touchScore = Math.min(1, numTouches / 8);

    const rSquaredScore =
      (resistanceTrendline.rSquared + supportTrendline.rSquared) / 2;

    const convergenceScore = gapAtFirst > 0
      ? Math.min(1, (gapAtFirst - gapAtLast) / gapAtFirst)
      : 0;

    const patternConfidence =
      touchScore * 0.3 + rSquaredScore * 0.3 + convergenceScore * 0.2 + (volDecreasing ? 0.2 : 0.05);

    // ----- Step 9: Trend alignment -----
    const ema9 = last(indicators.ema9);
    const ema21 = last(indicators.ema21);
    let trendAlignment = 0.5;
    if (ema9 !== undefined && ema21 !== undefined) {
      trendAlignment = ema9 < ema21 ? 0.9 : 0.3; // Bearish alignment
    }

    // ----- Step 10: Volume confirmation -----
    const volRatio = last(indicators.volumeRatios);
    let volumeConfirmation = 0.5;
    if (volRatio !== undefined) {
      volumeConfirmation = volRatio >= 1.5 ? 1.0 : volRatio >= 1.0 ? 0.7 : 0.4;
    }

    // ----- Step 11: Signal strength -----
    const signalStrength = computeSignalStrength({
      patternConfidence,
      volumeConfirmation,
      trendAlignment,
      proximityToBreakout,
    });

    const confidence = parseFloat(
      Math.min(1, (patternConfidence + proximityToBreakout + rSquaredScore) / 3).toFixed(3),
    );

    // ----- Step 12: Trade levels (bearish) -----
    const entryPrice = supportLevel; // breakdown below support
    const lastPivotHigh = pivotHighs[pivotHighs.length - 1];
    const stopLoss = lastPivotHigh.price; // stop above last pivot high

    // Triangle height: distance from support to the highest high
    const highestHigh = pivotHighs.reduce(
      (max, p) => (p.price > max ? p.price : max),
      -Infinity,
    );
    const triangleHeight = highestHigh - supportLevel;

    const target1 = entryPrice - triangleHeight;
    const target2 = entryPrice - triangleHeight * 1.5;
    const riskRewardRatio = calculateRiskReward(entryPrice, stopLoss, target1);

    return {
      detected: true,
      patternName: 'descending_triangle',
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
        supportLevel: parseFloat(supportLevel.toFixed(2)),
        supportSlope: parseFloat(supportTrendline.slope.toFixed(6)),
        supportRSquared: parseFloat(supportTrendline.rSquared.toFixed(3)),
        resistanceSlope: parseFloat(resistanceTrendline.slope.toFixed(6)),
        resistanceRSquared: parseFloat(resistanceTrendline.rSquared.toFixed(3)),
        pivotHighCount: pivotHighs.length,
        pivotLowCount: pivotLows.length,
        totalTouches: numTouches,
        triangleHeight: parseFloat(triangleHeight.toFixed(2)),
        gapAtFirst: parseFloat(gapAtFirst.toFixed(2)),
        gapAtLast: parseFloat(gapAtLast.toFixed(2)),
        convergenceRatio: gapAtFirst > 0
          ? parseFloat(((gapAtFirst - gapAtLast) / gapAtFirst).toFixed(3))
          : 0,
        volumeDecreasing: volDecreasing,
        proximityToBreakdown: parseFloat(proximityToBreakout.toFixed(3)),
        currentPrice: parseFloat(currentPrice.toFixed(2)),
        lastPivotHighPrice: parseFloat(lastPivotHigh.price.toFixed(2)),
      },
    };
  },
};
