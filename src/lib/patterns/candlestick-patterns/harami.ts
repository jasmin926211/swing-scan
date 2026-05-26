/**
 * Bullish and Bearish Harami pattern detectors.
 *
 * Harami: Tier 2 — small candle contained entirely within the previous
 * candle's body. Signals potential reversal but needs confluence confirmation.
 *
 * Bullish Harami: bearish candle followed by smaller bullish candle inside it.
 * Bearish Harami: bullish candle followed by smaller bearish candle inside it.
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
// Bullish Harami
// ---------------------------------------------------------------------------

export const bullishHaramiDetector: PatternDetector = {
  name: 'bullish_harami',
  category: 'candlestick',
  tier: 2,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'bullish_harami';
    const DIR: PatternDirection = 'bullish';
    const TIER = 2;

    if (candles.length < 3) return noDetection(NAME, DIR, TIER);

    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];

    // --- Core pattern checks ---

    // Previous candle must be bearish and large
    if (!isBearish(prev)) return noDetection(NAME, DIR, TIER);
    const atr = last(indicators.atr) ?? 1;
    if (bodySize(prev) < atr * 0.5) return noDetection(NAME, DIR, TIER);

    // Current candle must be bullish
    if (!isBullish(curr)) return noDetection(NAME, DIR, TIER);

    // Current body must be contained within previous body
    // For bearish prev: open > close, so body range is [close, open]
    if (curr.open < prev.close || curr.close > prev.open) {
      return noDetection(NAME, DIR, TIER);
    }

    // Current body must be significantly smaller than previous (< 60%)
    if (bodySize(curr) > bodySize(prev) * 0.6) return noDetection(NAME, DIR, TIER);

    // Must appear after a downtrend
    const priorDowntrend = isDowntrend(candles.slice(0, -2), 5);

    // --- Quality metrics ---
    // How well contained is the inner candle (smaller = more contained)
    const containmentRatio = bodySize(curr) / bodySize(prev);
    const containmentQuality = 1.0 - containmentRatio; // smaller inner = better

    // Body size of mother candle relative to ATR
    const motherQuality = Math.min(1.0, bodySize(prev) / (atr * 1.5));

    const patternQuality = (containmentQuality * 0.5 + motherQuality * 0.5);

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
    const stopLoss = prev.low;
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
        prevBody: bodySize(prev),
        currBody: bodySize(curr),
        containmentRatio: parseFloat(containmentRatio.toFixed(3)),
        volumeRatio: last(indicators.volumeRatios),
        priorDowntrend,
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Bearish Harami
// ---------------------------------------------------------------------------

export const bearishHaramiDetector: PatternDetector = {
  name: 'bearish_harami',
  category: 'candlestick',
  tier: 2,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'bearish_harami';
    const DIR: PatternDirection = 'bearish';
    const TIER = 2;

    if (candles.length < 3) return noDetection(NAME, DIR, TIER);

    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];

    // --- Core pattern checks ---

    // Previous candle must be bullish and large
    if (!isBullish(prev)) return noDetection(NAME, DIR, TIER);
    const atr = last(indicators.atr) ?? 1;
    if (bodySize(prev) < atr * 0.5) return noDetection(NAME, DIR, TIER);

    // Current candle must be bearish
    if (!isBearish(curr)) return noDetection(NAME, DIR, TIER);

    // Current body must be contained within previous body
    // For bullish prev: open < close, so body range is [open, close]
    if (curr.open > prev.close || curr.close < prev.open) {
      return noDetection(NAME, DIR, TIER);
    }

    // Current body must be significantly smaller (< 60%)
    if (bodySize(curr) > bodySize(prev) * 0.6) return noDetection(NAME, DIR, TIER);

    // Must appear after an uptrend
    const priorUptrend = isUptrend(candles.slice(0, -2), 5);

    // --- Quality metrics ---
    const containmentRatio = bodySize(curr) / bodySize(prev);
    const containmentQuality = 1.0 - containmentRatio;
    const motherQuality = Math.min(1.0, bodySize(prev) / (atr * 1.5));
    const patternQuality = (containmentQuality * 0.5 + motherQuality * 0.5);

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
    const stopLoss = prev.high;
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
        prevBody: bodySize(prev),
        currBody: bodySize(curr),
        containmentRatio: parseFloat(containmentRatio.toFixed(3)),
        volumeRatio: last(indicators.volumeRatios),
        priorUptrend,
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};
