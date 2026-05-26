import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchTodayCandle } from '@/lib/upstox/historical';

// Force dynamic rendering — never cache this route
export const dynamic = 'force-dynamic';

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

    const candles = await prisma.cachedCandle.findMany({
      where: {
        instrumentId: instrument.id,
        interval: 'day',
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
    });

    const formattedCandles = candles.map((c) => ({
      time: c.timestamp.toISOString().split('T')[0],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    // Always fetch today's live candle and append/replace
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCandle = await fetchTodayCandle(instrument.instrumentKey);

    if (todayCandle && todayCandle.close > 0) {
      const lastCandleTime = formattedCandles[formattedCandles.length - 1]?.time;
      const liveCandleFormatted = {
        time: todayStr,
        open: todayCandle.open,
        high: todayCandle.high,
        low: todayCandle.low,
        close: todayCandle.close,
        volume: todayCandle.volume,
      };

      if (lastCandleTime === todayStr) {
        // Replace stale today's candle with fresh live data
        formattedCandles[formattedCandles.length - 1] = liveCandleFormatted;
      } else {
        // Append today's candle
        formattedCandles.push(liveCandleFormatted);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        symbol: instrument.tradingSymbol,
        companyName: instrument.companyName,
        candles: formattedCandles,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch candle data' },
      { status: 500 }
    );
  }
}
