/**
 * Pattern overlay builder — turns a detector's stored `patternData` geometry into
 * chart-ready primitives (lines, markers) plus a human-readable criteria checklist.
 *
 * This is the "proof" layer: given a detected pattern and the SAME candle array it
 * was detected on, it produces the shape to draw on the chart (necklines, connecting
 * trendlines, pivot markers) and the list of conditions the pattern did / didn't meet,
 * so a trader can eyeball whether the signal is real.
 *
 * Index → time mapping uses IST dates (see market-time) so overlays line up exactly
 * with the candlestick series, regardless of server timezone.
 *
 * Coverage note: patterns whose detectors emit clean full-array geometry
 * (double top/bottom, head & shoulders ±inverse) get their full shape drawn now.
 * Every other pattern still gets its criteria checklist + trade levels; their full
 * geometry is standardized as detectors are rewritten in Phase 3.
 */
import type { CandleData } from '@/types/stock';
import { PATTERN_DISPLAY_NAMES, type PatternResult } from '@/types/pattern';
import { istDateKey } from '@/lib/time/market-time';

export interface OverlayPoint {
  time: string; // 'yyyy-MM-dd' (IST)
  price: number;
}
export interface OverlayLine {
  points: OverlayPoint[];
  color: string;
  width?: number;
  dashed?: boolean;
  label?: string;
}
export interface OverlayMarker {
  time: string;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  color: string;
  text: string;
}
export interface OverlayCriterion {
  label: string;
  passed: boolean;
}
export interface PatternOverlay {
  patternName: string;
  displayName: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  /** Time span of the pattern, used for hover detection. */
  fromTime: string | null;
  toTime: string | null;
  lines: OverlayLine[];
  markers: OverlayMarker[];
  criteria: OverlayCriterion[];
}

// Semantic + structural colors (aligned with the app theme).
const COLOR = {
  bull: '#4CFA9D',
  bear: '#E3507A',
  neutral: '#53B9EA',
  neckline: '#F5A623',
  pivot: '#53B9EA',
};

type PD = Record<string, unknown>;

function timeAt(candles: CandleData[], idx: unknown): string | null {
  if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= candles.length) {
    return null;
  }
  return istDateKey(candles[idx].timestamp);
}
function asNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function pt(v: unknown): { index: number; price: number } | null {
  if (v && typeof v === 'object') {
    const o = v as PD;
    const i = asNum(o.index);
    const p = asNum(o.price);
    if (i !== null && p !== null) return { index: i, price: p };
  }
  return null;
}

/** Confluence-based criteria shared by every pattern (from Phase-1 confluence details). */
function confluenceCriteria(p: PatternResult): OverlayCriterion[] {
  const d = p.confluenceDetails;
  if (!d) return [];
  return [
    { label: 'Volume ≥ 1.5× average', passed: !!d.volumeConfirmed },
    { label: 'At key support/resistance or Fib level', passed: !!d.atKeyLevel },
    { label: 'Weekly trend aligned with signal', passed: !!d.weeklyTrendAligned },
    { label: 'RSI confirms direction', passed: !!d.rsiConfirmed },
    { label: 'EMA 9/21/50 stacked with trend', passed: !!d.emaTrendAligned },
  ];
}

/**
 * Build the visual overlay for a detected pattern.
 * `candles` MUST be the exact array the pattern was detected on (so indices map).
 */
