/**
 * Detector tests for the reworked Bull/Bear flags (flag-core).
 * Run with:  npx tsx src/lib/patterns/chart-patterns/flags.test.ts
 *
 * Proves: confirmed-breakout gate, the pole-volume-heavier gate (the previously
 * discarded check), and correct direction.
 */
import { bearFlagDetector } from './bear-flag';
import { bullFlagDetector } from './bull-flag';
import type { CandleData, IndicatorData } from '@/types/stock';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

const IND: IndicatorData = {
  ema9: [], ema21: [], ema50: [], ema200: [], rsi: [], atr: [],
  avgVolume: 1000, volumeRatios: [1.6], closes: [], supportLevels: [], resistanceLevels: [],
  fibonacciLevels: [], weeklyTrend: 'neutral',
};

function build(rows: [number, number, number, number][]): CandleData[] {
  return rows.map((r, i) => ({
    timestamp: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000),
    open: i === 0 ? r[2] : rows[i - 1][2],
    high: r[0], low: r[1], close: r[2], volume: r[3],
  }));
}

// Bear flag: flat lead-in → sharp down pole (heavy vol) → shallow up flag (light vol) → last-bar tail.
function bearFlag(last: { h: number; l: number; c: number }, poleVol: number): CandleData[] {
  const rows: [number, number, number, number][] = [];
  for (let i = 0; i < 15; i++) rows.push([201, 199, 200, 500]);
  rows.push([201, 195, 196, poleVol], [197, 189, 190, poleVol], [191, 183, 184, poleVol],
            [185, 177, 178, poleVol], [179, 172, 173, poleVol], [174, 168, 169, poleVol]); // 15..20 pole
  rows.push([172, 169, 170, 800], [172.5, 169.5, 171, 800], [173, 170, 171.5, 800],
            [173.5, 170.5, 172, 800], [174, 171, 172.5, 800], [174.5, 171.5, 173, 800],
            [175, 172, 173.5, 800]); // 21..27 flag (light volume)
  rows.push([last.h, last.l, last.c, 2500]); // 28 breakout bar
  return build(rows);
}

// Bull flag mirror.
function bullFlag(last: { h: number; l: number; c: number }, poleVol: number): CandleData[] {
  const rows: [number, number, number, number][] = [];
  for (let i = 0; i < 15; i++) rows.push([169, 167, 168, 1000]);
  rows.push([173, 168, 172, poleVol], [179, 173, 178, poleVol], [185, 179, 184, poleVol],
            [191, 185, 190, poleVol], [197, 191, 196, poleVol], [202, 196, 201, poleVol]); // 15..20 pole up
  rows.push([200, 197, 199, 800], [199.5, 196.5, 198.5, 800], [199, 196, 198, 800],
            [198.5, 195.5, 197.5, 800], [198, 195, 197, 800], [197.5, 194.5, 196.5, 800],
            [197, 194, 196, 800]); // 21..27 flag drifts down (light volume)
  rows.push([last.h, last.l, last.c, 2500]); // 28 breakout bar
  return build(rows);
}

console.log('\nBull / Bear flag gates');

// Bear flag FIRES: confirmed breakdown below flag support, heavy pole volume
{
  const r = bearFlagDetector.detect(bearFlag({ h: 170, l: 163, c: 164 }, 3000), IND);
  check('bear_flag FIRES on confirmed breakdown + heavy pole', r.detected, JSON.stringify(r.patternData));
  check('bear_flag is bearish', r.direction === 'bearish');
  check('bear_flag exposes pole geometry for the chart', typeof (r.patternData as Record<string, unknown>).poleStartIdx === 'number');
}
// Bear flag BLOCKED: last bar stays inside the flag (no break)
{
  const r = bearFlagDetector.detect(bearFlag({ h: 175, l: 172, c: 173 }, 3000), IND);
  check('bear_flag BLOCKED when no breakdown', !r.detected);
}
// Bear flag BLOCKED: pole volume NOT heavier than flag
{
  const r = bearFlagDetector.detect(bearFlag({ h: 170, l: 163, c: 164 }, 700), IND);
  check('bear_flag BLOCKED when pole volume ≤ flag volume', !r.detected);
}

// Bull flag FIRES: confirmed breakout above flag resistance
{
  const r = bullFlagDetector.detect(bullFlag({ h: 208, l: 199, c: 206 }, 3000), IND);
  check('bull_flag FIRES on confirmed breakout + heavy pole', r.detected, JSON.stringify(r.patternData));
  check('bull_flag is bullish', r.direction === 'bullish');
}
// Bull flag BLOCKED: no breakout
{
  const r = bullFlagDetector.detect(bullFlag({ h: 199, l: 195, c: 197 }, 3000), IND);
  check('bull_flag BLOCKED when no breakout', !r.detected);
}

console.log('');
if (failures > 0) { console.error(`flags: ${failures} FAILED\n`); process.exit(1); }
else { console.log('flags: ALL PASSED\n'); }
