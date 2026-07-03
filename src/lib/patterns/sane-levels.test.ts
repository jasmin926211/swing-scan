/**
 * Tests for the defense-in-depth trade-level sanity guard.
 * Run with:  npx tsx src/lib/patterns/sane-levels.test.ts
 *
 * This guard is what stops a detector bug (like the flag abs/relative index bug
 * that made NETWEB show entry 7750 at price 4435) from ever reaching the user.
 */
import { hasSaneLevels } from './index';
import type { PatternResult } from '@/types/pattern';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

function res(over: Partial<PatternResult>): PatternResult {
  return {
    detected: true, patternName: 'x', category: 'chart', direction: 'bullish',
    signalStrength: 0.7, confidence: 0.7,
    entryPrice: null, stopLoss: null, target1: null, target2: null, riskRewardRatio: null,
    patternData: {}, ...over,
  };
}

console.log('\nhasSaneLevels guard');

const price = 4435;

// The exact NETWEB bug: bullish, entry ~2x price, stop above everything.
check('rejects NETWEB-style garbage (entry 2x price, stop inverted)',
  !hasSaneLevels(res({ direction: 'bullish', entryPrice: 7750, stopLoss: 10051, target1: 8439 }), price));

// Good bullish setup: entry near price, stop below, target above.
check('accepts a sane bullish setup',
  hasSaneLevels(res({ direction: 'bullish', entryPrice: 4450, stopLoss: 4300, target1: 4800 }), price));

// Good bearish setup: target below entry, stop above entry.
check('accepts a sane bearish setup',
  hasSaneLevels(res({ direction: 'bearish', entryPrice: 4420, stopLoss: 4600, target1: 4000 }), price));

// Bullish with stop on the WRONG side (stop above entry) → reject.
check('rejects bullish with stop above entry',
  !hasSaneLevels(res({ direction: 'bullish', entryPrice: 4450, stopLoss: 4600, target1: 4800 }), price));

// Bearish with target on the WRONG side (target above entry) → reject.
check('rejects bearish with target above entry',
  !hasSaneLevels(res({ direction: 'bearish', entryPrice: 4420, stopLoss: 4600, target1: 4700 }), price));

// Entry just outside the 30% band → reject; just inside → accept.
check('rejects entry >30% from price', !hasSaneLevels(res({ entryPrice: price * 1.31, stopLoss: price * 1.2, target1: price * 1.5 }), price));
check('accepts entry within 30% of price', hasSaneLevels(res({ entryPrice: price * 1.05, stopLoss: price * 0.98, target1: price * 1.2 }), price));

// Null levels are allowed (some patterns legitimately omit them).
check('allows null levels', hasSaneLevels(res({ entryPrice: null, stopLoss: null, target1: null }), price));

// Non-finite / non-positive levels → reject.
check('rejects NaN level', !hasSaneLevels(res({ entryPrice: NaN, stopLoss: 4300, target1: 4800 }), price));
check('rejects zero/negative level', !hasSaneLevels(res({ entryPrice: 4450, stopLoss: 0, target1: 4800 }), price));

console.log('');
if (failures > 0) { console.error(`sane-levels: ${failures} FAILED\n`); process.exit(1); }
else { console.log('sane-levels: ALL PASSED\n'); }
