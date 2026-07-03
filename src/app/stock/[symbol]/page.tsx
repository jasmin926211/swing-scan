'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  Activity,
  BarChart3,
  Newspaper,
  ExternalLink,
} from 'lucide-react';
import { formatPrice, formatSignalStrength, getDirectionBg } from '@/lib/utils';
import { PATTERN_DISPLAY_NAMES } from '@/types/pattern';
import { computeEMAForChart, type CandleDataPoint } from '@/components/charts/utils';
import type { PatternOverlay } from '@/lib/patterns/overlay';

const CandlestickChart = dynamic(
  () => import('@/components/charts/CandlestickChart'),
  { ssr: false }
);

interface StockResult {
  id: string;
  tradingSymbol: string;
  companyName: string;
  patternName: string;
  patternCategory: string;
  direction: string;
  signalStrength: number;
  confidence: number;
  tier: number;
  confluenceScore: number;
  weeklyTrend: string | null;
  entryPrice: number | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  riskRewardRatio: number | null;
  currentPrice: number;
  rsiValue: number | null;
  volumeRatio: number | null;
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  ema200: number | null;
  sector?: string;
  patternDisplayName?: string;
}

interface ChartPattern {
  patternName: string;
  direction: string;
  signalStrength: number;
  tier: number;
  confluenceScore: number;
  entryPrice: number | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  overlay: PatternOverlay;
}

interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export default function StockDetailPage() {
  const params = useParams();
  const symbol = params.symbol as string;
  const [results, setResults] = useState<StockResult[]>([]);
  const [candles, setCandles] = useState<CandleDataPoint[]>([]);
  const [chartPatterns, setChartPatterns] = useState<ChartPattern[]>([]);
  const [activePatternIdx, setActivePatternIdx] = useState(0);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStockResults();
    fetchCandles();
    fetchNews();
  }, [symbol]);

  async function fetchStockResults() {
    try {
      const res = await fetch('/api/scan/results?limit=100');
      const data = await res.json();
      if (data.success && data.data) {
        const stockResults = data.data.results.filter(
          (r: StockResult) => r.tradingSymbol === decodeURIComponent(symbol)
        );
        setResults(stockResults);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  async function fetchCandles() {
    try {
      const res = await fetch(`/api/candles/${encodeURIComponent(decodeURIComponent(symbol))}`);
      const data = await res.json();
      if (data.success && data.data) {
        setCandles(data.data.candles);
        setChartPatterns(data.data.patterns ?? []);
        setActivePatternIdx(0);
      }
    } catch {
      // Ignore - chart won't render
    }
  }

  async function fetchNews() {
    try {
      const res = await fetch(`/api/news/${encodeURIComponent(decodeURIComponent(symbol))}`);
      const data = await res.json();
      if (data.success && data.data) {
        setNews(data.data.news);
      }
    } catch {
      // Ignore
    }
  }

  const primaryResult = results[0];

  return (
    <div className="space-y-6">
      {/* Back button + Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Stock Detail
          </div>
          <h2 className="text-2xl font-bold text-card-foreground">
            {decodeURIComponent(symbol)}
          </h2>
          {primaryResult && (
            <p className="font-mono text-xs text-muted-foreground">
              {primaryResult.companyName} | Current Price: {formatPrice(primaryResult.currentPrice)}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Activity className="mr-2 h-5 w-5 animate-pulse" />
          Loading...
        </div>
      ) : (
        <>
          {candles.length === 0 && results.length === 0 && (
            <div className="py-20 text-center text-muted-foreground">
              <BarChart3 className="mx-auto mb-3 h-8 w-8" />
              <p>No chart data available for this stock yet.</p>
            </div>
          )}

          {/* Candlestick Chart with pattern proof */}
          {candles.length > 0 && (() => {
            const activePattern = chartPatterns[activePatternIdx];
            const levelSource = activePattern ?? primaryResult ?? null;
            return (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-card-foreground">
                    Price Chart (Daily)
                  </h3>
                  {chartPatterns.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        Show pattern
                      </span>
                      {chartPatterns.map((p, i) => (
                        <button
                          key={`${p.patternName}-${i}`}
                          onClick={() => setActivePatternIdx(i)}
                          className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                            i === activePatternIdx
                              ? 'border-primary/40 bg-primary/15 text-primary'
                              : 'border-border text-muted-foreground hover:bg-secondary'
                          }`}
                        >
                          {PATTERN_DISPLAY_NAMES[p.patternName] || p.patternName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <CandlestickChart
                  candles={candles}
                  height={450}
                  patternOverlays={activePattern ? [activePattern.overlay] : []}
                  priceLevels={[
                    ...(levelSource?.entryPrice
                      ? [{ price: levelSource.entryPrice, color: '#53B9EA', label: 'Entry' }]
                      : []),
                    ...(levelSource?.stopLoss
                      ? [{ price: levelSource.stopLoss, color: '#E3507A', label: 'Stop Loss' }]
                      : []),
                    ...(levelSource?.target1
                      ? [{ price: levelSource.target1, color: '#4CFA9D', label: 'Target 1' }]
                      : []),
                    ...(levelSource?.target2
                      ? [{ price: levelSource.target2, color: '#4CFA9D', label: 'Target 2' }]
                      : []),
                  ]}
                  emaOverlays={[
                    { period: 9, color: '#F5A623', data: computeEMAForChart(candles, 9) },
                    { period: 21, color: '#A330FF', data: computeEMAForChart(candles, 21) },
                  ]}
                />
                {chartPatterns.length > 0 && (
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    Hover the chart over the pattern to see its name and the criteria it passed (✓) or failed (✗).
                  </p>
                )}
              </div>
            );
          })()}

          {/* Primary Signal Card */}
          {primaryResult && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Signal Info */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-card-foreground">
                  <Target className="h-5 w-5 text-primary" />
                  Primary Signal
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Pattern</span>
                    <span className="font-semibold text-foreground">
                      {PATTERN_DISPLAY_NAMES[primaryResult.patternName] || primaryResult.patternName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Direction</span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${getDirectionBg(primaryResult.direction)}`}>
                      {primaryResult.direction === 'bullish' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {primaryResult.direction}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Strength</span>
                    <span className={`font-mono font-semibold ${formatSignalStrength(primaryResult.signalStrength).className}`}>
                      {(primaryResult.signalStrength * 100).toFixed(0)}% - {formatSignalStrength(primaryResult.signalStrength).label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Category</span>
                    <span className="text-sm capitalize text-foreground">{primaryResult.patternCategory}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Reliability</span>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      primaryResult.tier === 1 ? 'bg-green-500/15 text-green-400 border-green-500/30' :
                      primaryResult.tier === 2 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
                      'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                    }`}>
                      Tier {primaryResult.tier ?? 3}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Confluence</span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div
                          key={i}
                          className={`h-2 w-2 rounded-full ${
                            i < (primaryResult.confluenceScore ?? 0)
                              ? (primaryResult.confluenceScore ?? 0) >= 4 ? 'bg-green-500'
                                : (primaryResult.confluenceScore ?? 0) >= 3 ? 'bg-yellow-500'
                                : 'bg-red-500'
                              : 'bg-zinc-700'
                          }`}
                        />
                      ))}
                      <span className="ml-1 font-mono text-[11px] font-semibold text-foreground">{primaryResult.confluenceScore ?? 0}/5</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Weekly Trend</span>
                    <span className={`inline-flex items-center gap-1 font-mono text-xs font-medium ${
                      primaryResult.weeklyTrend === 'bullish' ? 'text-green-400' :
                      primaryResult.weeklyTrend === 'bearish' ? 'text-red-400' :
                      'text-zinc-400'
                    }`}>
                      {primaryResult.weeklyTrend === 'bullish' && <TrendingUp className="h-3 w-3" />}
                      {primaryResult.weeklyTrend === 'bearish' && <TrendingDown className="h-3 w-3" />}
                      {primaryResult.weeklyTrend ? primaryResult.weeklyTrend.charAt(0).toUpperCase() + primaryResult.weeklyTrend.slice(1) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trade Setup */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-card-foreground">
                  <ShieldAlert className="h-5 w-5 text-yellow-500" />
                  Trade Setup
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Entry Price</span>
                    <span className="font-mono font-semibold text-primary">
                      {formatPrice(primaryResult.entryPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Stop Loss</span>
                    <span className="font-mono font-semibold text-red-400">
                      {formatPrice(primaryResult.stopLoss)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Target 1</span>
                    <span className="font-mono font-semibold text-green-400">
                      {formatPrice(primaryResult.target1)}
                    </span>
                  </div>
                  {primaryResult.target2 && (
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Target 2</span>
                      <span className="font-mono font-semibold text-green-400">
                        {formatPrice(primaryResult.target2)}
                      </span>
                    </div>
                  )}
                  <div className="mt-2 border-t border-border pt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Risk:Reward</span>
                      <span className="font-mono text-lg font-bold text-card-foreground">
                        {primaryResult.riskRewardRatio
                          ? `1:${primaryResult.riskRewardRatio.toFixed(1)}`
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Visual risk bar */}
                {primaryResult.entryPrice && primaryResult.stopLoss && primaryResult.target1 && (
                  <div className="mt-4">
                    <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                      <span>SL: {formatPrice(primaryResult.stopLoss)}</span>
                      <span>Entry: {formatPrice(primaryResult.entryPrice)}</span>
                      <span>T1: {formatPrice(primaryResult.target1)}</span>
                    </div>
                    <div className="mt-1 flex h-3 overflow-hidden rounded-full">
                      <div className="bg-red-500/30" style={{ flex: 1 }} />
                      <div className="bg-green-500/30" style={{ flex: primaryResult.riskRewardRatio || 1 }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Technical Indicators */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-card-foreground">
                  <Activity className="h-5 w-5 text-purple-500" />
                  Indicators
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">RSI (14)</span>
                    <span className={`font-mono font-semibold ${
                      primaryResult.rsiValue && primaryResult.rsiValue > 70 ? 'text-red-400' :
                      primaryResult.rsiValue && primaryResult.rsiValue < 30 ? 'text-green-400' : 'text-foreground'
                    }`}>
                      {primaryResult.rsiValue?.toFixed(1) || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Volume Ratio</span>
                    <span className={`font-mono font-semibold ${
                      primaryResult.volumeRatio && primaryResult.volumeRatio > 1.5 ? 'text-green-400' : 'text-foreground'
                    }`}>
                      {primaryResult.volumeRatio?.toFixed(2) || '-'}x
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">EMA 9</span>
                    <span className="font-mono text-sm text-foreground">{formatPrice(primaryResult.ema9)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">EMA 21</span>
                    <span className="font-mono text-sm text-foreground">{formatPrice(primaryResult.ema21)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">EMA 50</span>
                    <span className="font-mono text-sm text-foreground">{formatPrice(primaryResult.ema50)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">EMA 200</span>
                    <span className="font-mono text-sm text-foreground">{formatPrice(primaryResult.ema200)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* All Detected Patterns */}
          {results.length > 1 && (
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-6 py-4">
                <div className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  All Signals
                </div>
                <h3 className="text-base font-semibold text-card-foreground">
                  All Detected Patterns ({results.length})
                </h3>
              </div>
              <div className="divide-y divide-border">
                {results.map((r) => {
                  const strength = formatSignalStrength(r.signalStrength);
                  return (
                    <div key={r.id} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-4">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium ${getDirectionBg(r.direction)}`}>
                          {r.direction === 'bullish' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {r.direction}
                        </span>
                        <span className="font-medium text-foreground">
                          {PATTERN_DISPLAY_NAMES[r.patternName] || r.patternName}
                        </span>
                        <span className="font-mono text-[11px] capitalize text-muted-foreground">
                          ({r.patternCategory})
                        </span>
                      </div>
                      <div className="flex items-center gap-6 font-mono text-xs">
                        <span className={strength.className}>
                          {(r.signalStrength * 100).toFixed(0)}%
                        </span>
                        <span className="text-foreground">
                          Entry: {formatPrice(r.entryPrice)}
                        </span>
                        <span className="text-red-400">
                          SL: {formatPrice(r.stopLoss)}
                        </span>
                        <span className="text-green-400">
                          T: {formatPrice(r.target1)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Latest News */}
          {news.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-6 py-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-card-foreground">
                  <Newspaper className="h-5 w-5 text-blue-400" />
                  Latest News
                </h3>
              </div>
              <div className="divide-y divide-border">
                {news.map((item, idx) => (
                  <a
                    key={idx}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-secondary/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium leading-snug ${
                        item.sentiment === 'positive'
                          ? 'text-green-400'
                          : item.sentiment === 'negative'
                            ? 'text-red-400'
                            : 'text-foreground'
                      }`}>
                        {item.title}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                        <span>{item.source}</span>
                        {item.publishedAt && (
                          <>
                            <span>·</span>
                            <span>{new Date(item.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </>
                        )}
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          item.sentiment === 'positive'
                            ? 'border-green-500/30 bg-green-500/10 text-green-400'
                            : item.sentiment === 'negative'
                              ? 'border-red-500/30 bg-red-500/10 text-red-400'
                              : 'border-border bg-secondary text-muted-foreground'
                        }`}>
                          {item.sentiment}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
