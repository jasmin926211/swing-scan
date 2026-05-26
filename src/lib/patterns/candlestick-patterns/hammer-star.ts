/**
 * Hammer and Shooting Star pattern detectors.
 *
 * Hammer: Tier 1 bullish reversal — long lower shadow, small body at top.
 * Shooting Star: Tier 1 bearish reversal — long upper shadow, small body at bottom.
 *
 * These are the most reliable single-candle reversal patterns, especially
 * when they appear at key support/resistance levels with volume confirmation.
 */

import { CandleData, IndicatorData } from '@/types/stock';
import { PatternResult, PatternDetector, PatternDirection } from '@/types/pattern';
import {
  bodySize,
  candleRange,
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
// Hammer (bullish reversal)
// ---------------------------------------------------------------------------

export const hammerDetector: PatternDetector = {
  name: 'hammer',
  category: 'candlestick',
  tier: 1,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'hammer';
    const DIR: PatternDirection = 'bullish';
    const TIER = 1;

    if (candles.length < 6) return noDetection(NAME, DIR, TIER);

    const curr = candles[candles.length - 1];
    const range = candleRange(curr);

    if (range === 0) return noDetection(NAME, DIR, TIER);

    const body = bodySize(curr);
    const lShadow = lowerShadow(curr);
    const uShadow = upperShadow(curr);

    // --- Core pattern checks ---

    // Lower shadow must be at least 2x the body size
    if (lShadow < body * 2) return noDetection(NAME, DIR, TIER);

    // Upper shadow must be very small (< 10% of range)
    if (uShadow > range * 0.1) return noDetection(NAME, DIR, TIER);

    // Body must be in the upper third of the candle
    const bodyTop = Math.max(curr.open, curr.close);
    if (bodyTop < curr.low + range * 0.67) return noDetection(NAME, DIR, TIER);

    // Body should be meaningful (not a doji)
    const atr = last(indicators.atr) ?? 1;
    if (body < atr * 0.1) return noDetection(NAME, DIR, TIER);

    // Must appear after a downtrend
    const priorDowntrend = isDowntrend(candles.slice(0, -1), 5);

    // --- Quality metrics ---
    // Shadow-to-body ratio quality (higher = better, max at 3x)
    const shadowBodyRatio = body > 0 ? lShadow / body : 0;
    const shadowQuality = Math.min(1.0, shadowBodyRatio / 3.0);

    // How small is the upper shadow
    const upperClean = 1.0 - Math.min(1.0, uShadow / (range * 0.1));

    // Body size relative to ATR
    const bodyQuality = Math.min(1.0, body / (atr * 0.5));

    const patternQuality = (shadowQuality * 0.4 + upperClean * 0.3 + bodyQuality * 0.3);

    const volFactor = volumeConfirmation(indicators);
    const rsiFactor = rsiContext(indicators, 'bullish');
    const trendFactor = priorDowntrend ? 1.0 : 0.4;

    const baseStrength = Math.min(
      0.90,
      patternQuality * 0.35 + volFactor * 0.25 + rsiFactor * 0.2 + trendFactor * 0.2,
    );

    // --- Confluence scoring ---
    const { score: confluenceScore, details: confluenceDetails } = computeConfluence(
      curr.close, 'bullish', indicators,
    );

    const signalStrength = computeFinalSignalStrength(baseStrength, confluenceScore, TIER);

    const confidence = Math.min(1.0, (patternQuality + volFactor + trendFactor) / 3);

    // --- Trade levels ---
    const entryPrice = curr.close;
    const stopLoss = curr.low; // Below the hammer's lower wick
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
        bodySize: body,
        lowerShadow: lShadow,
        upperShadow: uShadow,
        shadowBodyRatio: parseFloat(shadowBodyRatio.toFixed(2)),
        volumeRatio: last(indicators.volumeRatios),
        priorDowntrend,
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Shooting Star (bearish reversal)
// ---------------------------------------------------------------------------

export const shootingStarDetector: PatternDetector = {
  name: 'shooting_star',
  category: 'candlestick',
  tier: 1,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'shooting_star';
    const DIR: PatternDirection = 'bearish';
    const TIER = 1;

    if (candles.length < 6) return noDetection(NAME, DIR, TIER);

    const curr = candles[candles.length - 1];
    const range = candleRange(curr);

    if (range === 0) return noDetection(NAME, DIR, TIER);

    const body = bodySize(curr);
    const lShadow = lowerShadow(curr);
    const uShadow = upperShadow(curr);

    // --- Core pattern checks ---

    // Upper shadow must be at least 2x the body size
    if (uShadow < body * 2) return noDetection(NAME, DIR, TIER);

    // Lower shadow must be very small (< 10% of range)
    if (lShadow > range * 0.1) return noDetection(NAME, DIR, TIER);

    // Body must be in the lower third of the candle
    const bodyBottom = Math.min(curr.open, curr.close);
    if (bodyBottom > curr.low + range * 0.33) return noDetection(NAME, DIR, TIER);

    // Body should be meaningful
    const atr = last(indicators.atr) ?? 1;
    if (body < atr * 0.1) return noDetection(NAME, DIR, TIER);

    // Must appear after an uptrend
    const priorUptrend = isUptrend(candles.slice(0, -1), 5);

    // --- Quality metrics ---
    const shadowBodyRatio = body > 0 ? uShadow / body : 0;
    const shadowQuality = Math.min(1.0, shadowBodyRatio / 3.0);
    const lowerClean = 1.0 - Math.min(1.0, lShadow / (range * 0.1));
    const bodyQuality = Math.min(1.0, body / (atr * 0.5));

    const patternQuality = (shadowQuality * 0.4 + lowerClean * 0.3 + bodyQuality * 0.3);

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
    const stopLoss = curr.high; // Above the shooting star's upper wick
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
        bodySize: body,
        upperShadow: uShadow,
        lowerShadow: lShadow,
        shadowBodyRatio: parseFloat(shadowBodyRatio.toFixed(2)),
        volumeRatio: last(indicators.volumeRatios),
        priorUptrend,
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};
