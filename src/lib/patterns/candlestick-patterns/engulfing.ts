import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternDetector,
  PatternDirection,
} from '@/types/pattern';
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
// Bullish Engulfing — Tier 1
// ---------------------------------------------------------------------------

export const bullishEngulfingDetector: PatternDetector = {
  name: 'bullish_engulfing',
  category: 'candlestick',
  tier: 1,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'bullish_engulfing';
    const DIR: PatternDirection = 'bullish';
    const TIER = 1;

    if (candles.length < 3) return noDetection(NAME, DIR, TIER);

    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];

    if (!isBearish(prev)) return noDetection(NAME, DIR, TIER);
    if (!isBullish(curr)) return noDetection(NAME, DIR, TIER);
    if (curr.open > prev.close || curr.close < prev.open) {
      return noDetection(NAME, DIR, TIER);
    }

    const atr = last(indicators.atr) ?? 1;
    const bodySizeRatio = bodySize(curr) / atr;
    const patternQuality = Math.min(1.0, bodySizeRatio / 1.5);

    const volFactor = volumeConfirmation(indicators);
    const rsiFactor = rsiContext(indicators, 'bullish');
    const trendFactor = isDowntrend(candles.slice(0, -1), 5) ? 1.0 : 0.5;

    const baseStrength = Math.min(
      0.90,
      patternQuality * 0.35 + volFactor * 0.25 + rsiFactor * 0.2 + trendFactor * 0.2,
    );

    const { score: confluenceScore, details: confluenceDetails } = computeConfluence(
      curr.close, 'bullish', indicators,
    );

    const signalStrength = computeFinalSignalStrength(baseStrength, confluenceScore, TIER);
    const confidence = Math.min(1.0, (patternQuality + volFactor + trendFactor) / 3);

    const entryPrice = curr.close;
    const stopLoss = curr.low;
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
        prevCandleBody: bodySize(prev),
        currCandleBody: bodySize(curr),
        bodySizeRatio,
        volumeRatio: last(indicators.volumeRatios),
        priorDowntrend: isDowntrend(candles.slice(0, -1), 5),
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Bearish Engulfing — Tier 1
// ---------------------------------------------------------------------------

export const bearishEngulfingDetector: PatternDetector = {
  name: 'bearish_engulfing',
  category: 'candlestick',
  tier: 1,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'bearish_engulfing';
    const DIR: PatternDirection = 'bearish';
    const TIER = 1;

    if (candles.length < 3) return noDetection(NAME, DIR, TIER);

    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];

    if (!isBullish(prev)) return noDetection(NAME, DIR, TIER);
    if (!isBearish(curr)) return noDetection(NAME, DIR, TIER);
    if (curr.open < prev.close || curr.close > prev.open) {
      return noDetection(NAME, DIR, TIER);
    }

    const atr = last(indicators.atr) ?? 1;
    const bodySizeRatio = bodySize(curr) / atr;
    const patternQuality = Math.min(1.0, bodySizeRatio / 1.5);

    const volFactor = volumeConfirmation(indicators);
    const rsiFactor = rsiContext(indicators, 'bearish');
    const trendFactor = isUptrend(candles.slice(0, -1), 5) ? 1.0 : 0.5;

    const baseStrength = Math.min(
      0.90,
      patternQuality * 0.35 + volFactor * 0.25 + rsiFactor * 0.2 + trendFactor * 0.2,
    );

    const { score: confluenceScore, details: confluenceDetails } = computeConfluence(
      curr.close, 'bearish', indicators,
    );

    const signalStrength = computeFinalSignalStrength(baseStrength, confluenceScore, TIER);
    const confidence = Math.min(1.0, (patternQuality + volFactor + trendFactor) / 3);

    const entryPrice = curr.close;
    const stopLoss = curr.high;
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
        prevCandleBody: bodySize(prev),
        currCandleBody: bodySize(curr),
        bodySizeRatio,
        volumeRatio: last(indicators.volumeRatios),
        priorUptrend: isUptrend(candles.slice(0, -1), 5),
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};
