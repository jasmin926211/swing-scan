import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchTodayCandle } from '@/lib/upstox/historical';
import { istDateKey, isSameISTDay } from '@/lib/time/market-time';
import { computeAllIndicators } from '@/lib/indicators';
import { runAllPatterns } from '@/lib/patterns';
import { buildPatternOverlay } from '@/lib/patterns/overlay';
import type { CandleData } from '@/types/stock';

// Force dynamic rendering — never cache this route
export const dynamic = 'force-dynamic';

/** How many detected patterns to return overlays for (highest-conviction first). */
const MAX_PATTERNS = 6;

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = decodeURIComponent(params.symbol);

  try {
    const instrument = await prisma.instrument.findFirst({
      where: { tradingSymbol: symbol },
    });

    if (!instrument) {
      return NextResponse.json(
        { success: false, error: 'Instrument not found' },
        { status: 404 }
      );
    }

    const cached = await prisma.cachedCandle.findMany({
      where: { instrumentId: instrument.id, interval: 'day' },
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true, open: true, high: true, low: true, close: true, volume: true },
    });

    // Build a single CandleData[] the chart AND pattern detection share, so overlay
    // indices map exactly to the rendered candles.
    const candleData: CandleData[] = cached.map((c) => ({
      timestamp: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    // Append today's live candle (null on weekends/holidays), replacing a stale same-day bar.
    const todayCandle = await fetchTodayCandle(instrument.instrumentKey);
    if (todayCandle && todayCandle.close > 0) {
      const last = candleData[candleData.length - 1];
      if (last && isSameISTDay(last.timestamp, todayCandle.timestamp)) {
        candleData[candleData.length - 1] = todayCandle;
      } else {
        candleData.push(todayCandle);
      }
    }

    const formattedCandles = candleData.map((c) => ({
      time: istDateKey(c.timestamp), // IST trading day
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    // Detect patterns on these exact candles and build aligned overlays ("proof").
    let patterns: unknown[] = [];
    if (candleData.length >= 30) {
      const indicators = computeAllIndicators(candleData);
      const detected = runAllPatterns(candleData, indicators);
      patterns = detected.slice(0, MAX_PATTERNS).map((p) => ({
        patternName: p.patternName,
        displayName: undefined, // filled by overlay.displayName
        direction: p.direction,
        signalStrength: p.signalStrength,
        confidence: p.confidence,
        tier: p.tier ?? 3,
        confluenceScore: p.confluenceScore ?? 0,
        entryPrice: p.entryPrice,
        stopLoss: p.stopLoss,
        target1: p.target1,
        target2: p.target2,
        riskRewardRatio: p.riskRewardRatio,
        overlay: buildPatternOverlay(p, candleData),
      }));
    }

    return NextResponse.json({
      success: true,
      data: {
        symbol: instrument.tradingSymbol,
        companyName: instrument.companyName,
        candles: formattedCandles,
        patterns,
      },
    });
  } catch (err) {
    console.error(`[Candles] Failed for ${symbol}:`, err instanceof Error ? err.message : err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch candle data' },
      { status: 500 }
    );
  }
}
