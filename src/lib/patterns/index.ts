import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternDetector,
  PatternTier,
  PATTERN_TIERS,
} from '@/types/pattern';
import {
  computeConfluence,
  computeFinalSignalStrength,
  passesVolumeFilter,
} from './candlestick-patterns/helpers';

// Chart patterns - Tier 1 (Continuation, highest probability)
import { bullFlagDetector } from './chart-patterns/bull-flag';
import { bearFlagDetector } from './chart-patterns/bear-flag';
import { ascendingTriangleDetector } from './chart-patterns/ascending-triangle';
import { descendingTriangleDetector } from './chart-patterns/descending-triangle';
import { cupAndHandleDetector } from './chart-patterns/cup-and-handle';

// Chart patterns - Tier 2 (Reversals)
import { doubleBottomDetector } from './chart-patterns/double-bottom';
import { doubleTopDetector } from './chart-patterns/double-top';
import { headAndShouldersDetector } from './chart-patterns/head-and-shoulders';
import { inverseHeadAndShouldersDetector } from './chart-patterns/inverse-head-and-shoulders';
import { fallingWedgeDetector } from './chart-patterns/falling-wedge';

// Chart patterns - Tier 3 (Continuation/Advanced)
import { risingWedgeDetector } from './chart-patterns/rising-wedge';
import { rectangleBreakoutDetector } from './chart-patterns/rectangle-breakout';
import { channelBreakoutDetector } from './chart-patterns/channel-breakout';
import { channelBreakdownDetector } from './chart-patterns/channel-breakdown';
import { roundingBottomDetector } from './chart-patterns/rounding-bottom';
import { symmetricalTriangleDetector } from './chart-patterns/symmetrical-triangle';
import { broadeningWedgeDetector } from './chart-patterns/broadening-wedge';
import { gapBreakoutDetector } from './chart-patterns/gap-breakout';
import { measuredMoveDetector } from './chart-patterns/measured-move';

// Candlestick patterns - Tier 1 (High reliability)
import { bullishEngulfingDetector, bearishEngulfingDetector } from './candlestick-patterns/engulfing';
import { morningStarDetector, eveningStarDetector } from './candlestick-patterns/stars';
import { threeWhiteSoldiersDetector, threeBlackCrowsDetector } from './candlestick-patterns/soldiers-crows';
import { hammerDetector, shootingStarDetector } from './candlestick-patterns/hammer-star';

// Candlestick patterns - Tier 2 (Medium, need confluence)
import { piercingLineDetector, darkCloudCoverDetector } from './candlestick-patterns/piercing-darkcloud';
import { bullishHaramiDetector, bearishHaramiDetector } from './candlestick-patterns/harami';
import { tweezerBottomDetector, tweezerTopDetector } from './candlestick-patterns/tweezers';
import { insideBarDetector } from './candlestick-patterns/inside-bar';

// Crossover patterns
import { emaCrossover9_21, emaCrossover20_50 } from './crossovers/ema-crossover';
import { goldenCross, deathCross } from './crossovers/golden-cross';

// ---------------------------------------------------------------------------
// All detectors organized by tier
// ---------------------------------------------------------------------------

const ALL_PATTERN_DETECTORS: PatternDetector[] = [
  // Tier 1 — High confidence, trade regularly
  bullFlagDetector,
  bearFlagDetector,
  bullishEngulfingDetector,
  bearishEngulfingDetector,
  morningStarDetector,
  eveningStarDetector,
  hammerDetector,
  shootingStarDetector,
  threeWhiteSoldiersDetector,
  threeBlackCrowsDetector,

  // Tier 2 — Good with confluence confirmation
  ascendingTriangleDetector,
  descendingTriangleDetector,
  cupAndHandleDetector,
  doubleBottomDetector,
  doubleTopDetector,
  headAndShouldersDetector,
  inverseHeadAndShouldersDetector,
  fallingWedgeDetector,
  piercingLineDetector,
  darkCloudCoverDetector,
  bullishHaramiDetector,
  bearishHaramiDetector,
  tweezerBottomDetector,
  tweezerTopDetector,
  insideBarDetector,
  goldenCross,
  deathCross,

  // Tier 3 — Early warnings, lower reliability
  risingWedgeDetector,
  rectangleBreakoutDetector,
  channelBreakoutDetector,
  channelBreakdownDetector,
  roundingBottomDetector,
  symmetricalTriangleDetector,
  broadeningWedgeDetector,
  gapBreakoutDetector,
  measuredMoveDetector,
  emaCrossover9_21,
  emaCrossover20_50,
];

// ---------------------------------------------------------------------------
// Pattern names that are reversal patterns (need hard volume filter)
// ---------------------------------------------------------------------------

const REVERSAL_PATTERNS = new Set([
  'bullish_engulfing', 'bearish_engulfing',
  'morning_star', 'evening_star',
  'hammer', 'shooting_star',
  'piercing_line', 'dark_cloud_cover',
  'bullish_harami', 'bearish_harami',
  'tweezer_bottom', 'tweezer_top',
  'double_bottom', 'double_top',
  'head_and_shoulders', 'inverse_head_and_shoulders',
]);

