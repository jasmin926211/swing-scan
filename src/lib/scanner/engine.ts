import pLimit from 'p-limit';
import prisma from '@/lib/prisma';

import { PatternResult } from '@/types/pattern';
import { computeAllIndicators } from '@/lib/indicators';
import { runAllPatterns } from '@/lib/patterns';
import { fetchAndCacheCandles } from '@/lib/upstox/historical';
import { calendarDaysForTradingDays } from '@/lib/time/market-time';

/**
 * Daily history window in CALENDAR days. EMA200 needs 200 completed TRADING bars
 * just to begin producing values, so 200 calendar days (~136 sessions) left it
 * permanently NaN and disabled the golden/death cross. This targets ~260 trading
 * days (~379 calendar days) so EMA200 is well seeded.
 */
const DAILY_HISTORY_CALENDAR_DAYS = calendarDaysForTradingDays(260);

/**
 * Processing concurrency — how many stocks are processed simultaneously.
 * Unlike the old batch approach (wait for slowest in batch before starting next),
 * this uses a concurrent pool: as each stock finishes, the next one starts immediately.
 *
 * API calls are separately rate-limited by rate-limiter.ts (20 concurrent, 250/min).
 * Cached stocks (no API call needed) fly through instantly at full concurrency.
 */
const PROCESSING_CONCURRENCY = 50;

/** How often to update scan progress in DB (every N stocks) */
const PROGRESS_UPDATE_INTERVAL = 25;

let currentScanSession: string | null = null;

export function isScanning(): boolean {
  return currentScanSession !== null;
}

/**
 * Clean up scan sessions that were stuck in "running" state
 * (e.g., server was killed while a scan was in progress).
 * Should be called on server startup.
 */
export async function cleanupStuckSessions(): Promise<number> {
  const result = await prisma.scanSession.updateMany({
    where: { status: 'running' },
    data: {
      status: 'failed',
      completedAt: new Date(),
    },
  });

  if (result.count > 0) {
    console.log(`[Scanner] Cleaned up ${result.count} stuck scan session(s)`);
  }

  return result.count;
}

export async function runScan(
  triggerType: 'manual' | 'scheduled' = 'manual'
): Promise<string> {
  if (currentScanSession) {
    throw new Error('A scan is already in progress');
  }

  // Get all active instruments
  const instruments = await prisma.instrument.findMany({
    where: { isActive: true },
  });

  if (instruments.length === 0) {
    throw new Error('No instruments found. Please sync instruments first.');
  }

  // Create scan session
  const session = await prisma.scanSession.create({
    data: {
      triggerType,
      totalStocks: instruments.length,
      status: 'running',
    },
  });

  currentScanSession = session.id;
  console.log(`Scan started: ${session.id} — ${instruments.length} stocks (concurrency: ${PROCESSING_CONCURRENCY})`);

  let scannedCount = 0;
  let errorCount = 0;
  let patternsFound = 0;
  let lastProgressUpdate = 0;

  const processLimit = pLimit(PROCESSING_CONCURRENCY);

  try {
    // Fire all stocks through the concurrent pool.
    // p-limit ensures at most PROCESSING_CONCURRENCY run simultaneously.
    // API calls within each stock are further throttled by rate-limiter.ts.
    const allPromises = instruments.map((instrument) =>
      processLimit(async () => {
        try {
          // Fetch daily history (enough to seed EMA200 — see constant above)
          const candles = await fetchAndCacheCandles(
            instrument.id,
            instrument.instrumentKey,
            'day',
            DAILY_HISTORY_CALENDAR_DAYS
          );

          if (candles.length < 30) {
            scannedCount++;
            return;
          }

          // Compute technical indicators
          const indicators = computeAllIndicators(candles);

          // Run all pattern detectors
          const patterns = runAllPatterns(candles, indicators);

          // Save detected patterns
          if (patterns.length > 0) {
            const lastCandle = candles[candles.length - 1];
            const lastIdx = candles.length - 1;

            const scanResults = patterns.map((pattern: PatternResult) => ({
              scanSessionId: session.id,
              instrumentId: instrument.id,
              patternName: pattern.patternName,
              patternCategory: pattern.category,
              direction: pattern.direction,
              signalStrength: pattern.signalStrength,
              confidence: pattern.confidence,
              tier: pattern.tier ?? 3,
              confluenceScore: pattern.confluenceScore ?? 0,
              weeklyTrend: indicators.weeklyTrend,
              entryPrice: pattern.entryPrice,
              stopLoss: pattern.stopLoss,
              target1: pattern.target1,
              target2: pattern.target2,
              riskRewardRatio: pattern.riskRewardRatio,
              currentPrice: lastCandle.close,
              rsiValue: indicators.rsi[lastIdx] || null,
              volumeRatio: indicators.volumeRatios[lastIdx] || null,
              ema9: indicators.ema9[lastIdx] || null,
              ema21: indicators.ema21[lastIdx] || null,
              ema50: indicators.ema50[lastIdx] || null,
              ema200: indicators.ema200[lastIdx] || null,
              patternData: JSON.stringify(pattern.patternData),
            }));

            await prisma.scanResult.createMany({ data: scanResults });
            patternsFound += patterns.length;
          }

          scannedCount++;
        } catch (err) {
          errorCount++;
          scannedCount++;
          // Was silently swallowed — a broken feed (expired auth, rate limits,
          // parse errors) looked identical to "scanned fine, no pattern". Log it.
          console.error(
            `[Scanner] Failed to process ${instrument.tradingSymbol}:`,
            err instanceof Error ? err.message : err
          );
        }

        // Update progress periodically (not every stock — reduces DB writes)
        if (scannedCount - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL) {
          lastProgressUpdate = scannedCount;
          await prisma.scanSession.update({
            where: { id: session.id },
            data: { scannedCount, errorCount, patternsFound },
          });
          console.log(`Scan progress: ${scannedCount}/${instruments.length} stocks, ${patternsFound} patterns`);
        }
      })
    );

    await Promise.all(allPromises);

    // Safety gate: if a large fraction of stocks failed to fetch/process, the data
    // feed is broken (expired token, API outage, rate limits). Do NOT present those
    // results as authoritative — mark the session failed so the UI withholds them.
    const errorRate = instruments.length > 0 ? errorCount / instruments.length : 0;
    const scanBroken = errorRate > 0.5;

    await prisma.scanSession.update({
      where: { id: session.id },
      data: {
        status: scanBroken ? 'failed' : 'completed',
        completedAt: new Date(),
        scannedCount,
        errorCount,
        patternsFound,
      },
    });

    if (scanBroken) {
      console.error(
        `[Scanner] Scan FAILED — ${errorCount}/${instruments.length} stocks errored (${(errorRate * 100).toFixed(0)}%). ` +
          `Results withheld; check Upstox auth / API health.`
      );
    } else {
      console.log(`Scan completed: ${scannedCount} stocks, ${patternsFound} patterns, ${errorCount} errors`);
    }
    return session.id;
  } catch (error) {
    await prisma.scanSession.update({
      where: { id: session.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        scannedCount,
        errorCount,
        patternsFound,
      },
    });
    throw error;
  } finally {
    currentScanSession = null;
  }
}

