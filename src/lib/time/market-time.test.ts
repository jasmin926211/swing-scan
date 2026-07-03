/**
 * Tests for IST market-time helpers.
 * Run with:  npx tsx src/lib/time/market-time.test.ts
 *
 * No test framework — this is a standalone assert script (tsx is already a dep).
 * These tests reproduce the timezone off-by-one bug that corrupted every signal:
 * Upstox daily candles arrive as IST-midnight instants (…T00:00:00+05:30), which
 * on a UTC host read as the PREVIOUS calendar day with naive Date math.
 */
import {
  istDateKey,
  isSameISTDay,
  istStartOfDay,
  isNSETradingDay,
  mostRecentTradingDayKey,
  calendarDaysForTradingDays,
  IST_TIMEZONE,
} from './market-time';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function eq(name: string, actual: unknown, expected: unknown) {
  check(name, actual === expected, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

console.log(`\nmarket-time (timezone: ${IST_TIMEZONE})`);

// --- THE CORE BUG: an IST-midnight candle must map to its IST calendar day ---
// 2024-06-28 00:00 IST === 2024-06-27 18:30 UTC. Naive toISOString() gives 2024-06-27 (WRONG).
const candle = new Date('2024-06-28T00:00:00+05:30');
eq('IST-midnight candle keeps its IST date (not shifted a day back)', istDateKey(candle), '2024-06-28');
eq('naive UTC would have wrongly given the prior day', candle.toISOString().split('T')[0], '2024-06-27');

// A candle late in the IST day
const candleClose = new Date('2024-06-28T15:30:00+05:30');
eq('afternoon IST instant maps to same IST day', istDateKey(candleClose), '2024-06-28');

// --- isSameISTDay: today-candle dedup must not misfire at the UTC boundary ---
// Server "now" early morning IST (e.g. 03:00 IST = 21:30 UTC prior day) vs a candle stamped IST-midnight today.
const nowEarlyIST = new Date('2024-06-28T03:00:00+05:30');
check('isSameISTDay true for two instants on same IST day', isSameISTDay(candle, nowEarlyIST));
check('isSameISTDay false across different IST days',
  !isSameISTDay(candle, new Date('2024-06-27T23:00:00+05:30')));

// --- istStartOfDay: returns the exact IST-midnight instant ---
eq('istStartOfDay of an afternoon instant == IST midnight of that day',
  istStartOfDay(candleClose).toISOString(), new Date('2024-06-28T00:00:00+05:30').toISOString());
eq('istStartOfDay produces a key equal to the IST day', istDateKey(istStartOfDay(candleClose)), '2024-06-28');

// --- NSE trading-day rules (evaluated in IST) ---
check('Mon 2024-06-24 is a trading day', isNSETradingDay(new Date('2024-06-24T10:00:00+05:30')));
check('Sat 2024-06-29 is NOT a trading day', !isNSETradingDay(new Date('2024-06-29T10:00:00+05:30')));
check('Sun 2024-06-30 is NOT a trading day', !isNSETradingDay(new Date('2024-06-30T10:00:00+05:30')));
// Republic Day 2026-01-26 (Monday) is an NSE holiday
check('Republic Day 2026-01-26 is NOT a trading day', !isNSETradingDay(new Date('2026-01-26T10:00:00+05:30')));
// A weekday near a UTC boundary must still be judged by its IST day
check('weekday judged by IST day even when instant is prior UTC day',
  isNSETradingDay(new Date('2026-03-10T01:00:00+05:30'))); // Tue in IST

// --- mostRecentTradingDayKey: skip weekends/holidays backward ---
eq('most recent trading day from Sat 2024-06-29 is Fri 2024-06-28',
  mostRecentTradingDayKey(new Date('2024-06-29T10:00:00+05:30')), '2024-06-28');
eq('most recent trading day from Sun 2024-06-30 is Fri 2024-06-28',
  mostRecentTradingDayKey(new Date('2024-06-30T10:00:00+05:30')), '2024-06-28');
eq('most recent trading day on a normal Wed is itself',
  mostRecentTradingDayKey(new Date('2024-06-26T18:00:00+05:30')), '2024-06-26');

// --- calendar days needed to guarantee N trading days (for EMA200 seeding) ---
check('200 trading days needs >= 280 calendar days', calendarDaysForTradingDays(200) >= 280);

console.log('');
if (failures > 0) {
  console.error(`market-time: ${failures} FAILED\n`);
  process.exit(1);
} else {
  console.log('market-time: ALL PASSED\n');
}