/**
 * Enrich a pattern result with tier, confluence score, and confluence details
 * if the detector didn't already provide them (backward compatibility for
 * chart patterns and crossovers that haven't been updated yet).
 */
function enrichResult(
  result: PatternResult,
  indicators: IndicatorData,
  currentPrice: number,
  detectorTier?: PatternTier,
): PatternResult {
  // Determine tier from detector, PATTERN_TIERS mapping, or default to 3
  const tier: PatternTier = result.tier ??
    detectorTier ??
    (PATTERN_TIERS[result.patternName]?.tier as PatternTier) ??
    3;

  // Confluence is scored on the CURRENT price (last close). The old code used
  // `entryPrice ?? 0`, which made `isAtKeyLevel` compute |0 - level|/level ≈ 1 for
  // every level whenever entry was null — so the "at key level" point could never
  // score. We also recompute uniformly for EVERY pattern (previously detectors that
  // self-reported confluence were scored on a different scale).
  const direction = result.direction === 'bearish' ? 'bearish' as const : 'bullish' as const;

  const { score, details } = computeConfluence(currentPrice, direction, indicators);
  const signalStrength = computeFinalSignalStrength(result.signalStrength, score, tier);

  return {
    ...result,
    tier,
    signalStrength: parseFloat(signalStrength.toFixed(3)),
    confluenceScore: score,
    confluenceDetails: details,
  };
}

/**
 * Run all pattern detectors on the given candle data.
 *
 * Enhanced with:
 * - Tier-based reliability system (1 = high, 2 = medium, 3 = low)
 * - 5-point confluence scoring (daily pattern + volume + key level + weekly trend + RSI)
 * - Hard volume filter: reversal patterns with volume < 1.5x are rejected
 * - Tier 2 patterns require confluence >= 3 to pass (otherwise heavily penalized)
 * - Tier 3 patterns are always included but with lower scores
 *
 * @param candles - Daily OHLCV candle array (200 days recommended).
 * @param indicators - Pre-computed indicator data.
 * @returns Sorted array of detected patterns (highest signal strength first).
 */
/**
 * Defense-in-depth: a detector bug (e.g. a bad trendline projection mixing
 * absolute/relative indices) must never surface as a tradeable signal. Reject any
 * pattern whose levels are nonsensical relative to the current price.
 */
export function hasSaneLevels(result: PatternResult, currentPrice: number): boolean {
  const { entryPrice: e, stopLoss: s, target1: t1, direction } = result;
  if (e == null || s == null || t1 == null) return true; // levels optional for some patterns
  for (const v of [e, s, t1]) {
    if (!Number.isFinite(v) || v <= 0) return false;
  }
  // Entry must sit near the current price — a confirmed break enters ~here.
  if (Math.abs(e - currentPrice) / currentPrice > 0.30) return false;
  // Stop and first target must be on the correct sides of entry.
  if (direction === 'bullish') return s < e && e < t1;
  if (direction === 'bearish') return t1 < e && e < s;
  return true; // neutral: no directional side check
}

export function runAllPatterns(
  candles: CandleData[],
  indicators: IndicatorData,
): PatternResult[] {
  if (candles.length < 30) return [];

  const currentPrice = candles[candles.length - 1].close;
  const detectedPatterns: PatternResult[] = [];

  for (const detector of ALL_PATTERN_DETECTORS) {
    try {
      const rawResult = detector.detect(candles, indicators);
      if (!rawResult.detected) continue;

      // Enrich with tier and confluence data (scored on the current price)
      const result = enrichResult(rawResult, indicators, currentPrice, detector.tier);

      // Hard volume filter: reject reversal patterns with volume < 1.5x
      if (REVERSAL_PATTERNS.has(result.patternName)) {
        if (!passesVolumeFilter(indicators)) {
          continue; // Skip this pattern — not enough volume conviction
        }
      }

      // Defense-in-depth: drop any pattern with nonsensical trade levels.
      if (!hasSaneLevels(result, currentPrice)) {
        console.error(
          `[Patterns] ${result.patternName} produced insane levels ` +
            `(price=${currentPrice}, entry=${result.entryPrice}, stop=${result.stopLoss}, t1=${result.target1}) — dropped`
        );
        continue;
      }

      // Minimum signal strength threshold after confluence adjustments.
      // Raised 0.30 → 0.45: with the widened confluence multiplier, unconfirmed
      // signals now fall below this and are filtered out (fewer, higher-quality).
      if (result.signalStrength >= 0.45) {
        detectedPatterns.push(result);
      }
    } catch (err) {
      // Log instead of silently swallowing (was hiding real detector bugs).
      console.error(`[Patterns] ${detector.name} threw:`, err instanceof Error ? err.message : err);
      continue;
    }
  }

  // Sort by: tier ascending (1 first), then signal strength descending
  detectedPatterns.sort((a, b) => {
    const aTier = a.tier ?? 3;
    const bTier = b.tier ?? 3;
    if (aTier !== bTier) return aTier - bTier;
    return b.signalStrength - a.signalStrength;
  });

  return detectedPatterns;
}

export { ALL_PATTERN_DETECTORS };