export function buildPatternOverlay(p: PatternResult, candles: CandleData[]): PatternOverlay {
  const pd = (p.patternData ?? {}) as PD;
  const dirColor = p.direction === 'bearish' ? COLOR.bear : p.direction === 'bullish' ? COLOR.bull : COLOR.neutral;
  const lastTime = timeAt(candles, candles.length - 1);

  const overlay: PatternOverlay = {
    patternName: p.patternName,
    displayName: PATTERN_DISPLAY_NAMES[p.patternName] ?? p.patternName,
    direction: p.direction,
    fromTime: null,
    toTime: lastTime,
    lines: [],
    markers: [],
    criteria: [],
  };

  const pivotMarker = (
    point: { index: number; price: number } | null,
    text: string,
    position: 'aboveBar' | 'belowBar',
  ) => {
    if (!point) return null;
    const time = timeAt(candles, point.index);
    if (!time) return null;
    overlay.markers.push({ time, position, shape: 'circle', color: dirColor, text });
    return time;
  };

  const horizontalFrom = (fromTime: string | null, price: number | null, color: string, label: string, dashed = true) => {
    if (!fromTime || price === null || !lastTime) return;
    overlay.lines.push({ points: [{ time: fromTime, price }, { time: lastTime, price }], color, dashed, label });
  };

  switch (p.patternName) {
    case 'double_top': {
      const t1 = pt(pd.top1);
      const t2 = pt(pd.top2);
      const neck = asNum(pd.necklinePrice);
      const time1 = pivotMarker(t1, 'Top 1', 'aboveBar');
      const time2 = pivotMarker(t2, 'Top 2', 'aboveBar');
      if (time1 && time2 && t1 && t2) {
        overlay.lines.push({ points: [{ time: time1, price: t1.price }, { time: time2, price: t2.price }], color: COLOR.bear, width: 2, label: 'Twin tops' });
      }
      horizontalFrom(time1, neck, COLOR.neckline, 'Neckline (breakdown)');
      overlay.fromTime = time1;
      overlay.criteria.push(
        { label: 'Two tops at equal highs', passed: true },
        { label: 'Lower volume on 2nd top (divergence)', passed: !!pd.volumeDecliningOnSecondTop },
        { label: 'Closed below the neckline', passed: !!pd.priceBelowNeckline },
      );
      break;
    }
    case 'double_bottom': {
      const b1 = pt(pd.bottom1);
      const b2 = pt(pd.bottom2);
      const neck = asNum(pd.necklinePrice);
      const time1 = pivotMarker(b1, 'Bottom 1', 'belowBar');
      const time2 = pivotMarker(b2, 'Bottom 2', 'belowBar');
      if (time1 && time2 && b1 && b2) {
        overlay.lines.push({ points: [{ time: time1, price: b1.price }, { time: time2, price: b2.price }], color: COLOR.bull, width: 2, label: 'Twin bottoms' });
      }
      horizontalFrom(time1, neck, COLOR.neckline, 'Neckline (breakout)');
      overlay.fromTime = time1;
      overlay.criteria.push(
        { label: 'Two bottoms at equal lows', passed: true },
        { label: 'Higher volume on 2nd bottom', passed: !!pd.volumeIncreasingOnSecondBottom },
        { label: 'Closed above the neckline', passed: !!pd.priceAboveNeckline },
      );
      break;
    }
    case 'head_and_shoulders':
    case 'inverse_head_and_shoulders': {
      const ls = pt(pd.leftShoulder);
      const head = pt(pd.head);
      const rs = pt(pd.rightShoulder);
      const tr1 = pt(pd.trough1);
      const tr2 = pt(pd.trough2);
      const inverse = p.patternName === 'inverse_head_and_shoulders';
      const pos = inverse ? 'belowBar' : 'aboveBar';
      pivotMarker(ls, 'LS', pos);
      pivotMarker(head, 'Head', pos);
      pivotMarker(rs, 'RS', pos);
      // Neckline through the two troughs (or peaks for inverse), extended to now.
      const neckColor = COLOR.neckline;
      if (tr1 && tr2) {
        const nt1 = timeAt(candles, tr1.index);
        const nt2 = timeAt(candles, tr2.index);
        if (nt1 && nt2 && lastTime) {
          const slope = asNum(pd.necklineSlope);
          const necklineNow = asNum(pd.necklineAtCurrent);
          // Draw neckline from first trough, through second, extended to the last bar.
          const points: OverlayPoint[] = [{ time: nt1, price: tr1.price }, { time: nt2, price: tr2.price }];
          if (necklineNow !== null && slope !== null) points.push({ time: lastTime, price: necklineNow });
          overlay.lines.push({ points, color: neckColor, width: 2, dashed: true, label: 'Neckline' });
        }
      }
      overlay.fromTime = timeAt(candles, ls?.index);
      overlay.criteria.push(
        { label: inverse ? 'Head below both shoulders' : 'Head above both shoulders', passed: true },
        { label: 'Shoulders roughly symmetric', passed: (asNum(pd.shoulderSymmetry) ?? 0) > 0.9 },
        { label: 'Volume declining L→Head→R', passed: !!pd.volumeDeclining },
        { label: inverse ? 'Closed above neckline' : 'Closed below neckline', passed: inverse ? !pd.priceBelowNeckline : !!pd.priceBelowNeckline },
      );
      break;
    }
    case 'bull_flag':
    case 'bear_flag': {
      const bear = p.patternName === 'bear_flag';
      const psi = asNum(pd.poleStartIdx);
      const pei = asNum(pd.poleEndIdx);
      const psp = asNum(pd.poleStartPrice);
      const pep = asNum(pd.poleEndPrice);
      const fsi = asNum(pd.flagStartIdx);
      const fei = asNum(pd.flagEndIdx);
      const upS = asNum(pd.flagUpperSlope);
      const upI = asNum(pd.flagUpperIntercept);
      const loS = asNum(pd.flagLowerSlope);
      const loI = asNum(pd.flagLowerIntercept);
      const psTime = timeAt(candles, psi ?? -1);
      const peTime = timeAt(candles, pei ?? -1);
      if (psTime && peTime && psp !== null && pep !== null) {
        overlay.lines.push({ points: [{ time: psTime, price: psp }, { time: peTime, price: pep }], color: dirColor, width: 2, label: 'Flagpole' });
        overlay.markers.push({ time: psTime, position: bear ? 'aboveBar' : 'belowBar', shape: 'circle', color: dirColor, text: 'Pole' });
        overlay.markers.push({ time: peTime, position: bear ? 'belowBar' : 'aboveBar', shape: 'circle', color: dirColor, text: 'Flag' });
      }
      const fsTime = timeAt(candles, fsi ?? -1);
      const feTime = timeAt(candles, fei ?? -1);
      if (fsTime && feTime && fsi !== null && fei !== null) {
        if (upS !== null && upI !== null) overlay.lines.push({ points: [{ time: fsTime, price: upS * fsi + upI }, { time: feTime, price: upS * fei + upI }], color: COLOR.neckline, dashed: true, label: 'Flag top' });
        if (loS !== null && loI !== null) overlay.lines.push({ points: [{ time: fsTime, price: loS * fsi + loI }, { time: feTime, price: loS * fei + loI }], color: COLOR.neckline, dashed: true, label: 'Flag bottom' });
      }
      overlay.fromTime = psTime;
      overlay.criteria.push(
        { label: 'Sharp flagpole (≥6% move)', passed: (asNum(pd.poleMovePct) ?? 0) >= 6 },
        { label: 'Flagpole volume > flag volume', passed: !!pd.poleVolumeHeavier },
        { label: bear ? 'Closed below flag support' : 'Closed above flag resistance', passed: true },
      );
      break;
    }
    default: {
      // Patterns without standardized geometry yet (triangles, wedges, …):
      // show the entry level as the actionable line + criteria. Full shapes land
      // as each detector is rewritten in Phase 3.
      if (p.entryPrice !== null) {
        horizontalFrom(timeAt(candles, Math.max(0, candles.length - 40)), p.entryPrice, dirColor, 'Entry / breakout level');
        overlay.fromTime = timeAt(candles, Math.max(0, candles.length - 40));
      }
      break;
    }
  }

  overlay.criteria.push(...confluenceCriteria(p));
  return overlay;
}
