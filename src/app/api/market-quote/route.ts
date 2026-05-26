import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchMarketQuote } from '@/lib/upstox/historical';

// Force dynamic rendering — never cache this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/market-quote?symbol=RELIANCE
 * Returns real-time LTP and OHLC from Upstox Market Quote API.
 */
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json(
      { success: false, error: 'Symbol query parameter is required' },
      { status: 400 },
    );
  }

  try {
    const instrument = await prisma.instrument.findFirst({
      where: { tradingSymbol: symbol, isActive: true },
    });

    if (!instrument) {
      return NextResponse.json(
        { success: false, error: `Instrument "${symbol}" not found` },
        { status: 404 },
      );
    }

    const quote = await fetchMarketQuote(instrument.instrumentKey);

    if (!quote) {
      return NextResponse.json(
        { success: false, error: 'Market quote unavailable (market may be closed)' },
        { status: 503 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        symbol: instrument.tradingSymbol,
        companyName: instrument.companyName,
        ltp: quote.ltp,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        volume: quote.volume,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch market quote';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
