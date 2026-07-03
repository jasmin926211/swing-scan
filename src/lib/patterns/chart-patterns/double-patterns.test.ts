/**
 * Detector tests for the reworked Double Top / Double Bottom.
 * Run with:  npx tsx src/lib/patterns/chart-patterns/double-patterns.test.ts
 *
 * Proves the two new gates: (1) prior-trend context and (2) a CONFIRMED neckline
 * break — and that stale "already broke days ago" setups no longer fire.
 */
import { doubleTopDetector } from './double-top';
import { doubleBottomDetector } from './double-bottom';
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

// Build candles from [high, low, close] rows; open = previous close.
function build(rows: [number, number, number][]): CandleData[] {
  return rows.map((r, i) => ({
    timestamp: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000),
    open: i === 0 ? r[2] : rows[i - 1][2],
    high: r[0], low: r[1], close: r[2], volume: 1000,
  }));
}

// Double-top shape: head → TOP1(20, high 122) → trough(25, low 102) → rally → TOP2(38, high 123) → tail.
// Highs everywhere else kept well below 122 so only 20 & 38 are pivot highs.
function doubleTop(headRising: boolean, tail: [number, number, number][]): CandleData[] {
  const rows: [number, number, number][] = [];
  for (let i = 0; i < 20; i++) { const c = headRising ? 90 + i * 1.35 : 118; rows.push([c + 0.8, c - 0.8, c]); }
  rows.push([122, 119, 120]);                                   // 20 TOP1
  const pc = [117, 114, 110, 107, 104, 107, 110, 113, 116];      // 21..29
  const pl = [116, 113, 109, 106, 102, 106, 109, 112, 115];      // trough low 102 @ 25
  pc.forEach((c, k) => rows.push([c + 0.8, pl[k], c]));
  [117, 117.5, 118, 118, 117.5, 118, 118, 117.5].forEach((c) => rows.push([c + 0.5, c - 1, c])); // 30..37 rally < 119
  rows.push([123, 120, 121]);                                   // 38 TOP2
  tail.forEach((t) => rows.push(t));
  return build(rows);
}

// Double-bottom shape: head → BOT1(20, low 98) → peak(25, high 120) → dip → BOT2(38, low 99) → tail.
function doubleBottom(headFalling: boolean, tail: [number, number, number][]): CandleData[] {
  const rows: [number, number, number][] = [];
  for (let i = 0; i < 20; i++) { const c = headFalling ? 130 - i * 1.35 : 108; rows.push([c + 0.8, c - 0.8, c]); }
  rows.push([101, 98, 100]);                                    // 20 BOT1
  const pc = [104, 108, 113, 116, 118, 116, 113, 109, 105];      // 21..29
  const ph = [106, 110, 115, 118, 120, 118, 115, 111, 107];      // peak high 120 @ 25
  pc.forEach((c, k) => rows.push([ph[k], c - 1, c]));
  [104, 103.5, 103, 103, 103.5, 103, 103, 103.5].forEach((c) => rows.push([c + 1, c - 1, c])); // 30..37 dip highs < 120
  rows.push([102, 99, 101]);                                    // 38 BOT2
  tail.forEach((t) => rows.push(t));
  return build(rows);
}

console.log('\nDouble Top / Double Bottom gates');

// --- Double Top ---
// Fires: prior uptrend + confirmed breakdown (prev close ≥ neckline 102, last < 102)
{
  const r = doubleTopDetector.detect(doubleTop(true, [
    [118, 114, 116], [115, 111, 113], [112, 108, 110], [109, 105, 107], [106, 102.5, 104], [101, 97, 99],
  ]), IND);
  check('double_top FIRES on prior uptrend + confirmed breakdown', r.detected, JSON.stringify(r.patternData));
  check('double_top is bearish', r.direction === 'bearish');
}
// Blocked: flat head (no prior uptrend) but same breakdown tail
{
  const r = doubleTopDetector.detect(doubleTop(false, [
    [118, 114, 116], [115, 111, 113], [112, 108, 110], [109, 105, 107], [106, 102.5, 104], [101, 97, 99],
  ]), IND);
  check('double_top BLOCKED without prior uptrend', !r.detected);
}
// Blocked: prior uptrend but price never breaks the neckline (all closes > 102)
{
  const r = doubleTopDetector.detect(doubleTop(true, [
    [118, 114, 116], [117, 113, 115], [116, 112, 114], [115, 111, 113], [114, 110, 112], [113, 109, 111],
  ]), IND);
  check('double_top BLOCKED when no neckline break yet', !r.detected);
}
// Blocked: stale — already far below neckline; last bar is not a fresh break
{
  const r = doubleTopDetector.detect(doubleTop(true, [
    [110, 100, 101], [99, 95, 96], [95, 90, 91], [91, 87, 88], [88, 84, 85], [85, 81, 82],
  ]), IND);
  check('double_top BLOCKED on stale (already-broken) setup', !r.detected);
}

// --- Double Bottom ---
// Fires: prior downtrend + confirmed breakout (prev close ≤ neckline 120, last > 120)
{
  const r = doubleBottomDetector.detect(doubleBottom(true, [
    [104, 100, 103], [108, 104, 107], [113, 108, 112], [117, 112, 116], [120, 115, 119], [125, 119, 123],
  ]), IND);
  check('double_bottom FIRES on prior downtrend + confirmed breakout', r.detected, JSON.stringify(r.patternData));
  check('double_bottom is bullish', r.direction === 'bullish');
}
// Blocked: prior downtrend but no breakout (closes stay below neckline 120)
{
  const r = doubleBottomDetector.detect(doubleBottom(true, [
    [104, 100, 103], [107, 103, 106], [110, 106, 109], [113, 109, 112], [116, 112, 115], [118, 114, 117],
  ]), IND);
  check('double_bottom BLOCKED when no neckline break yet', !r.detected);
}

console.log('');
if (failures > 0) { console.error(`double-patterns: ${failures} FAILED\n`); process.exit(1); }
else { console.log('double-patterns: ALL PASSED\n'); }
