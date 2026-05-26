import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternDetector,
  PatternDirection,
} from '@/types/pattern';
import {
  bodySize,
  candleRange,
  isBearish,
  isBullish,
  upperShadow,
  lowerShadow,
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
// Three White Soldiers (bullish) — Tier 1
// ---------------------------------------------------------------------------

export const threeWhiteSoldiersDetector: PatternDetector = {
  name: 'three_white_soldiers',
  category: 'candlestick',
  tier: 1,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'three_white_soldiers';
    const DIR: PatternDirection = 'bullish';
    const TIER = 1;

    if (candles.length < 4) return noDetection(NAME, DIR, TIER);

    const c1 = candles[candles.length - 3];
    const c2 = candles[candles.length - 2];
    const c3 = candles[candles.length - 1];
    const trio = [c1, c2, c3];

    if (!isBullish(c1) || !isBullish(c2) || !isBullish(c3)) {
      return noDetection(NAME, DIR, TIER);
    }

    if (c2.close <= c1.close || c3.close <= c2.close) {
      return noDetection(NAME, DIR, TIER);
    }

    if (c2.open < c1.open || c2.open > c1.close) {
      return noDetection(NAME, DIR, TIER);
    }
    if (c3.open < c2.open || c3.open > c2.close) {
      return noDetection(NAME, DIR, TIER);
    }

    const MIN_BODY_RATIO = 0.6;
    for (const c of trio) {
      const range = candleRange(c);
      if (range === 0) return noDetection(NAME, DIR, TIER);
      if (bodySize(c) / range < MIN_BODY_RATIO) {
        return noDetection(NAME, DIR, TIER);
      }
    }

    for (const c of trio) {
      if (upperShadow(c) > bodySize(c) * 0.3) {
        return noDetection(NAME, DIR, TIER);
      }
    }

    const atr = last(indicators.atr) ?? 1;
    const avgBody = (bodySize(c1) + bodySize(c2) + bodySize(c3)) / 3;
    const bodySizeQuality = Math.min(1.0, avgBody / atr);

    const avgUpperShadowRatio =
      trio.reduce((sum, c) => sum + (bodySize(c) > 0 ? upperShadow(c) / bodySize(c) : 1), 0) / 3;
    const shadowQuality = 1.0 - Math.min(1.0, avgUpperShadowRatio / 0.3);

    const closeGap1 = c2.close - c1.close;
    const closeGap2 = c3.close - c2.close;
    const progressionQuality =
      closeGap1 > 0 && closeGap2 > 0
        ? 1.0 - Math.abs(closeGap1 - closeGap2) / Math.max(closeGap1, closeGap2) * 0.5
        : 0.5;

    const patternQuality = (bodySizeQuality + shadowQuality + progressionQuality) / 3;

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
    const stopLoss = c1.low;
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
        candle2Body: bodySize(c2),
        candle3Body: bodySize(c3),
        avgBody,
        avgUpperShadowRatio: parseFloat(avgUpperShadowRatio.toFixed(3)),
        progressionQuality: parseFloat(progressionQuality.toFixed(3)),
        volumeRatio: last(indicators.volumeRatios),
        priorDowntrend: isDowntrend(candles.slice(0, -3), 5),
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Three Black Crows (bearish) — Tier 1
// ---------------------------------------------------------------------------

export const threeBlackCrowsDetector: PatternDetector = {
  name: 'three_black_crows',
  category: 'candlestick',
  tier: 1,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'three_black_crows';
    const DIR: PatternDirection = 'bearish';
    const TIER = 1;

    if (candles.length < 4) return noDetection(NAME, DIR, TIER);

    const c1 = candles[candles.length - 3];
    const c2 = candles[candles.length - 2];
    const c3 = candles[candles.length - 1];
    const trio = [c1, c2, c3];

    if (!isBearish(c1) || !isBearish(c2) || !isBearish(c3)) {
      return noDetection(NAME, DIR, TIER);
    }

    if (c2.close >= c1.close || c3.close >= c2.close) {
      return noDetection(NAME, DIR, TIER);
    }

    if (c2.open < c1.close || c2.open > c1.open) {
      return noDetection(NAME, DIR, TIER);
    }
    if (c3.open < c2.close || c3.open > c2.open) {
      return noDetection(NAME, DIR, TIER);
    }

    const MIN_BODY_RATIO = 0.6;
    for (const c of trio) {
      const range = candleRange(c);
      if (range === 0) return noDetection(NAME, DIR, TIER);
      if (bodySize(c) / range < MIN_BODY_RATIO) {
        return noDetection(NAME, DIR, TIER);
      }
    }

    for (const c of trio) {
      if (lowerShadow(c) > bodySize(c) * 0.3) {
        return noDetection(NAME, DIR, TIER);
      }
    }

    const atr = last(indicators.atr) ?? 1;
    const avgBody = (bodySize(c1) + bodySize(c2) + bodySize(c3)) / 3;
    const bodySizeQuality = Math.min(1.0, avgBody / atr);

    const avgLowerShadowRatio =
      trio.reduce((sum, c) => sum + (bodySize(c) > 0 ? lowerShadow(c) / bodySize(c) : 1), 0) / 3;
    const shadowQuality = 1.0 - Math.min(1.0, avgLowerShadowRatio / 0.3);

    const closeGap1 = c1.close - c2.close;
    const closeGap2 = c2.close - c3.close;
    const progressionQuality =
      closeGap1 > 0 && closeGap2 > 0
        ? 1.0 - Math.abs(closeGap1 - closeGap2) / Math.max(closeGap1, closeGap2) * 0.5
        : 0.5;

    const patternQuality = (bodySizeQuality + shadowQuality + progressionQuality) / 3;

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
    const stopLoss = c1.high;
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
        candle2Body: bodySize(c2),
        candle3Body: bodySize(c3),
        avgBody,
        avgLowerShadowRatio: parseFloat(avgLowerShadowRatio.toFixed(3)),
        progressionQuality: parseFloat(progressionQuality.toFixed(3)),
        volumeRatio: last(indicators.volumeRatios),
        priorUptrend: isUptrend(candles.slice(0, -3), 5),
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};
