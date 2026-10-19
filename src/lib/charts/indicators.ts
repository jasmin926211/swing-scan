/** Indicator series matching the backend's Market Pulse formulas (app/pulse.py), oldest first. */

/** Exponential smoothing like pandas `ewm(alpha, adjust=False)`: starts from the first value. */
function wilder(x: number[], n: number): number[] {
  const a = 1 / n;
  const out: number[] = [];
  x.forEach((v, i) => out.push(i === 0 ? v : a * v + (1 - a) * out[i - 1]));
  return out;
}

/** Wilder RSI(14) for every bar (the first bar has no change, so it starts at the second). */
export function rsiSeries(closes: number[], n = 14): (number | null)[] {
  if (closes.length < 2) return closes.map(() => null);
  const d = closes.slice(1).map((c, i) => c - closes[i]);
  const gain = wilder(d.map((v) => Math.max(v, 0)), n);
  const loss = wilder(d.map((v) => Math.max(-v, 0)), n);
  return [null, ...gain.map((g, i) => (loss[i] === 0 ? 100 : 100 - 100 / (1 + g / loss[i])))];
}

/** ADX(14), Wilder: trend strength 0-100, whatever the direction. */
export function adxSeries(h: number[], l: number[], c: number[], n = 14): number[] {
  const len = c.length;
  const plus: number[] = [], minus: number[] = [], tr: number[] = [];
  for (let i = 0; i < len; i++) {
    const up = i ? h[i] - h[i - 1] : 0;
    const down = i ? l[i - 1] - l[i] : 0;
    plus.push(up > down && up > 0 ? up : 0);
    minus.push(down > up && down > 0 ? down : 0);
    const prev = i ? c[i - 1] : c[0];
    tr.push(Math.max(h[i] - l[i], Math.abs(h[i] - prev), Math.abs(l[i] - prev)));
  }
  const atr = wilder(tr, n), p = wilder(plus, n), m = wilder(minus, n);
  const dx = atr.map((a, i) => {
    const pdi = a ? (100 * p[i]) / a : 0;
    const mdi = a ? (100 * m[i]) / a : 0;
    return pdi + mdi ? (100 * Math.abs(pdi - mdi)) / (pdi + mdi) : 0;
  });
  return wilder(dx, n);
}

/** Simple average of the last n values (null until n exist). */
export function smaSeries(x: number[], n: number): (number | null)[] {
  return x.map((_, i) => (i + 1 < n ? null : x.slice(i + 1 - n, i + 1).reduce((s, v) => s + v, 0) / n));
}

/** For each bar, the highest high of the n bars before it: the level a close must clear to break out. */
export function priorHigh(h: number[], n = 20): (number | null)[] {
  return h.map((_, i) => (i < n ? null : Math.max(...h.slice(i - n, i))));
}
