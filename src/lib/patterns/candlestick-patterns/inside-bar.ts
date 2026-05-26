/**
 * Inside Bar pattern detector.
 *
 * Tier 2 — The current candle's entire range (high to low) is contained within
 * the previous candle's range. This signals consolidation and a potential
 * breakout. Direction is determined by the breakout (close relative to
 * the mother bar's midpoint) and trend context.
 *
 * Extremely useful for swing trading — produces strong 5-10 day moves
 * when combined with key levels and volume.
 */

import { CandleData, IndicatorData } from '@/types/stock';
import { PatternResult, PatternDetector, PatternDirection } from '@/types/pattern';
import {
  bodySize,
  candleRange,
  last,
  volumeConfirmation,
  rsiContext,
  noDetection,
  computeConfluence,
  computeFinalSignalStrength,
} from './helpers';

export const insideBarDetector: PatternDetector = {
  name: 'inside_bar',
  category: 'candlestick',
  tier: 2,

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    const NAME = 'inside_bar';
    const TIER = 2;

    if (candles.length < 3) return noDetection(NAME, 'neutral', TIER);

    const mother = candles[candles.length - 2]; // mother bar
    const inside = candles[candles.length - 1]; // inside bar

    // --- Core pattern checks ---

    // Inside bar's range must be entirely within mother bar's range
    if (inside.high > mother.high || inside.low < mother.low) {
      return noDetection(NAME, 'neutral', TIER);
    }

    // Mother bar should have a meaningful range
    const atr = last(indicators.atr) ?? 1;
    if (candleRange(mother) < atr * 0.5) return noDetection(NAME, 'neutral', TIER);

    // Inside bar should be noticeably smaller (range < 75% of mother)
    const rangeRatio = candleRange(inside) / candleRange(mother);
    if (rangeRatio > 0.75) return noDetection(NAME, 'neutral', TIER);

    // --- Determine direction ---
    // Use EMA alignment and RSI to determine likely breakout direction
    const lastEma9 = last(indicators.ema9);
    const lastEma21 = last(indicators.ema21);
    const lastRsi = last(indicators.rsi);

    let direction: PatternDirection = 'neutral';

    if (lastEma9 !== undefined && lastEma21 !== undefined) {
      if (lastEma9 > lastEma21 && inside.close > (mother.high + mother.low) / 2) {
        direction = 'bullish';
      } else if (lastEma9 < lastEma21 && inside.close < (mother.high + mother.low) / 2) {
        direction = 'bearish';
      }
    }

    // If EMAs don't give a clear signal, use RSI
    if (direction === 'neutral' && lastRsi !== undefined) {
      if (lastRsi < 40) direction = 'bullish'; // oversold = expect bullish breakout
      else if (lastRsi > 60) direction = 'bearish'; // overbought = expect bearish breakout
    }

    // If still neutral, use the inside bar's own direction
    if (direction === 'neutral') {
      direction = inside.close > inside.open ? 'bullish' : 'bearish';
    }

    // --- Quality metrics ---
    // Tighter inside bar = better compression = stronger breakout potential
    const compressionQuality = 1.0 - rangeRatio;

    // Mother bar body quality
    const motherBodyQuality = Math.min(1.0, bodySize(mother) / atr);

    // Volume contraction on inside bar (lower = better, signaling compression)
    const motherIdx = candles.length - 2;
    const insideIdx = candles.length - 1;
    const motherVol = indicators.volumeRatios[motherIdx] ?? 1;
    const insideVol = indicators.volumeRatios[insideIdx] ?? 1;
    const volumeContraction = insideVol < motherVol ? 1.0 : 0.5;

    const patternQuality = (compressionQuality * 0.4 + motherBodyQuality * 0.3 + volumeContraction * 0.3);

    const volFactor = volumeConfirmation(indicators);
    const bullishOrBearish = direction === 'bullish' ? 'bullish' : 'bearish';
    const rsiFactor = rsiContext(indicators, bullishOrBearish);

    // Trend alignment via EMAs
    let trendFactor = 0.5;
    if (lastEma9 !== undefined && lastEma21 !== undefined) {
      if (direction === 'bullish' && lastEma9 > lastEma21) trendFactor = 1.0;
      else if (direction === 'bearish' && lastEma9 < lastEma21) trendFactor = 1.0;
      else trendFactor = 0.3;
    }

    const baseStrength = Math.min(
      0.90,
      patternQuality * 0.35 + volFactor * 0.25 + rsiFactor * 0.2 + trendFactor * 0.2,
    );

    const { score: confluenceScore, details: confluenceDetails } = computeConfluence(
      inside.close, bullishOrBearish, indicators,
    );

    const signalStrength = computeFinalSignalStrength(baseStrength, confluenceScore, TIER);
    const confidence = Math.min(1.0, (patternQuality + volFactor + trendFactor) / 3);

    // --- Trade levels ---
    let entryPrice: number;
    let stopLoss: number;
    let target1: number;
    let target2: number;
    let riskRewardRatio: number | null;

    if (direction === 'bullish') {
      entryPrice = mother.high; // Buy on breakout above mother high
      stopLoss = mother.low;    // Stop below mother low
      const risk = entryPrice - stopLoss;
      target1 = entryPrice + 2 * risk;
      target2 = entryPrice + 3 * risk;
      riskRewardRatio = risk > 0 ? 2.0 : null;
    } else {
      entryPrice = mother.low;  // Sell on breakdown below mother low
      stopLoss = mother.high;   // Stop above mother high
      const risk = stopLoss - entryPrice;
      target1 = entryPrice - 2 * risk;
      target2 = entryPrice - 3 * risk;
      riskRewardRatio = risk > 0 ? 2.0 : null;
    }

    return {
      detected: true,
      patternName: NAME,
      category: 'candlestick',
      direction,
      tier: TIER,
      signalStrength: parseFloat(signalStrength.toFixed(3)),
      confidence: parseFloat(confidence.toFixed(3)),
      entryPrice,
      stopLoss,
      target1,
      target2,
      riskRewardRatio,
      confluenceScore,
      confluenceDetails,
      patternData: {
        motherHigh: mother.high,
        motherLow: mother.low,
        motherRange: candleRange(mother),
        insideRange: candleRange(inside),
        rangeRatio: parseFloat(rangeRatio.toFixed(3)),
        compressionQuality: parseFloat(compressionQuality.toFixed(3)),
        volumeContraction: insideVol < motherVol,
        volumeRatio: last(indicators.volumeRatios),
        rsi: last(indicators.rsi),
        confluenceScore,
      },
    };
  },
};