export async function getLatestScanResults(limit: number = 10) {
  const latestSession = await prisma.scanSession.findFirst({
    where: { status: 'completed' },
    orderBy: { completedAt: 'desc' },
  });

  if (!latestSession) return null;

  const results = await prisma.scanResult.findMany({
    where: { scanSessionId: latestSession.id },
    include: { instrument: true },
    // Rank by RELIABILITY first (tier 1 → 3), then signal strength. Previously this
    // sorted by strength only, so a Tier-3 pattern (e.g. measured_move) could top the
    // list above confirmed Tier-1 setups. Highest-reliability signals now surface first.
    orderBy: [{ tier: 'asc' }, { signalStrength: 'desc' }],
    take: limit,
  });

  return {
    session: latestSession,
    // Note: tier, confluenceScore, weeklyTrend fields require `prisma generate`
    // after schema update. They have defaults so existing data still works.
    results: results.map((r: Record<string, unknown> & typeof results[number]) => ({
      id: r.id,
      tradingSymbol: r.instrument.tradingSymbol,
      companyName: r.instrument.companyName,
      patternName: r.patternName,
      patternCategory: r.patternCategory,
      direction: r.direction,
      signalStrength: r.signalStrength,
      confidence: r.confidence,
      tier: (r as Record<string, unknown>).tier ?? 3,
      confluenceScore: (r as Record<string, unknown>).confluenceScore ?? 0,
      weeklyTrend: (r as Record<string, unknown>).weeklyTrend ?? null,
      entryPrice: r.entryPrice,
      stopLoss: r.stopLoss,
      target1: r.target1,
      target2: r.target2,
      riskRewardRatio: r.riskRewardRatio,
      currentPrice: r.currentPrice,
      rsiValue: r.rsiValue,
      volumeRatio: r.volumeRatio,
      ema9: r.ema9,
      ema21: r.ema21,
      ema50: r.ema50,
      ema200: r.ema200,
      sector: r.instrument.sector,
    })),
  };
}

export async function getScanHistory(limit: number = 20) {
  return prisma.scanSession.findMany({
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
}
