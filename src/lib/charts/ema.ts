/** Exponential moving averages and their crossovers, computed from closes (oldest first). */

export const EMA_PERIODS = [9, 21, 50, 200] as const;
export type EmaPeriod = (typeof EMA_PERIODS)[number];

/** The pairs traders watch: 9 / 21 for short-term turns, 50 / 200 for the golden and death cross. */
export const CROSS_PAIRS: { fast: EmaPeriod; slow: EmaPeriod; up: string; down: string }[] = [
  { fast: 9, slow: 21, up: "Bullish crossover (EMA 9 above 21)", down: "Bearish crossover (EMA 9 below 21)" },
  { fast: 50, slow: 200, up: "Golden cross (EMA 50 above 200)", down: "Death cross (EMA 50 below 200)" },
];

/** EMA with the usual 2 / (n + 1) weight, seeded with the simple average of the first n closes
 *  (as most charting platforms do). null until n closes exist. */
export function ema(closes: number[], n: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < n) return out;
  const k = 2 / (n + 1);
  let prev = closes.slice(0, n).reduce((a, b) => a + b, 0) / n;
  out[n - 1] = prev;
  for (let i = n; i < closes.length; i++) {
    prev = closes[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export type Cross = { i: number; up: boolean; fast: EmaPeriod; slow: EmaPeriod; label: string; value: number };

/** Bars where the fast EMA ends up on the other side of the slow one. Touching without crossing isn't a cross:
 *  each bar is compared with the last side the fast EMA was actually on. */
export function crossovers(fast: (number | null)[], slow: (number | null)[], pair: (typeof CROSS_PAIRS)[number]): Cross[] {
  const out: Cross[] = [];
  let side = 0;
  for (let i = 0; i < fast.length; i++) {
    const [f, s] = [fast[i], slow[i]];
    if (f == null || s == null) continue;
    const now = Math.sign(f - s);
    if (now === 0) continue;
    if (side !== 0 && now !== side) {
      const up = now > 0;
      out.push({ i, up, fast: pair.fast, slow: pair.slow, label: up ? pair.up : pair.down, value: (f + s) / 2 });
    }
    side = now;
  }
  return out;
}
