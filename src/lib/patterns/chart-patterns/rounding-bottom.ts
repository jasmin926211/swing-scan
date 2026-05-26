import { CandleData, IndicatorData } from '@/types/stock';
import {
  PatternResult,
  PatternDetector,
  PatternDirection,
} from '@/types/pattern';
import {
  linearRegression,
  computeSignalStrength,
  calculateRiskReward,
} from '@/lib/patterns/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME = 'rounding_bottom';
const DIR: PatternDirection = 'bullish';
const MIN_CANDLES = 30;
const MAX_WINDOW = 60;
const MIN_R_SQUARED = 0.6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a "not detected" result. */
function noDetection(): PatternResult {
  return {
    detected: false,
    patternName: NAME,
    category: 'chart',
    direction: DIR,
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

/**
 * Fit a quadratic curve  y = a*x^2 + b*x + c  to a set of (x, y) points
 * using the normal equations. Returns { a, b, c, rSquared }.
 */
function fitQuadratic(
  points: { x: number; y: number }[],
): { a: number; b: number; c: number; rSquared: number } | null {
  const n = points.length;
  if (n < 5) return null; // need enough data for a meaningful curve

  // Build sums for normal equations
  let sx = 0, sx2 = 0, sx3 = 0, sx4 = 0;
  let sy = 0, sxy = 0, sx2y = 0;

  for (const p of points) {
    const x = p.x;
    const y = p.y;
    const x2 = x * x;
    sx += x;
    sx2 += x2;
    sx3 += x2 * x;
    sx4 += x2 * x2;
    sy += y;
    sxy += x * y;
    sx2y += x2 * y;
  }

  // Normal equations in matrix form:
  // | n    sx   sx2  | | c |   | sy   |
  // | sx   sx2  sx3  | | b | = | sxy  |
  // | sx2  sx3  sx4  | | a |   | sx2y |
  //
  // Solve using Cramer's rule or direct inversion for 3x3.
  const det =
    n * (sx2 * sx4 - sx3 * sx3) -
    sx * (sx * sx4 - sx3 * sx2) +
    sx2 * (sx * sx3 - sx2 * sx2);

  if (Math.abs(det) < 1e-12) return null;

  const c =
    (sy * (sx2 * sx4 - sx3 * sx3) -
      sx * (sxy * sx4 - sx2y * sx3) +
      sx2 * (sxy * sx3 - sx2y * sx2)) /
    det;

  const b =
    (n * (sxy * sx4 - sx2y * sx3) -
      sy * (sx * sx4 - sx3 * sx2) +
      sx2 * (sx * sx2y - sxy * sx2)) /
    det;

  const a =
    (n * (sx2 * sx2y - sx3 * sxy) -
      sx * (sx * sx2y - sxy * sx2) +
      sy * (sx * sx3 - sx2 * sx2)) /
    det;

  // Compute R-squared
  const meanY = sy / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of points) {
    const predicted = a * p.x * p.x + b * p.x + c;
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }

  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { a, b, c, rSquared };
}

/**
 * Check whether volume forms a U-shape (decreasing in first half, increasing
 * in second half) using simple linear regression on each half.
 */
function isVolumeUShape(candles: CandleData[], startIdx: number, endIdx: number): boolean {
  const len = endIdx - startIdx + 1;
  if (len < 10) return false;

  const midIdx = startIdx + Math.floor(len / 2);

  // First half: volume should be decreasing
  const firstHalfPts: { x: number; y: number }[] = [];
  for (let i = startIdx; i <= midIdx; i++) {
    firstHalfPts.push({ x: i - startIdx, y: candles[i].volume });
  }
  const firstReg = linearRegression(firstHalfPts);

  // Second half: volume should be increasing
  const secondHalfPts: { x: number; y: number }[] = [];
  for (let i = midIdx; i <= endIdx; i++) {
    secondHalfPts.push({ x: i - midIdx, y: candles[i].volume });
  }
  const secondReg = linearRegression(secondHalfPts);

  return firstReg.slope < 0 && secondReg.slope > 0;
}

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

/**
 * **Rounding Bottom** - Bullish reversal pattern (saucer bottom).
 *
 * Price forms a gradual U-shape over 30-60 candles. The curve is confirmed
 * by fitting a quadratic y = a*x^2 + b*x + c where a > 0 (concave up).
 * Volume also typically forms a U-shape -- decreasing in the first half and
 * increasing in the second half.
 *
 * Entry: above the left rim (starting price level).
 * Stop loss: bottom of the curve.
 * Target: entry + depth of the curve.
 */
export const roundingBottomDetector: PatternDetector = {
  name: NAME,
  category: 'chart',

  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    if (candles.length < MIN_CANDLES) return noDetection();

    // Try different window sizes from MAX_WINDOW down to MIN_CANDLES
    const maxWindow = Math.min(MAX_WINDOW, candles.length);

    for (let window = maxWindow; window >= MIN_CANDLES; window -= 5) {
      const startIdx = candles.length - window;
      if (startIdx < 0) continue;

      // ----- Build close-price points -----
      const points: { x: number; y: number }[] = [];
      for (let i = startIdx; i < candles.length; i++) {
        points.push({ x: i - startIdx, y: candles[i].close });
      }

      // ----- Fit quadratic curve -----
      const quad = fitQuadratic(points);
      if (!quad) continue;

      // a must be positive (U-shape / concave up)
      if (quad.a <= 0) continue;

      // R-squared must be adequate
      if (quad.rSquared < MIN_R_SQUARED) continue;

      // ----- Compute curve characteristics -----
      // Vertex (bottom of the U): x_v = -b / (2a)
      const xVertex = -quad.b / (2 * quad.a);
      const yVertex = quad.a * xVertex * xVertex + quad.b * xVertex + quad.c;

      // Vertex should be roughly in the middle third of the window
      const windowLen = points.length;
      if (xVertex < windowLen * 0.2 || xVertex > windowLen * 0.8) continue;

      // ----- Left rim and right rim levels -----
      const leftRimPrice = candles[startIdx].close;
      const rightRimPrice = candles[candles.length - 1].close;
      const curveDepth = leftRimPrice - yVertex;

      // Curve must have meaningful depth (> 3% of left rim price)
      if (curveDepth <= 0 || (curveDepth / leftRimPrice) * 100 < 3) continue;

      // Right rim should be near or above left rim level for a completed pattern
      const rimRatio = rightRimPrice / leftRimPrice;
      if (rimRatio < 0.95) continue; // not yet recovered enough

      // ----- Volume U-shape -----
      const volUShape = isVolumeUShape(candles, startIdx, candles.length - 1);

      // ----- Signal scoring -----
      const patternConfidence = Math.min(1, quad.rSquared);
      const volumeConfirmation = volUShape ? 0.85 : 0.35;
      const trendAlignment = rimRatio >= 1.0 ? 0.9 : 0.6;
      // Proximity: how close the right rim is to breaking above the left rim
      const proximityToBreakout = Math.min(1, Math.max(0, rimRatio - 0.95) / 0.10);

      const signalStrength = computeSignalStrength({
        patternConfidence,
        volumeConfirmation,
        trendAlignment,
        proximityToBreakout,
      });

      const confidence = Math.min(
        1,
        quad.rSquared * 0.35 +
          (volUShape ? 0.25 : 0.1) +
          (rimRatio >= 1.0 ? 0.25 : rimRatio * 0.2) +
          Math.min(1, curveDepth / leftRimPrice / 0.10) * 0.15,
      );

      // ----- Trade levels -----
      const entryPrice = leftRimPrice; // breakout above left rim
      const stopLoss = yVertex;        // bottom of the curve
      const target1 = entryPrice + curveDepth;
      const target2 = entryPrice + curveDepth * 1.618;
      const riskRewardRatio = calculateRiskReward(entryPrice, stopLoss, target1);

      return {
        detected: true,
        patternName: NAME,
        category: 'chart',
        direction: DIR,
        signalStrength: parseFloat(signalStrength.toFixed(3)),
        confidence: parseFloat(confidence.toFixed(3)),
        entryPrice: parseFloat(entryPrice.toFixed(2)),
        stopLoss: parseFloat(stopLoss.toFixed(2)),
        target1: parseFloat(target1.toFixed(2)),
        target2: parseFloat(target2.toFixed(2)),
        riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
        patternData: {
          windowSize: window,
          quadCoeffA: quad.a,
          quadCoeffB: quad.b,
          quadCoeffC: quad.c,
          rSquared: parseFloat(quad.rSquared.toFixed(3)),
          vertexIndex: parseFloat(xVertex.toFixed(1)),
          vertexPrice: parseFloat(yVertex.toFixed(2)),
          leftRimPrice: parseFloat(leftRimPrice.toFixed(2)),
          rightRimPrice: parseFloat(rightRimPrice.toFixed(2)),
          curveDepth: parseFloat(curveDepth.toFixed(2)),
          curveDepthPct: parseFloat(((curveDepth / leftRimPrice) * 100).toFixed(2)),
          volumeUShape: volUShape,
          rimRatio: parseFloat(rimRatio.toFixed(3)),
        },
      };
    }

    return noDetection();
  },
};
