/**
 * Tests for buildPatternOverlay — the "proof" geometry mapper.
 * Run with:  npx tsx src/lib/patterns/overlay.test.ts
 */
import { buildPatternOverlay } from './overlay';
import type { CandleData } from '@/types/stock';
import type { PatternResult } from '@/types/pattern';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

// 60 daily candles, one per day starting 2026-01-01 (UTC midnights → distinct IST days).
const candles: CandleData[] = Array.from({ length: 60 }, (_, i) => {
  const ts = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000);
  return { timestamp: ts, open: 100, high: 105, low: 95, close: 100, volume: 1000 };
});

function base(name: string, direction: PatternResult['direction'], data: Record<string, unknown>): PatternResult {
  return {
    detected: true, patternName: name, category: 'chart', direction,
    signalStrength: 0.7, confidence: 0.7, entryPrice: 100, stopLoss: 112, target1: 90, target2: 85,
    riskRewardRatio: 1.5,
    confluenceDetails: { dailyPattern: true, volumeConfirmed: true, atKeyLevel: false, weeklyTrendAligned: true, rsiConfirmed: false, emaTrendAligned: false },
    patternData: data,
  };
}

console.log('\nbuildPatternOverlay');

// --- Double Top: two markers + twin-tops line + neckline line ---
{
  const p = base('double_top', 'bearish', {
    top1: { index: 20, price: 110 }, top2: { index: 35, price: 111 },
    necklinePrice: 100, necklineIndex: 28, patternHeight: 10,
    volumeDecliningOnSecondTop: true, priceBelowNeckline: true,
  });
  const ov = buildPatternOverlay(p, candles);
  check('double_top displayName', ov.displayName === 'Double Top');
  check('double_top has 2 pivot markers', ov.markers.length === 2, `got ${ov.markers.length}`);
  check('double_top markers are Top 1 / Top 2', ov.markers[0]?.text === 'Top 1' && ov.markers[1]?.text === 'Top 2');
  check('double_top markers above bar', ov.markers.every((m) => m.position === 'aboveBar'));
  check('double_top has twin-tops + neckline lines', ov.lines.length === 2, `got ${ov.lines.length}`);
  check('double_top top1 time maps to candle 20', ov.markers[0]?.time === '2026-01-21', `got ${ov.markers[0]?.time}`);
  check('double_top neckline extends to last candle', ov.lines.some((l) => l.points.some((pt) => pt.time === '2026-03-01' && pt.price === 100)));
  check('double_top criteria include pattern + confluence (8)', ov.criteria.length === 8, `got ${ov.criteria.length}`);
  check('double_top "closed below neckline" passed', !!ov.criteria.find((c) => c.label.includes('below the neckline'))?.passed);
  check('double_top span starts at top1', ov.fromTime === '2026-01-21', `got ${ov.fromTime}`);
}

// --- Head & Shoulders: LS/Head/RS markers + neckline through troughs ---
{
  const p = base('head_and_shoulders', 'bearish', {
    leftShoulder: { index: 10, price: 108 }, head: { index: 20, price: 115 }, rightShoulder: { index: 30, price: 109 },
    trough1: { index: 15, price: 100 }, trough2: { index: 25, price: 101 },
    necklineSlope: 0.1, necklineIntercept: 100, necklineAtCurrent: 102, patternHeight: 14,
    shoulderSymmetry: 0.95, volumeDeclining: true, priceBelowNeckline: true,
  });
  const ov = buildPatternOverlay(p, candles);
  check('H&S has 3 shoulder/head markers', ov.markers.length === 3, `got ${ov.markers.length}`);
  check('H&S marker labels LS/Head/RS', ov.markers.map((m) => m.text).join(',') === 'LS,Head,RS');
  check('H&S has a neckline line', ov.lines.length >= 1);
  check('H&S neckline has >=2 points', (ov.lines[0]?.points.length ?? 0) >= 2);
}

// --- Unmapped pattern (e.g. ascending_triangle): falls back to entry level line ---
{
  const p = base('ascending_triangle', 'bullish', {});
  const ov = buildPatternOverlay(p, candles);
  check('unmapped pattern falls back to a single entry line', ov.lines.length === 1, `got ${ov.lines.length}`);
  check('unmapped pattern still has 5 confluence criteria', ov.criteria.length === 5, `got ${ov.criteria.length}`);
}
// --- Bear flag now draws pole + channel from its geometry ---
{
  const p = base('bear_flag', 'bearish', {
    poleStartIdx: 10, poleEndIdx: 16, poleStartPrice: 120, poleEndPrice: 100,
    flagStartIdx: 17, flagEndIdx: 24, flagUpperSlope: 0, flagUpperIntercept: 104,
    flagLowerSlope: 0, flagLowerIntercept: 101, poleMovePct: 16, poleVolumeHeavier: true,
  });
  const ov = buildPatternOverlay(p, candles);
  check('bear_flag draws pole + 2 flag channel lines', ov.lines.length === 3, `got ${ov.lines.length}`);
  check('bear_flag marks Pole and Flag points', ov.markers.length === 2, `got ${ov.markers.length}`);
  check('bear_flag criteria include pole-volume check', ov.criteria.some((c) => c.label.includes('volume > flag')));
}

// --- Bad/missing geometry must not throw ---
{
  const p = base('double_top', 'bearish', { top1: null, top2: { index: 999, price: 1 } });
  const ov = buildPatternOverlay(p, candles);
  check('out-of-range index produces no bogus marker', ov.markers.length === 0, `got ${ov.markers.length}`);
}

console.log('');
if (failures > 0) { console.error(`overlay: ${failures} FAILED\n`); process.exit(1); }
else { console.log('overlay: ALL PASSED\n'); }
