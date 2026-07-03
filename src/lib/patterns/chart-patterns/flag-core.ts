/**
 * Shared Bull/Bear flag detector.
 *
 * Fixes the audited bugs of the old per-file implementations:
 *  - The flag was pinned to the last bar and "breakout" was a circular test
 *    (proximity to a line drawn through the current bar). Now the flag ends just
 *    BEFORE the current bar and the last bar must CONFIRM a break of the flag
 *    boundary (confirmedBreakUp/Down: close beyond, prior close inside).
 *  - The pole's volume surge was computed then discarded. A real flagpole trades
 *    on HEAVIER volume than the flag — now a hard gate (poleVolOk).
 *  - Slice-relative vs full-array index confusion. Everything here uses ABSOLUTE
 *    candle indices, so the geometry maps directly onto the chart overlay.
 */
import type { CandleData, IndicatorData } from '@/types/stock';
import type { PatternResult, PatternDirection } from '@/types/pattern';
import {
  linearRegression,
  fitTrendline,
  findPivotHighs,
  findPivotLows,
  isVolumeDecreasing,
  priceRangeTightness,
  computeSignalStrength,
  calculateRiskReward,
  confirmedBreakUp,
  confirmedBreakDown,
} from '@/lib/patterns/utils';

const MIN_CANDLES = 25;
const SEARCH_WINDOW = 60;
const POLE_MIN = 4;
const POLE_MAX = 12;
const FLAG_MIN = 4;
const FLAG_MAX = 12;
const MIN_POLE_MOVE_PCT = 6;    // flagpole must be a sharp move
const MAX_FLAG_RETRACE_PCT = 55; // flag must not unwind most of the pole

interface Line { slope: number; intercept: number; rSquared: number }

function noDetection(name: string, direction: PatternDirection): PatternResult {
  return {
    detected: false, patternName: name, category: 'chart', direction,
    signalStrength: 0, confidence: 0,
    entryPrice: null, stopLoss: null, target1: null, target2: null, riskRewardRatio: null,
    patternData: {},
  };
}

const lineAt = (l: Line, idx: number) => l.slope * idx + l.intercept;

