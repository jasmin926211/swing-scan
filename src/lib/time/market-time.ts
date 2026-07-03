/**
 * IST-correct date helpers for NSE market data.
 *
 * WHY THIS EXISTS: Upstox returns daily candles stamped at IST midnight
 * (e.g. "2024-06-28T00:00:00+05:30", whose UTC instant is 2024-06-27T18:30:00Z).
 * On a non-IST host (Vercel/most clouds run in UTC) naive `date-fns` calls
 * (startOfDay, isSameDay, toISOString().split('T')[0]) evaluate in the SERVER's
 * timezone and read that candle as the PREVIOUS calendar day — shifting every
 * chart date back one day and mis-deduping "today's" candle. That corrupts the
 * last candle every indicator and pattern is built on.
 *
 * Every date decision in the candle/scan path must go through these helpers.
 * They mirror the correct pattern already used in upstox/auth.ts.
 */
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { getDay, subDays } from 'date-fns';

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * NSE full-day trading holidays (IST calendar-day keys, 'yyyy-MM-dd').
 * Weekends are handled separately. This list must be refreshed each year from
 * the official NSE holiday calendar: https://www.nseindia.com/resources/exchange-communication-holidays
 * A missing entry only risks appending one stale "today" candle on that day;
 * it never affects historical candles.
 */
export const NSE_HOLIDAYS = new Set<string>([
  // 2025
  '2025-02-26', // Mahashivratri
  '2025-03-14', // Holi
  '2025-03-31', // Id-ul-Fitr (Ramzan)
  '2025-04-10', // Mahavir Jayanti
  '2025-04-14', // Dr. Ambedkar Jayanti
  '2025-04-18', // Good Friday
  '2025-05-01', // Maharashtra Day
  '2025-08-15', // Independence Day
  '2025-08-27', // Ganesh Chaturthi
  '2025-10-02', // Mahatma Gandhi Jayanti / Dussehra
  '2025-10-21', // Diwali Laxmi Pujan
  '2025-10-22', // Diwali Balipratipada
  '2025-11-05', // Prakash Gurpurb Sri Guru Nanak Dev
  '2025-12-25', // Christmas
  // 2026 (verify against official NSE calendar when published)
  '2026-01-26', // Republic Day
  '2026-03-04', // Holi
  '2026-04-03', // Good Friday
  '2026-05-01', // Maharashtra Day
  '2026-08-15', // Independence Day
  '2026-10-02', // Mahatma Gandhi Jayanti
  '2026-12-25', // Christmas
]);

/** 'yyyy-MM-dd' for the IST calendar day the instant falls on. */
export function istDateKey(date: Date = new Date()): string {
  return formatInTimeZone(date, IST_TIMEZONE, 'yyyy-MM-dd');
}

/** Do two instants fall on the same IST calendar day? Replacement for date-fns isSameDay. */
export function isSameISTDay(a: Date, b: Date): boolean {
  return istDateKey(a) === istDateKey(b);
}

/**
 * UTC instant corresponding to IST midnight (start of the IST day) of `date`.
 * Use this to stamp a synthesized "today" candle so it aligns with Upstox's
 * IST-midnight daily candles. Replacement for date-fns startOfDay in this path.
 */
export function istStartOfDay(date: Date = new Date()): Date {
  return fromZonedTime(`${istDateKey(date)}T00:00:00`, IST_TIMEZONE);
}

/** Noon-IST instant for a given IST date key — a safe anchor away from day boundaries. */
function noonIST(key: string): Date {
  return fromZonedTime(`${key}T12:00:00`, IST_TIMEZONE);
}

/** Is `date` an NSE trading day (weekday and not a holiday), evaluated in IST? */
export function isNSETradingDay(date: Date = new Date()): boolean {
  const dow = getDay(toZonedTime(date, IST_TIMEZONE)); // 0 Sun … 6 Sat, in IST
  if (dow === 0 || dow === 6) return false;
  return !NSE_HOLIDAYS.has(istDateKey(date));
}

/** The most recent NSE trading day on or before `date`, as an IST 'yyyy-MM-dd' key. */
export function mostRecentTradingDayKey(date: Date = new Date()): string {
  let key = istDateKey(date);
  for (let i = 0; i < 15; i++) {
    if (isNSETradingDay(noonIST(key))) return key;
    key = istDateKey(subDays(noonIST(key), 1));
  }
  return key; // fallback (should never hit 15 non-trading days in a row)
}

/**
 * Calendar days needed to comfortably cover `tradingDays` NSE sessions.
 * ~5 trading days per 7 calendar days, plus a holiday buffer. Used so a 200-bar
 * EMA (EMA200) is actually seeded instead of returning an all-NaN array.
 */
export function calendarDaysForTradingDays(tradingDays: number): number {
  return Math.ceil((tradingDays * 7) / 5) + 15;
}
