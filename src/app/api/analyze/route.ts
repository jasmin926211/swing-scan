import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchAndCacheCandles, fetchTodayCandle } from '@/lib/upstox/historical';
import { calendarDaysForTradingDays } from '@/lib/time/market-time';
import { computeAllIndicators } from '@/lib/indicators';
import { runAllPatterns } from '@/lib/patterns';
import type { PatternResult } from '@/types/pattern';
import type {
  StockAnalysis,
  Recommendation,
  RecommendationAction,
  IndicatorSnapshot,
} from '@/types/analyze';

// Force dynamic rendering — never cache this route
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Recommendation logic
// ---------------------------------------------------------------------------

function buildRecommendation(patterns: PatternResult[]): Recommendation {
  if (patterns.length === 0) {
    return {
      action: 'Hold',
      summary: 'No clear technical signal detected. Wait for a pattern to form.',
      suggestedTimeframe: '-',
      bestPattern: null,
    };
  }

  const best = patterns[0]; // already sorted by tier → signal strength
  const tier = best.tier ?? 3;
  const confluence = best.confluenceScore ?? 0;
  const isBullish = best.direction === 'bullish';
  const isBearish = best.direction === 'bearish';

  let action: RecommendationAction = 'Hold';
  let summary = '';

  if (isBullish) {
    if (tier === 1 && confluence >= 4) {
      action = 'Strong Buy';
      summary = `High-reliability ${best.patternName} with strong confluence (${confluence}/5). Multiple indicators confirm the bullish setup.`;
    } else if (tier === 1 && confluence >= 3) {
      action = 'Buy';
      summary = `Reliable ${best.patternName} pattern with good confluence (${confluence}/5). Setup looks solid.`;
    } else if (tier === 2 && confluence >= 3) {
      action = 'Buy (with caution)';
      summary = `${best.patternName} detected with decent confluence (${confluence}/5). Keep a tight stop loss.`;
    } else {
      action = 'Weak Buy';
      summary = `${best.patternName} detected but confluence is low (${confluence}/5). Consider waiting for confirmation.`;
    }
  } else if (isBearish) {
    if (tier === 1 && confluence >= 4) {
      action = 'Strong Sell';
      summary = `High-reliability bearish ${best.patternName} with strong confluence (${confluence}/5). Multiple indicators confirm the bearish setup.`;
    } else if (tier === 1 && confluence >= 3) {
      action = 'Sell';
      summary = `Reliable bearish ${best.patternName} with good confluence (${confluence}/5).`;
    } else if (tier === 2 && confluence >= 3) {
      action = 'Sell (with caution)';
      summary = `Bearish ${best.patternName} detected (${confluence}/5). Watch for reversal signs.`;
    } else {
      action = 'Weak Sell';
      summary = `Bearish ${best.patternName} detected but confluence is low (${confluence}/5).`;
    }
  } else {
    action = 'Hold';
    summary = `Neutral pattern (${best.patternName}) detected. No clear directional bias.`;
  }

  // Timeframe by pattern category
  let suggestedTimeframe = '10-15 days';
  if (best.category === 'candlestick') suggestedTimeframe = '5-10 days';
  else if (best.category === 'crossover') suggestedTimeframe = '10-15 days';
  else if (best.category === 'chart') suggestedTimeframe = '15-30 days';

  return { action, summary, suggestedTimeframe, bestPattern: best };
}

// ---------------------------------------------------------------------------
// Build indicator snapshot from last candle
// ---------------------------------------------------------------------------

function buildIndicatorSnapshot(
  indicators: ReturnType<typeof computeAllIndicators>,
  currentPrice: number,
): IndicatorSnapshot {
  const lastIdx = indicators.closes.length - 1;
  const rsi = indicators.rsi[lastIdx] ?? 50;

  let rsiZone: 'oversold' | 'neutral' | 'overbought' = 'neutral';
  if (rsi <= 30) rsiZone = 'oversold';
  else if (rsi >= 70) rsiZone = 'overbought';

  const ema9 = indicators.ema9[lastIdx] ?? 0;
  const ema21 = indicators.ema21[lastIdx] ?? 0;
  const ema50 = indicators.ema50[lastIdx] ?? 0;
  const ema200 = indicators.ema200[lastIdx] ?? 0;

  let emaAlignment: 'bullish' | 'bearish' | 'mixed' = 'mixed';
  if (ema9 > ema21 && ema21 > ema50 && ema50 > ema200) emaAlignment = 'bullish';
  else if (ema9 < ema21 && ema21 < ema50 && ema50 < ema200) emaAlignment = 'bearish';

  return {
    rsi: Math.round(rsi * 100) / 100,
    rsiZone,
    ema9: Math.round(ema9 * 100) / 100,
    ema21: Math.round(ema21 * 100) / 100,
    ema50: Math.round(ema50 * 100) / 100,
    ema200: Math.round(ema200 * 100) / 100,
    emaAlignment,
    volumeRatio: Math.round((indicators.volumeRatios[lastIdx] ?? 1) * 100) / 100,
    atr: Math.round((indicators.atr[lastIdx] ?? 0) * 100) / 100,
    weeklyTrend: indicators.weeklyTrend,
    supportLevels: indicators.supportLevels.map((l) => Math.round(l * 100) / 100),
    resistanceLevels: indicators.resistanceLevels.map((l) => Math.round(l * 100) / 100),
    fibonacciLevels: indicators.fibonacciLevels,
    currentPrice,
  };
}

// ---------------------------------------------------------------------------
// POST /api/analyze
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const symbol = (body.symbol as string)?.trim()?.toUpperCase();

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Symbol is required' },
        { status: 400 },
      );
    }

    // Look up instrument
    const instrument = await prisma.instrument.findFirst({
      where: { tradingSymbol: symbol, isActive: true },
    });

    if (!instrument) {
      return NextResponse.json(
        { success: false, error: `Instrument "${symbol}" not found` },
        { status: 404 },
      );
    }

    // Fetch enough daily history to seed EMA200 (uses cache when available)
    const candles = await fetchAndCacheCandles(
      instrument.id,
      instrument.instrumentKey,
      'day',
      calendarDaysForTradingDays(260),
    );

    if (candles.length < 30) {
      return NextResponse.json(
        { success: false, error: `Not enough historical data for ${symbol} (${candles.length} candles, need 30+)` },
        { status: 422 },
      );
    }

    // Compute indicators
    const indicators = computeAllIndicators(candles);

    // Run all pattern detectors
    const patterns = runAllPatterns(candles, indicators);

    // Build recommendation
    const recommendation = buildRecommendation(patterns);

    // Build indicator snapshot
    const lastCandle = candles[candles.length - 1];

    // Fetch live price separately as a safety net
    // (fetchAndCacheCandles should already include today's candle, but
    //  this ensures we always show the latest price even if candle append failed)
    let currentPrice = lastCandle.close;
    const liveCandle = await fetchTodayCandle(instrument.instrumentKey);
    if (liveCandle && liveCandle.close > 0) {
      currentPrice = liveCandle.close;
    }

    const indicatorSnapshot = buildIndicatorSnapshot(indicators, currentPrice);

    const analysis: StockAnalysis = {
      tradingSymbol: instrument.tradingSymbol,
      companyName: instrument.companyName,
      sector: instrument.sector || 'Other',
      currentPrice,
      recommendation,
      patterns,
      indicators: indicatorSnapshot,
      analyzedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: analysis });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to analyze stock';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