/** Detect a bull or bear flag on the most recent completed bars. */
export function detectFlag(
  candles: CandleData[],
  indicators: IndicatorData,
  direction: PatternDirection,
): PatternResult {
  const bearish = direction === 'bearish';
  const name = bearish ? 'bear_flag' : 'bull_flag';
  if (candles.length < MIN_CANDLES) return noDetection(name, direction);

  const n = candles.length;
  const lastIdx = n - 1;        // the potential breakout bar
  const flagEndMax = n - 2;     // flag ends just before the breakout bar
  const start = Math.max(0, n - SEARCH_WINDOW);

  interface Best {
    poleStart: number; poleEnd: number; flagStart: number; flagEnd: number;
    poleHeight: number; poleMovePct: number; upperLine: Line; lowerLine: Line;
    breakLevel: number; poleVol: number; flagVol: number;
    flagHigh: number; flagLow: number;
  }
  let best: Best | null = null;
  let bestScore = -1;

  for (let flagLen = FLAG_MIN; flagLen <= FLAG_MAX; flagLen++) {
    const flagEnd = flagEndMax;
    const flagStart = flagEnd - flagLen + 1;
    for (let poleLen = POLE_MIN; poleLen <= POLE_MAX; poleLen++) {
      const poleEnd = flagStart - 1;
      const poleStart = poleEnd - poleLen + 1;
      if (poleStart < start || poleEnd <= poleStart) continue;

      // ----- Pole: a sharp move in the trend direction -----
      const poleStartPrice = bearish ? candles[poleStart].high : candles[poleStart].low;
      const poleEndPrice = bearish ? candles[poleEnd].low : candles[poleEnd].high;
      const poleHeight = Math.abs(poleStartPrice - poleEndPrice);
      const poleMovePct = poleStartPrice > 0 ? (poleHeight / poleStartPrice) * 100 : 0;
      if (poleMovePct < MIN_POLE_MOVE_PCT) continue;

      const polePts = [];
      for (let i = poleStart; i <= poleEnd; i++) polePts.push({ x: i, y: candles[i].close });
      const poleReg = linearRegression(polePts);
      if (bearish && poleReg.slope >= 0) continue;
      if (!bearish && poleReg.slope <= 0) continue;

      // ----- Flag: a shallow counter-trend / sideways drift -----
      const flagPts = [];
      for (let i = flagStart; i <= flagEnd; i++) flagPts.push({ x: i, y: candles[i].close });
      const flagReg = linearRegression(flagPts);
      const flagAvg = flagPts.reduce((s, p) => s + p.y, 0) / flagPts.length;
      const normFlagSlope = flagAvg > 0 ? flagReg.slope / flagAvg : 0;
      // bear flag drifts up/sideways; bull flag drifts down/sideways
      if (bearish && (normFlagSlope < -0.004 || normFlagSlope > 0.03)) continue;
      if (!bearish && (normFlagSlope > 0.004 || normFlagSlope < -0.03)) continue;

      let flagLow = Infinity, flagHigh = -Infinity;
      for (let i = flagStart; i <= flagEnd; i++) {
        if (candles[i].low < flagLow) flagLow = candles[i].low;
        if (candles[i].high > flagHigh) flagHigh = candles[i].high;
      }
      const retrace = bearish
        ? ((flagHigh - poleEndPrice) / poleHeight) * 100
        : ((poleEndPrice - flagLow) / poleHeight) * 100;
      if (retrace > MAX_FLAG_RETRACE_PCT) continue;

      // ----- Volume: flagpole must be HEAVIER than the flag (the discarded check) -----
      let poleVol = 0, flagVol = 0;
      for (let i = poleStart; i <= poleEnd; i++) poleVol += candles[i].volume;
      poleVol /= (poleEnd - poleStart + 1);
      for (let i = flagStart; i <= flagEnd; i++) flagVol += candles[i].volume;
      flagVol /= (flagEnd - flagStart + 1);
      if (poleVol <= flagVol) continue; // hard gate

      // ----- Flag channel boundaries (absolute indices) -----
      const seg = candles.slice(flagStart, flagEnd + 1);
      const hi = findPivotHighs(seg, 1, 1).map((p) => ({ index: p.index + flagStart, price: p.price }));
      const lo = findPivotLows(seg, 1, 1).map((p) => ({ index: p.index + flagStart, price: p.price }));
      const upSlope = (flagHigh - candles[flagStart].high) / Math.max(1, flagLen - 1);
      const loSlope = (flagLow - candles[flagStart].low) / Math.max(1, flagLen - 1);
      const upperLine: Line = hi.length >= 2 ? fitTrendline(hi)! :
        { slope: upSlope, intercept: candles[flagStart].high - upSlope * flagStart, rSquared: 0.5 };
      const lowerLine: Line = lo.length >= 2 ? fitTrendline(lo)! :
        { slope: loSlope, intercept: candles[flagStart].low - loSlope * flagStart, rSquared: 0.5 };

      // ----- Confirmation: last bar breaks the flag boundary -----
      const lastClose = candles[lastIdx].close;
      const prevClose = candles[flagEnd].close;
      let confirmed: boolean, breakLevel: number;
      if (bearish) {
        const supLast = lineAt(lowerLine, lastIdx);
        const supPrev = lineAt(lowerLine, flagEnd);
        confirmed = confirmedBreakDown(lastClose, prevClose, supLast, supPrev);
        breakLevel = supLast;
      } else {
        const resLast = lineAt(upperLine, lastIdx);
        const resPrev = lineAt(upperLine, flagEnd);
        confirmed = confirmedBreakUp(lastClose, prevClose, resLast, resPrev);
        breakLevel = resLast;
      }
      if (!confirmed) continue;

      // ----- Score -----
      const slopeScore = Math.min(1, poleMovePct / 15);
      const volSurge = Math.min(1, poleVol / Math.max(1, flagVol) / 2);
      const flagVolDecr = isVolumeDecreasing(candles, flagStart, flagEnd) ? 1 : 0.6;
      const tight = priceRangeTightness(candles, flagStart, flagEnd);
      const tightScore = tight < 0.06 ? 1 : tight < 0.1 ? 0.7 : 0.4;
      const score = slopeScore * 0.3 + volSurge * 0.3 + flagVolDecr * 0.2 + tightScore * 0.2;

      if (score > bestScore) {
        bestScore = score;
        best = { poleStart, poleEnd, flagStart, flagEnd, poleHeight, poleMovePct, upperLine, lowerLine, breakLevel, poleVol, flagVol, flagHigh, flagLow };
      }
    }
  }

  if (!best || bestScore < 0.4) return noDetection(name, direction);

  // ----- Trade levels: measured move = pole height projected from the break -----
  const entryPrice = best.breakLevel;
  const stopLoss = bearish
    ? lineAt(best.upperLine, best.flagEnd)   // above flag resistance
    : lineAt(best.lowerLine, best.flagEnd);  // below flag support
  const target1 = bearish ? entryPrice - best.poleHeight : entryPrice + best.poleHeight;
  const target2 = bearish ? entryPrice - best.poleHeight * 1.5 : entryPrice + best.poleHeight * 1.5;

  const volSurge = best.poleVol / Math.max(1, best.flagVol);
  const patternConfidence = bestScore;
  const trendAlignment = 0.8; // confirmed break in-direction
  const signalStrength = computeSignalStrength({
    patternConfidence,
    volumeConfirmation: Math.min(1, volSurge / 2),
    trendAlignment,
    proximityToBreakout: 1.0, // break already confirmed
  });

  return {
    detected: true,
    patternName: name,
    category: 'chart',
    direction,
    signalStrength: parseFloat(signalStrength.toFixed(3)),
    confidence: parseFloat(Math.min(1, (patternConfidence + Math.min(1, volSurge / 2)) / 2).toFixed(3)),
    entryPrice: parseFloat(entryPrice.toFixed(2)),
    stopLoss: parseFloat(stopLoss.toFixed(2)),
    target1: parseFloat(target1.toFixed(2)),
    target2: parseFloat(target2.toFixed(2)),
    riskRewardRatio: parseFloat(calculateRiskReward(entryPrice, stopLoss, target1).toFixed(2)),
    patternData: {
      // Absolute-index geometry for the chart overlay
      poleStartIdx: best.poleStart,
      poleEndIdx: best.poleEnd,
      poleStartPrice: bearish ? candles[best.poleStart].high : candles[best.poleStart].low,
      poleEndPrice: bearish ? candles[best.poleEnd].low : candles[best.poleEnd].high,
      flagStartIdx: best.flagStart,
      flagEndIdx: best.flagEnd,
      flagUpperSlope: best.upperLine.slope,
      flagUpperIntercept: best.upperLine.intercept,
      flagLowerSlope: best.lowerLine.slope,
      flagLowerIntercept: best.lowerLine.intercept,
      breakLevel: parseFloat(best.breakLevel.toFixed(2)),
      poleHeight: parseFloat(best.poleHeight.toFixed(2)),
      poleMovePct: parseFloat(best.poleMovePct.toFixed(2)),
      poleVolume: Math.round(best.poleVol),
      flagVolume: Math.round(best.flagVol),
      poleVolumeHeavier: true,
    },
  };
}
