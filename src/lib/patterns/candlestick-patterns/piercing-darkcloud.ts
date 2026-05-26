/**
 * Piercing Line and Dark Cloud Cover pattern detectors.
 *
 * Piercing Line: Tier 2 bullish reversal — bearish candle followed by bullish
 * candle that opens below prior low and closes above prior midpoint.
 *
 * Dark Cloud Cover: Tier 2 bearish reversal — bullish candle followed by bearish
 * candle that opens above prior high and closes below prior midpoint.
 *
 * These are medium-reliability patterns that become strong when combined
 * with key support/resistance levels and volume confirmation.
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
// Piercing Line (bullish reversal)
// ---------------------------------------------------------------------------

export const piercingLineDetector: PatternDetector = {
  name: 'piercing_line',
  category: 'candlestick',
  tier: 2,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'piercing_line';
    const DIR: PatternDirection = 'bullish';
    const TIER = 2;

    if (candles.length < 3) return noDetection(NAME, DIR, TIER);

    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];

    // --- Core pattern checks ---

    // Previous candle must be bearish with significant body
    if (!isBearish(prev)) return noDetection(NAME, DIR, TIER);
    const atr = last(indicators.atr) ?? 1;
    if (bodySize(prev) < atr * 0.4) return noDetection(NAME, DIR, TIER);

    // Current candle must be bullish
    if (!isBullish(curr)) return noDetection(NAME, DIR, TIER);

    // Current opens below previous low (gap down)
    if (curr.open > prev.low) return noDetection(NAME, DIR, TIER);

    // Current closes above the midpoint of previous body but below the open
    const prevMidpoint = (prev.open + prev.close) / 2;
    if (curr.close < prevMidpoint) return noDetection(NAME, DIR, TIER);
    if (curr.close > prev.open) return noDetection(NAME, DIR, TIER); // would be engulfing

    // Must appear after a downtrend
    const priorDowntrend = isDowntrend(candles.slice(0, -2), 5);

    // --- Quality metrics ---
    // How much of the previous body is penetrated
    const penetration = (curr.close - prev.close) / bodySize(prev);
    const penetrationQuality = Math.min(1.0, penetration / 0.8); // 80% penetration = max

    const bodyQuality = Math.min(1.0, bodySize(curr) / (atr * 1.0));

    const patternQuality = (penetrationQuality * 0.5 + bodyQuality * 0.5);

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
    const stopLoss = Math.min(curr.low, prev.low);
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
        penetration: parseFloat(penetration.toFixed(3)),
        volumeRatio: last(indicators.volumeRatios),
        priorDowntrend,
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Dark Cloud Cover (bearish reversal)
// ---------------------------------------------------------------------------

export const darkCloudCoverDetector: PatternDetector = {
  name: 'dark_cloud_cover',
  category: 'candlestick',
  tier: 2,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'dark_cloud_cover';
    const DIR: PatternDirection = 'bearish';
    const TIER = 2;

    if (candles.length < 3) return noDetection(NAME, DIR, TIER);

    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];

    // --- Core pattern checks ---

    // Previous candle must be bullish with significant body
    if (!isBullish(prev)) return noDetection(NAME, DIR, TIER);
    const atr = last(indicators.atr) ?? 1;
    if (bodySize(prev) < atr * 0.4) return noDetection(NAME, DIR, TIER);

    // Current candle must be bearish
    if (!isBearish(curr)) return noDetection(NAME, DIR, TIER);

    // Current opens above previous high (gap up)
    if (curr.open < prev.high) return noDetection(NAME, DIR, TIER);

    // Current closes below the midpoint of previous body but above the open
    const prevMidpoint = (prev.open + prev.close) / 2;
    if (curr.close > prevMidpoint) return noDetection(NAME, DIR, TIER);
    if (curr.close < prev.open) return noDetection(NAME, DIR, TIER); // would be engulfing

    // Must appear after an uptrend
    const priorUptrend = isUptrend(candles.slice(0, -2), 5);

    // --- Quality metrics ---
    const penetration = (prev.close - curr.close) / bodySize(prev);
    const penetrationQuality = Math.min(1.0, penetration / 0.8);
    const bodyQuality = Math.min(1.0, bodySize(curr) / (atr * 1.0));
    const patternQuality = (penetrationQuality * 0.5 + bodyQuality * 0.5);

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
    const stopLoss = Math.max(curr.high, prev.high);
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
        penetration: parseFloat(penetration.toFixed(3)),
        volumeRatio: last(indicators.volumeRatios),
        priorUptrend,
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};
