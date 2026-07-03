/**
 * Tests for the reworked confluence/scoring system.
 * Run with:  npx tsx src/lib/patterns/candlestick-patterns/helpers.test.ts
 */
import {
  rsiConfirms,
  emaTrendAligned,
  computeConfluence,
  computeFinalSignalStrength,
} from './helpers';
import type { IndicatorData } from '@/types/stock';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

function ind(over: Partial<IndicatorData>): IndicatorData {
  return {
    ema9: [10], ema21: [10], ema50: [10], ema200: [10],
    rsi: [50], atr: [1], avgVolume: 1000, volumeRatios: [1],
    closes: [100], supportLevels: [], resistanceLevels: [], fibonacciLevels: [],
    weeklyTrend: 'neutral',
    ...over,
  };
}

console.log('\nconfluence / scoring rework');

// --- RSI dead zone (was a coin flip at 50) ---
check('bullish RSI 50 does NOT confirm (dead zone)', !rsiConfirms(ind({ rsi: [50] }), 'bullish'));
check('bearish RSI 50 does NOT confirm (dead zone)', !rsiConfirms(ind({ rsi: [50] }), 'bearish'));
check('bullish RSI 40 confirms', rsiConfirms(ind({ rsi: [40] }), 'bullish'));
check('bearish RSI 60 confirms', rsiConfirms(ind({ rsi: [60] }), 'bearish'));

// --- EMA stack alignment ---
check('bullish EMA 9>21>50 aligned', emaTrendAligned(ind({ ema9: [12], ema21: [11], ema50: [10] }), 'bullish'));
check('bullish EMA not stacked → not aligned', !emaTrendAligned(ind({ ema9: [9], ema21: [11], ema50: [10] }), 'bullish'));
check('bearish EMA 9<21<50 aligned', emaTrendAligned(ind({ ema9: [8], ema21: [9], ema50: [10] }), 'bearish'));

// --- No free confluence point ---
{
  const flat = ind({ rsi: [50], volumeRatios: [1], weeklyTrend: 'neutral', ema9: [10], ema21: [10], ema50: [10] });
  const { score } = computeConfluence(100, 'bullish', flat);
  check('zero real confirmations → confluence 0 (no free point)', score === 0, `got ${score}`);
}
// --- All five confirmations → 5 ---
{
  const strong = ind({
    volumeRatios: [2.0], weeklyTrend: 'bullish', rsi: [35],
    ema9: [12], ema21: [11], ema50: [10],
    supportLevels: [100], // price 100 is exactly at support
  });
  const { score, details } = computeConfluence(100, 'bullish', strong);
  check('all five confirmations → score 5', score === 5, `got ${score}`);
  check('details include emaTrendAligned', details.emaTrendAligned === true);
}

// --- Widened multiplier: low confluence now falls below the 0.45 cutoff ---
{
  const s0 = computeFinalSignalStrength(0.7, 0, 1);
  const s5 = computeFinalSignalStrength(0.7, 5, 1);
  check('base 0.7 with 0/5 confluence drops below 0.45 cutoff', s0 < 0.45, `got ${s0}`);
  check('base 0.7 with 5/5 confluence stays strong (>=0.75)', s5 >= 0.75, `got ${s5}`);
  check('strength never exceeds 0.95 cap', computeFinalSignalStrength(0.95, 5, 1) <= 0.95);
  check('tier-3 low-confluence penalized harder than tier-1', computeFinalSignalStrength(0.8, 2, 3) < computeFinalSignalStrength(0.8, 2, 1));
}

console.log('');
if (failures > 0) { console.error(`helpers: ${failures} FAILED\n`); process.exit(1); }
else { console.log('helpers: ALL PASSED\n'); }
