import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternDetector,
  PatternDirection,
} from '@/types/pattern';
import {
  bodySize,
  bodyMidpoint,
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
// Morning Star (bullish reversal) — Tier 1
// ---------------------------------------------------------------------------

export const morningStarDetector: PatternDetector = {
  name: 'morning_star',
  category: 'candlestick',
  tier: 1,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'morning_star';
    const DIR: PatternDirection = 'bullish';
    const TIER = 1;

    if (candles.length < 4) return noDetection(NAME, DIR, TIER);

    const c1 = candles[candles.length - 3];
    const c2 = candles[candles.length - 2];
    const c3 = candles[candles.length - 1];

    const atr = last(indicators.atr) ?? 1;
    if (!isBearish(c1)) return noDetection(NAME, DIR, TIER);
    if (bodySize(c1) < atr * 0.5) return noDetection(NAME, DIR, TIER);

    if (bodySize(c2) > bodySize(c1) * 0.5) return noDetection(NAME, DIR, TIER);

    const c2UpperBody = Math.max(c2.open, c2.close);
    if (c2UpperBody > bodyMidpoint(c1)) return noDetection(NAME, DIR, TIER);

    if (!isBullish(c3)) return noDetection(NAME, DIR, TIER);
    const c1Midpoint = (c1.open + c1.close) / 2;
    if (c3.close < c1Midpoint) return noDetection(NAME, DIR, TIER);
    if (bodySize(c3) < atr * 0.3) return noDetection(NAME, DIR, TIER);

    const c1Quality = Math.min(1.0, bodySize(c1) / (atr * 1.5));
    const starSmallness = 1.0 - Math.min(1.0, bodySize(c2) / bodySize(c1));
    const c3Recovery = Math.min(1.0, bodySize(c3) / bodySize(c1));
    const patternQuality = (c1Quality + starSmallness + c3Recovery) / 3;

    const volFactor = volumeConfirmation(indicators);
    const rsiFactor = rsiContext(indicators, 'bullish');
    const trendFactor = isDowntrend(candles.slice(0, -3), 5) ? 1.0 : 0.5;

    const baseStrength = Math.min(
      0.90,
      patternQuality * 0.35 + volFactor * 0.25 + rsiFactor * 0.2 + trendFactor * 0.2,
    );

    const { score: confluenceScore, details: confluenceDetails } = computeConfluence(
      c3.close, 'bullish', indicators,
    );

    const signalStrength = computeFinalSignalStrength(baseStrength, confluenceScore, TIER);
    const confidence = Math.min(1.0, (patternQuality + volFactor + trendFactor) / 3);

    const entryPrice = c3.close;
    const stopLoss = c2.low;
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
        candle1Body: bodySize(c1),
        starBody: bodySize(c2),
        candle3Body: bodySize(c3),
        c1Midpoint,
        starSmallness,
        c3Recovery,
        volumeRatio: last(indicators.volumeRatios),
        priorDowntrend: isDowntrend(candles.slice(0, -3), 5),
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Evening Star (bearish reversal) — Tier 1
// ---------------------------------------------------------------------------

export const eveningStarDetector: PatternDetector = {
  name: 'evening_star',
  category: 'candlestick',
  tier: 1,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'evening_star';
    const DIR: PatternDirection = 'bearish';
    const TIER = 1;

    if (candles.length < 4) return noDetection(NAME, DIR, TIER);

    const c1 = candles[candles.length - 3];
    const c2 = candles[candles.length - 2];
    const c3 = candles[candles.length - 1];

    const atr = last(indicators.atr) ?? 1;

    if (!isBullish(c1)) return noDetection(NAME, DIR, TIER);
    if (bodySize(c1) < atr * 0.5) return noDetection(NAME, DIR, TIER);

    if (bodySize(c2) > bodySize(c1) * 0.5) return noDetection(NAME, DIR, TIER);

    const c2LowerBody = Math.min(c2.open, c2.close);
    if (c2LowerBody < bodyMidpoint(c1)) return noDetection(NAME, DIR, TIER);

    if (!isBearish(c3)) return noDetection(NAME, DIR, TIER);
    const c1Midpoint = (c1.open + c1.close) / 2;
    if (c3.close > c1Midpoint) return noDetection(NAME, DIR, TIER);
    if (bodySize(c3) < atr * 0.3) return noDetection(NAME, DIR, TIER);

    const c1Quality = Math.min(1.0, bodySize(c1) / (atr * 1.5));
    const starSmallness = 1.0 - Math.min(1.0, bodySize(c2) / bodySize(c1));
    const c3Recovery = Math.min(1.0, bodySize(c3) / bodySize(c1));
    const patternQuality = (c1Quality + starSmallness + c3Recovery) / 3;

    const volFactor = volumeConfirmation(indicators);
    const rsiFactor = rsiContext(indicators, 'bearish');
    const trendFactor = isUptrend(candles.slice(0, -3), 5) ? 1.0 : 0.5;

    const baseStrength = Math.min(
      0.90,
      patternQuality * 0.35 + volFactor * 0.25 + rsiFactor * 0.2 + trendFactor * 0.2,
    );

    const { score: confluenceScore, details: confluenceDetails } = computeConfluence(
      c3.close, 'bearish', indicators,
    );

    const signalStrength = computeFinalSignalStrength(baseStrength, confluenceScore, TIER);
    const confidence = Math.min(1.0, (patternQuality + volFactor + trendFactor) / 3);

    const entryPrice = c3.close;
    const stopLoss = c2.high;
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
        candle1Body: bodySize(c1),
        starBody: bodySize(c2),
        candle3Body: bodySize(c3),
        c1Midpoint,
        starSmallness,
        c3Recovery,
        volumeRatio: last(indicators.volumeRatios),
        priorUptrend: isUptrend(candles.slice(0, -3), 5),
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};
