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
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_CANDLES = 20;
const LOOKBACK = 60;
const MIN_PIVOT_HIGHS = 2;
const MIN_PIVOT_LOWS = 2;
const RESISTANCE_TOLERANCE_PCT = 2; // Pivot highs must be within 2% of each other
const MIN_ASCENDING_SLOPE = 0.0001; // Minimum positive slope for ascending support

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noDetection(): PatternResult {
  return {
    detected: false,
    patternName: 'ascending_triangle',
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

// ---------------------------------------------------------------------------
// Ascending Triangle Detector
// ---------------------------------------------------------------------------

export const ascendingTriangleDetector: PatternDetector = {
  name: 'ascending_triangle',
  category: 'chart',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    // ----- Guard: minimum data -----
    if (candles.length < MIN_CANDLES) return noDetection();

    const lookback = Math.min(candles.length, LOOKBACK);
    const slice = candles.slice(-lookback);

    // ----- Step 1: Find pivot highs (resistance candidates) -----
    const pivotHighs = findPivotHighs(slice, 3, 3);
    if (pivotHighs.length < MIN_PIVOT_HIGHS) return noDetection();

    // ----- Step 2: Check if pivot highs form a flat resistance line -----
    const resistanceTrendline = fitTrendline(pivotHighs);
    if (!resistanceTrendline) return noDetection();

    // The slope of the resistance line should be near zero (flat)
    // Normalise slope by average price
    const avgHighPrice =
      pivotHighs.reduce((s, p) => s + p.price, 0) / pivotHighs.length;
    const normResistanceSlope =
      avgHighPrice > 0 ? resistanceTrendline.slope / avgHighPrice : 0;

    if (!isFlat(normResistanceSlope, 0.002)) return noDetection();

    // All pivot highs should be within the tolerance percentage
    const resistanceLevel = avgHighPrice;
    const allHighsNear = pivotHighs.every((p) =>
      isPriceNear(p.price, resistanceLevel, RESISTANCE_TOLERANCE_PCT),
    );
    if (!allHighsNear) return noDetection();

    // ----- Step 3: Find pivot lows (ascending support candidates) -----
    const pivotLows = findPivotLows(slice, 3, 3);
    if (pivotLows.length < MIN_PIVOT_LOWS) return noDetection();

    // ----- Step 4: Check if pivot lows form an ascending line -----
    const supportTrendline = fitTrendline(pivotLows);
    if (!supportTrendline) return noDetection();

    // Support slope should be positive (ascending lows)
    if (supportTrendline.slope <= MIN_ASCENDING_SLOPE) return noDetection();

    // Verify that successive lows are actually higher
    let ascendingLowsCount = 0;
    for (let i = 1; i < pivotLows.length; i++) {
      if (pivotLows[i].price > pivotLows[i - 1].price) {
        ascendingLowsCount++;
      }
    }
    // At least half of the transitions should be ascending
    if (ascendingLowsCount < Math.ceil((pivotLows.length - 1) * 0.5)) {
      return noDetection();
    }

    // ----- Step 5: The two lines should converge (triangle shape) -----
    // At the first pivot, the gap should be larger than at the last bar
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

    // Ensure the lines haven't already crossed (support above resistance)
    if (gapAtLast < 0) return noDetection();

    // ----- Step 6: Volume should generally decrease during formation -----
    const formationStart = firstIdx;
    const formationEnd = lastIdx;
    const volDecreasing = isVolumeDecreasing(slice, formationStart, formationEnd);

    // ----- Step 7: Breakout proximity -----
    const currentPrice = slice[lastIdx].close;
    const distToBreakout = resistanceLevel > 0
      ? (currentPrice - resistanceLevel) / resistanceLevel
      : 0;
    const proximityToBreakout = distToBreakout >= 0
      ? 1.0
      : Math.max(0, 1.0 + distToBreakout * 20); // within 5% = decent

    // ----- Step 8: Pattern quality scoring -----
    const numTouches = pivotHighs.length + pivotLows.length;
    const touchScore = Math.min(1, numTouches / 8); // More touches = stronger pattern

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
      trendAlignment = ema9 > ema21 ? 0.9 : 0.3;
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

    // ----- Step 12: Trade levels -----
    const entryPrice = resistanceLevel; // breakout above resistance
    const lastPivotLow = pivotLows[pivotLows.length - 1];
    const stopLoss = lastPivotLow.price;

    // Triangle height: distance from lowest low to resistance at the start of the pattern
    const lowestLow = pivotLows.reduce(
      (min, p) => (p.price < min ? p.price : min),
      Infinity,
    );
    const triangleHeight = resistanceLevel - lowestLow;

    const target1 = entryPrice + triangleHeight;
    const target2 = entryPrice + triangleHeight * 1.5;
    const riskRewardRatio = calculateRiskReward(entryPrice, stopLoss, target1);

    return {
      detected: true,
      patternName: 'ascending_triangle',
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
        resistanceLevel: parseFloat(resistanceLevel.toFixed(2)),
        resistanceSlope: parseFloat(resistanceTrendline.slope.toFixed(6)),
        resistanceRSquared: parseFloat(resistanceTrendline.rSquared.toFixed(3)),
        supportSlope: parseFloat(supportTrendline.slope.toFixed(6)),
        supportRSquared: parseFloat(supportTrendline.rSquared.toFixed(3)),
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
        proximityToBreakout: parseFloat(proximityToBreakout.toFixed(3)),
        currentPrice: parseFloat(currentPrice.toFixed(2)),
        lastPivotLowPrice: parseFloat(lastPivotLow.price.toFixed(2)),
      },
    };
  },
};
