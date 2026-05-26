/**
 * Tweezer Bottom and Tweezer Top pattern detectors.
 *
 * Tweezer Bottom: Tier 2 bullish reversal — two candles with matching lows.
 * Tweezer Top: Tier 2 bearish reversal — two candles with matching highs.
 *
 * These patterns indicate failed attempts to push price through a level,
 * suggesting a reversal. Most effective at key support/resistance.
 */

import { CandleData, IndicatorData } from '@/types/stock';
import { PatternResult, PatternDetector, PatternDirection } from '@/types/pattern';
import {
  bodySize,
  isBearish,
  isBullish,
  last,
  isDowntrend,
  isUptrend,
  volumeConfirmation,
  rsiContext,
  noDetection,
  computeConfluence,
  computeFinalSignalStrength,
} from './helpers';

// ---------------------------------------------------------------------------
// Tweezer Bottom (bullish reversal)
// ---------------------------------------------------------------------------

export const tweezerBottomDetector: PatternDetector = {
  name: 'tweezer_bottom',
  category: 'candlestick',
  tier: 2,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'tweezer_bottom';
    const DIR: PatternDirection = 'bullish';
    const TIER = 2;

    if (candles.length < 3) return noDetection(NAME, DIR, TIER);

    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];

    // --- Core pattern checks ---

    // First candle should be bearish, second should be bullish
    if (!isBearish(prev)) return noDetection(NAME, DIR, TIER);
    if (!isBullish(curr)) return noDetection(NAME, DIR, TIER);

    // Lows should match within a tight tolerance (0.3% of price)
    const avgLow = (prev.low + curr.low) / 2;
    if (avgLow === 0) return noDetection(NAME, DIR, TIER);
    const lowDiff = Math.abs(prev.low - curr.low) / avgLow;
    if (lowDiff > 0.003) return noDetection(NAME, DIR, TIER);

    // Both candles should have meaningful bodies
    const atr = last(indicators.atr) ?? 1;
    if (bodySize(prev) < atr * 0.2) return noDetection(NAME, DIR, TIER);
    if (bodySize(curr) < atr * 0.2) return noDetection(NAME, DIR, TIER);

    // Must appear after a downtrend
    const priorDowntrend = isDowntrend(candles.slice(0, -2), 5);

    // --- Quality metrics ---
    // How close the lows match (closer = better)
    const matchQuality = 1.0 - (lowDiff / 0.003);

    // Second candle should recover strongly
    const recoveryRatio = bodySize(curr) / bodySize(prev);
    const recoveryQuality = Math.min(1.0, recoveryRatio);

    const patternQuality = (matchQuality * 0.5 + recoveryQuality * 0.5);

    const volFactor = volumeConfirmation(indicators);
    const rsiFactor = rsiContext(indicators, 'bullish');
    const trendFactor = priorDowntrend ? 1.0 : 0.4;

    const baseStrength = Math.min(
      0.90,
      patternQuality * 0.35 + volFactor * 0.25 + rsiFactor * 0.2 + trendFactor * 0.2,
    );

    const { score: confluenceScore, details: confluenceDetails } = computeConfluence(
      curr.close, 'bullish', indicators,
    );

    const signalStrength = computeFinalSignalStrength(baseStrength, confluenceScore, TIER);
    const confidence = Math.min(1.0, (patternQuality + volFactor + trendFactor) / 3);

    // --- Trade levels ---
    const entryPrice = curr.close;
    const stopLoss = Math.min(prev.low, curr.low) - atr * 0.1; // Just below the matching lows
    const risk = entryPrice - stopLoss;
    const target1 = entryPrice + 2 * risk;
    const target2 = entryPrice + 3 * risk;
    const riskRewardRatio = risk > 0 ? (target1 - entryPrice) / risk : null;

    return {
      detected: true,
      patternName: NAME,
      category: 'candlestick',
      direction: DIR,
      tier: TIER,
      signalStrength: parseFloat(signalStrength.toFixed(3)),
      confidence: parseFloat(confidence.toFixed(3)),
      entryPrice,
      stopLoss,
      target1,
      target2,
      riskRewardRatio: riskRewardRatio !== null ? parseFloat(riskRewardRatio.toFixed(2)) : null,
      confluenceScore,
      confluenceDetails,
      patternData: {
        prevLow: prev.low,
        currLow: curr.low,
        lowDiffPct: parseFloat((lowDiff * 100).toFixed(3)),
        prevBody: bodySize(prev),
        currBody: bodySize(curr),
        volumeRatio: last(indicators.volumeRatios),
        priorDowntrend,
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Tweezer Top (bearish reversal)
// ---------------------------------------------------------------------------

export const tweezerTopDetector: PatternDetector = {
  name: 'tweezer_top',
  category: 'candlestick',
  tier: 2,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'tweezer_top';
    const DIR: PatternDirection = 'bearish';
    const TIER = 2;

    if (candles.length < 3) return noDetection(NAME, DIR, TIER);

    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];

    // --- Core pattern checks ---

    // First candle should be bullish, second should be bearish
    if (!isBullish(prev)) return noDetection(NAME, DIR, TIER);
    if (!isBearish(curr)) return noDetection(NAME, DIR, TIER);

    // Highs should match within a tight tolerance (0.3% of price)
    const avgHigh = (prev.high + curr.high) / 2;
    if (avgHigh === 0) return noDetection(NAME, DIR, TIER);
    const highDiff = Math.abs(prev.high - curr.high) / avgHigh;
    if (highDiff > 0.003) return noDetection(NAME, DIR, TIER);

    // Both candles should have meaningful bodies
    const atr = last(indicators.atr) ?? 1;
    if (bodySize(prev) < atr * 0.2) return noDetection(NAME, DIR, TIER);
    if (bodySize(curr) < atr * 0.2) return noDetection(NAME, DIR, TIER);

    // Must appear after an uptrend
    const priorUptrend = isUptrend(candles.slice(0, -2), 5);

    // --- Quality metrics ---
    const matchQuality = 1.0 - (highDiff / 0.003);
    const recoveryRatio = bodySize(curr) / bodySize(prev);
    const recoveryQuality = Math.min(1.0, recoveryRatio);
    const patternQuality = (matchQuality * 0.5 + recoveryQuality * 0.5);

    const volFactor = volumeConfirmation(indicators);
    const rsiFactor = rsiContext(indicators, 'bearish');
    const trendFactor = priorUptrend ? 1.0 : 0.4;

    const baseStrength = Math.min(
      0.90,
      patternQuality * 0.35 + volFactor * 0.25 + rsiFactor * 0.2 + trendFactor * 0.2,
    );

    const { score: confluenceScore, details: confluenceDetails } = computeConfluence(
      curr.close, 'bearish', indicators,
    );

    const signalStrength = computeFinalSignalStrength(baseStrength, confluenceScore, TIER);
    const confidence = Math.min(1.0, (patternQuality + volFactor + trendFactor) / 3);

    // --- Trade levels ---
    const entryPrice = curr.close;
    const stopLoss = Math.max(prev.high, curr.high) + atr * 0.1; // Just above the matching highs
    const risk = stopLoss - entryPrice;
    const target1 = entryPrice - 2 * risk;
    const target2 = entryPrice - 3 * risk;
    const riskRewardRatio = risk > 0 ? (entryPrice - target1) / risk : null;

    return {
      detected: true,
      patternName: NAME,
      category: 'candlestick',
      direction: DIR,
      tier: TIER,
      signalStrength: parseFloat(signalStrength.toFixed(3)),
      confidence: parseFloat(confidence.toFixed(3)),
      entryPrice,
      stopLoss,
      target1,
      target2,
      riskRewardRatio: riskRewardRatio !== null ? parseFloat(riskRewardRatio.toFixed(2)) : null,
      confluenceScore,
      confluenceDetails,
      patternData: {
        prevHigh: prev.high,
        currHigh: curr.high,
        highDiffPct: parseFloat((highDiff * 100).toFixed(3)),
        prevBody: bodySize(prev),
        currBody: bodySize(curr),
        volumeRatio: last(indicators.volumeRatios),
        priorUptrend,
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};
