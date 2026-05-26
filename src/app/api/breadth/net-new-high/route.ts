import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Force dynamic rendering — never cache this route
export const dynamic = 'force-dynamic';

interface StockCandles {
  instrumentId: string;
  tradingSymbol: string;
  companyName: string;
  sector: string | null;
  candles: { high: number; low: number; close: number; timestamp: Date }[];
}

/**
 * For a given day index, check if that day's high is a 52-week high
 * (highest high in all available data up to that day) and if low is a 52-week low.
 * Uses all available candles from index 0 to dayIndex (capped at lookback).
 */
function check52WeekStatus(
  candles: { high: number; low: number; close: number }[],
  dayIndex: number,
  lookback: number
) {
  const start = Math.max(0, dayIndex - lookback + 1);
  let maxHigh = -Infinity;
  let minLow = Infinity;

  for (let i = start; i <= dayIndex; i++) {
    if (candles[i].high > maxHigh) maxHigh = candles[i].high;
    if (candles[i].low < minLow) minLow = candles[i].low;
  }

  const isNewHigh = candles[dayIndex].high >= maxHigh * 0.998;
  const isNewLow = candles[dayIndex].low <= minLow * 1.002;

  return { isNewHigh, isNewLow, high52w: maxHigh, low52w: minLow };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const historyDays = Math.min(60, Math.max(1, parseInt(searchParams.get('history') || '30', 10)));

  try {
    // Get all active instruments with their candles in one query
    const instruments = await prisma.instrument.findMany({
      where: { isActive: true, isNifty500: true },
      select: {
        id: true,
        tradingSymbol: true,
        companyName: true,
        sector: true,
        candles: {
          where: { interval: 'day' },
          orderBy: { timestamp: 'asc' },
          select: { high: true, low: true, close: true, timestamp: true },
        },
      },
    });

    // Filter instruments with enough data (at least 50 candles)
    const validStocks: StockCandles[] = instruments
      .filter((inst) => inst.candles.length >= 50)
      .map((inst) => ({
        instrumentId: inst.id,
        tradingSymbol: inst.tradingSymbol,
        companyName: inst.companyName,
        sector: inst.sector,
        candles: inst.candles,
      }));

    const totalWithData = validStocks.length;
    if (totalWithData === 0) {
      return NextResponse.json({
        success: true,
        data: {
          newHighs: 0,
          newLows: 0,
          netNewHigh: 0,
          totalStocks: 0,
          nearHighs: 0,
          nearLows: 0,
          stocks: { atNewHigh: [], atNewLow: [], nearHigh: [], nearLow: [] },
          sectorBreakdown: [],
          history: [],
          ma10: null,
          ma20: null,
          divergence: null,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // 52 weeks = 252 trading days, but use whatever data we have
    const lookback = 252;

    // --- Calculate HISTORICAL Net New Highs ---
    // Use the stock with the most candles as a date reference
    const maxCandleCount = Math.max(...validStocks.map((s) => s.candles.length));
    const refStock = validStocks.find((s) => s.candles.length === maxCandleCount)!;
    const totalDays = refStock.candles.length;

    // We need at least 20 candles of lookback before we start computing history.
    // Start computing from max(20, totalDays - historyDays) to get `historyDays` entries
    const minRequiredLookback = 20;
    const historyStartIdx = Math.max(minRequiredLookback, totalDays - historyDays);

    const nnh_history: {
      date: string;
      netNewHigh: number;
      newHighs: number;
      newLows: number;
    }[] = [];

    for (let dayOffset = historyStartIdx; dayOffset < totalDays; dayOffset++) {
      let dayHighs = 0;
      let dayLows = 0;

      for (const stock of validStocks) {
        // Align stocks by end: map refStock index to this stock's index
        const stockOffset = dayOffset - (totalDays - stock.candles.length);
        if (stockOffset < minRequiredLookback || stockOffset < 0 || stockOffset >= stock.candles.length) continue;

        const { isNewHigh, isNewLow } = check52WeekStatus(
          stock.candles,
          stockOffset,
          lookback
        );
        if (isNewHigh) dayHighs++;
        if (isNewLow) dayLows++;
      }

      const dateStr = refStock.candles[dayOffset].timestamp.toISOString().split('T')[0];
      nnh_history.push({
        date: dateStr,
        netNewHigh: dayHighs - dayLows,
        newHighs: dayHighs,
        newLows: dayLows,
      });
    }

    // --- Calculate Moving Averages ---
    const calcMA = (values: number[], period: number): number | null => {
      if (values.length < period) return null;
      const slice = values.slice(-period);
      return parseFloat((slice.reduce((a, b) => a + b, 0) / period).toFixed(2));
    };

    const nnh_values = nnh_history.map((h) => h.netNewHigh);
    const ma10 = calcMA(nnh_values, 10);
    const ma20 = calcMA(nnh_values, 20);

    // Add MAs to history entries
    const historyWithMA = nnh_history.map((entry, i) => {
      const idx = i + 1;
      const vals = nnh_values.slice(0, idx);
      return {
        ...entry,
        ma10: vals.length >= 10 ? parseFloat((vals.slice(-10).reduce((a, b) => a + b, 0) / 10).toFixed(1)) : null,
        ma20: vals.length >= 20 ? parseFloat((vals.slice(-20).reduce((a, b) => a + b, 0) / 20).toFixed(1)) : null,
      };
    });

    // --- TODAY's detailed breakdown (last day) ---
    const newHighs: {
      symbol: string;
      company: string;
      sector: string | null;
      currentPrice: number;
      high52w: number;
      percentFromHigh: number;
    }[] = [];

    const newLows: {
      symbol: string;
      company: string;
      sector: string | null;
      currentPrice: number;
      low52w: number;
      percentFromLow: number;
    }[] = [];

    const nearHighs: typeof newHighs = [];
    const nearLows: typeof newLows = [];

    for (const stock of validStocks) {
      const stockIdx = stock.candles.length - 1;

      const { isNewHigh, isNewLow, high52w, low52w } = check52WeekStatus(
        stock.candles,
        stockIdx,
        lookback
      );

      const latest = stock.candles[stockIdx];
      const currentPrice = latest.close;
      const percentFromHigh = ((latest.high - high52w) / high52w) * 100;
      const percentFromLow = ((latest.low - low52w) / low52w) * 100;

      const stockInfo = {
        symbol: stock.tradingSymbol,
        company: stock.companyName,
        sector: stock.sector,
        currentPrice,
      };

      if (isNewHigh) {
        newHighs.push({ ...stockInfo, high52w, percentFromHigh });
      } else if (latest.high >= high52w * 0.97) {
        nearHighs.push({ ...stockInfo, high52w, percentFromHigh });
      }

      if (isNewLow) {
        newLows.push({ ...stockInfo, low52w, percentFromLow });
      } else if (latest.low <= low52w * 1.03) {
        nearLows.push({ ...stockInfo, low52w, percentFromLow });
      }
    }

    newHighs.sort((a, b) => b.percentFromHigh - a.percentFromHigh);
    newLows.sort((a, b) => a.percentFromLow - b.percentFromLow);
    nearHighs.sort((a, b) => b.percentFromHigh - a.percentFromHigh);
    nearLows.sort((a, b) => a.percentFromLow - b.percentFromLow);

    const netNewHigh = newHighs.length - newLows.length;

    // --- Divergence Detection ---
    let divergence: {
      type: 'bullish_divergence' | 'bearish_divergence' | null;
      message: string;
    } = { type: null, message: 'No divergence detected' };

    if (nnh_history.length >= 10) {
      const recent5 = nnh_values.slice(-5);
      const prev5 = nnh_values.slice(-10, -5);
      const avgRecent = recent5.reduce((a, b) => a + b, 0) / 5;
      const avgPrev = prev5.reduce((a, b) => a + b, 0) / 5;
      const nnhTrend = avgRecent - avgPrev;

      let mktRecent = 0;
      let mktPrev = 0;
      let mktCount = 0;

      for (const stock of validStocks) {
        const len = stock.candles.length;
        if (len < 10) continue;
        mktCount++;
        const r5 = stock.candles.slice(-5).reduce((s, c) => s + c.close, 0) / 5;
        const p5 = stock.candles.slice(-10, -5).reduce((s, c) => s + c.close, 0) / 5;
        mktRecent += r5;
        mktPrev += p5;
      }

      if (mktCount > 0) {
        const mktTrend = mktRecent / mktCount - mktPrev / mktCount;

        if (mktTrend > 0 && nnhTrend < -3) {
          divergence = {
            type: 'bearish_divergence',
            message: 'Market rising but breadth weakening — bearish divergence (warning)',
          };
        } else if (mktTrend < 0 && nnhTrend > 3) {
          divergence = {
            type: 'bullish_divergence',
            message: 'Market falling but breadth improving — bullish divergence (possible reversal)',
          };
        }
      }
    }

    // --- Sector Breakdown ---
    const sectorMap: Record<string, { highs: number; lows: number }> = {};
    for (const s of newHighs) {
      const sector = s.sector || 'Unknown';
      if (!sectorMap[sector]) sectorMap[sector] = { highs: 0, lows: 0 };
      sectorMap[sector].highs++;
    }
    for (const s of newLows) {
      const sector = s.sector || 'Unknown';
      if (!sectorMap[sector]) sectorMap[sector] = { highs: 0, lows: 0 };
      sectorMap[sector].lows++;
    }

    const sectorBreakdown = Object.entries(sectorMap)
      .map(([sector, data]) => ({ sector, ...data, net: data.highs - data.lows }))
      .sort((a, b) => b.net - a.net);

    return NextResponse.json({
      success: true,
      data: {
        newHighs: newHighs.length,
        newLows: newLows.length,
        netNewHigh,
        totalStocks: totalWithData,
        nearHighs: nearHighs.length,
        nearLows: nearLows.length,
        stocks: {
          atNewHigh: newHighs,
          atNewLow: newLows,
          nearHigh: nearHighs,
          nearLow: nearLows,
        },
        sectorBreakdown,
        history: historyWithMA,
        ma10,
        ma20,
        divergence,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[NetNewHigh] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate net new high indicator' },
      { status: 500 }
    );
  }
}
