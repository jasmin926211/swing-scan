import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternDetector,
  PatternDirection,
} from '@/types/pattern';
import {
  computeSignalStrength,
  calculateRiskReward,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME = 'gap_breakout';
const MIN_CANDLES = 5;
const MIN_GAP_PCT = 1.5;       // gap must be > 1.5% of price
const MIN_VOLUME_RATIO = 2.0;  // gap day volume must be > 2x average

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

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

/**
 * **Gap Breakout (Breakaway Gap)** - Directional momentum pattern.
 *
 * A significant price gap accompanied by high volume that is NOT filled in
 * the following candles. Breakaway gaps indicate strong conviction and often
 * mark the start of a new trend leg.
 *
 * Detection criteria:
 * - Gap up: candle open > previous candle high (or gap down: open < prev low)
 * - Gap size > 1.5% of price
 * - Gap candle volume > 2x average volume
 * - Gap not filled in the next 2 candles (sustained)
 *
 * Gap up = bullish, gap down = bearish.
 * Entry: gap candle close.
 * Stop loss: other side of the gap.
 * Target: gap size projected in the gap direction.
 */
export const gapBreakoutDetector: PatternDetector = {
  name: NAME,
  category: 'chart',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    if (candles.length < MIN_CANDLES) return noDetection();

    const avgVolume = indicators.avgVolume > 0 ? indicators.avgVolume : 1;

    // We scan the last 3 candles looking for a gap relative to the candle
    // before it. We want the gap to still be unfilled.
    // The most recent candle is the "current" one. We check gaps at
    // positions -1, -2, -3 (offset from end).
    for (let offset = 1; offset <= 3; offset++) {
      const gapIdx = candles.length - offset;
      const prevIdx = gapIdx - 1;

      // Skip a gap on the very last bar: there is no subsequent bar to confirm the
      // gap held, so the "not filled" sustain check would be trivially (wrongly) true.
      if (prevIdx < 0 || gapIdx > candles.length - 2) continue;

      const gapCandle = candles[gapIdx];
      const prevCandle = candles[prevIdx];

      // ----- Detect gap up -----
      const isGapUp = gapCandle.open > prevCandle.high;
      // ----- Detect gap down -----
      const isGapDown = gapCandle.open < prevCandle.low;

      if (!isGapUp && !isGapDown) continue;

      // ----- Gap size check -----
      let gapSize: number;
      let gapPct: number;

      if (isGapUp) {
        gapSize = gapCandle.open - prevCandle.high;
        gapPct = (gapSize / prevCandle.high) * 100;
      } else {
        gapSize = prevCandle.low - gapCandle.open;
        gapPct = (gapSize / prevCandle.low) * 100;
      }

      if (gapPct < MIN_GAP_PCT) continue;

      // ----- Volume check on gap candle -----
      const gapVolumeRatio = gapCandle.volume / avgVolume;
      if (gapVolumeRatio < MIN_VOLUME_RATIO) continue;

      // ----- Check gap not filled in subsequent candles -----
      let gapFilled = false;

      for (let j = gapIdx + 1; j < candles.length && j <= gapIdx + 2; j++) {
        if (j >= candles.length) break;

        if (isGapUp && candles[j].low <= prevCandle.high) {
          gapFilled = true;
          break;
        }
        if (isGapDown && candles[j].high >= prevCandle.low) {
          gapFilled = true;
          break;
        }
      }

      if (gapFilled) continue;

      // ----- Gap is confirmed! -----
      const direction: PatternDirection = isGapUp ? 'bullish' : 'bearish';

      // ----- Signal scoring -----
      const gapSizeScore = Math.min(1, gapPct / 5); // 5% gap = max score
      const volumeScore = Math.min(1, gapVolumeRatio / 4); // 4x volume = max

      // Recency: gap on the most recent candle is strongest
      const recencyScore = offset === 1 ? 1.0 : offset === 2 ? 0.7 : 0.5;

      // How many candles have sustained the gap?
      const sustainedCandles = candles.length - gapIdx - 1;
      const sustainScore = sustainedCandles >= 2 ? 1.0 : sustainedCandles === 1 ? 0.7 : 0.4;

      const patternConfidence = Math.min(
        1,
        gapSizeScore * 0.3 + volumeScore * 0.3 + sustainScore * 0.4,
      );

      const volumeConfirmation = volumeScore;
      const trendAlignment = 0.7; // breakaway gaps are self-confirming
      const proximityToBreakout = recencyScore;

      const signalStrength = computeSignalStrength({
        patternConfidence,
        volumeConfirmation,
        trendAlignment,
        proximityToBreakout,
      });

      const confidence = Math.min(
        1,
        gapSizeScore * 0.25 + volumeScore * 0.3 + sustainScore * 0.25 + recencyScore * 0.2,
      );

      // ----- Trade levels -----
      const entryPrice = gapCandle.close;
      let stopLoss: number;
      let target1: number;
      let target2: number;

      if (isGapUp) {
        stopLoss = prevCandle.high; // other side of gap
        target1 = entryPrice + gapSize;
        target2 = entryPrice + gapSize * 2;
      } else {
        stopLoss = prevCandle.low; // other side of gap
        target1 = entryPrice - gapSize;
        target2 = entryPrice - gapSize * 2;
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
          gapDirection: isGapUp ? 'up' : 'down',
          gapSize: parseFloat(gapSize.toFixed(2)),
          gapPct: parseFloat(gapPct.toFixed(2)),
          gapVolumeRatio: parseFloat(gapVolumeRatio.toFixed(2)),
          gapCandleIndex: gapIdx,
          sustainedCandles,
          gapFilled: false,
          prevCandleHigh: parseFloat(prevCandle.high.toFixed(2)),
          prevCandleLow: parseFloat(prevCandle.low.toFixed(2)),
          gapCandleOpen: parseFloat(gapCandle.open.toFixed(2)),
          gapCandleClose: parseFloat(gapCandle.close.toFixed(2)),
        },
      };
    }

    return noDetection();
  },
};
