'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  ShieldAlert,
  Clock,
  Activity,
  BarChart3,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn, formatPrice, formatPercent } from '@/lib/utils';
import type { StockAnalysis, RecommendationAction } from '@/types/analyze';
import type { PatternResult } from '@/types/pattern';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  tradingSymbol: string;
  companyName: string;
  sector: string | null;
}

// ---------------------------------------------------------------------------
// Recommendation badge colors
// ---------------------------------------------------------------------------

const ACTION_STYLES: Record<
  RecommendationAction,
  { bg: string; text: string; border: string }
> = {
  'Strong Buy': {
    bg: 'bg-green-500/15',
    text: 'text-green-400',
    border: 'border-green-500/30',
  },
  Buy: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/20',
  },
  'Buy (with caution)': {
    bg: 'bg-lime-500/10',
    text: 'text-lime-400',
    border: 'border-lime-500/20',
  },
  'Weak Buy': {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/20',
  },
  Hold: {
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    border: 'border-gray-500/20',
  },
  'Weak Sell': {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/20',
  },
  'Sell (with caution)': {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
  },
  Sell: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/25',
  },
  'Strong Sell': {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
};

// ---------------------------------------------------------------------------
// Tier badge
// ---------------------------------------------------------------------------

function TierBadge({ tier }: { tier: number }) {
  const colors =
    tier === 1
      ? 'bg-green-500/10 text-green-400 border-green-500/20'
      : tier === 2
        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
        : 'bg-red-500/10 text-red-400 border-red-500/20';
  return (
    <span className={cn('rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium', colors)}>
      Tier {tier}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Confluence dots
// ---------------------------------------------------------------------------

function ConfluenceDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            'h-2 w-2 rounded-full',
            i <= score ? 'bg-primary' : 'bg-muted',
          )}
        />
      ))}
      <span className="ml-1 font-mono text-[11px] text-muted-foreground">{score}/5</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signal strength bar
// ---------------------------------------------------------------------------

function SignalBar({ strength }: { strength: number }) {
  const pct = Math.round(strength * 100);
  const color =
    pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-lime-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[11px] font-medium text-muted-foreground">{pct}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Direction icon
// ---------------------------------------------------------------------------

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === 'bullish') return <TrendingUp className="h-4 w-4 text-green-400" />;
  if (direction === 'bearish') return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-yellow-400" />;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AnalyzePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null);
  const [error, setError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  const searchInstruments = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/instruments?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (json.success) {
          setResults(json.data);
          setShowDropdown(json.data.length > 0);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  // Handle stock selection
  const analyzeStock = async (symbol: string) => {
    setShowDropdown(false);
    setAnalyzing(true);
    setError('');
    setAnalysis(null);
    setQuery(symbol);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      const json = await res.json();
      if (json.success) {
        setAnalysis(json.data);
      } else {
        setError(json.error || 'Failed to analyze stock');
      }
    } catch {
      setError('Failed to analyze stock. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const rec = analysis?.recommendation;
  const ind = analysis?.indicators;
  const actionStyle = rec ? ACTION_STYLES[rec.action] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Technical Analysis
        </div>
        <h1 className="text-2xl font-bold text-card-foreground">Analyze Stock</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search any stock and get instant technical analysis with buy/sell recommendation
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search by stock name or symbol... (e.g. RELIANCE, TCS, INFY)"
            className="w-full rounded-xl border border-border bg-card py-4 pl-12 pr-12 text-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              searchInstruments(e.target.value);
            }}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
          />
          {(loading || analyzing) && (
            <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-card shadow-xl">
            {results.map((r) => (
              <button
                key={r.tradingSymbol}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary first:rounded-t-xl last:rounded-b-xl"
                onClick={() => analyzeStock(r.tradingSymbol)}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-bold text-primary">
                  {r.tradingSymbol.slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground">{r.tradingSymbol}</div>
                  <div className="text-sm text-muted-foreground">{r.companyName}</div>
                </div>
                {r.sector && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {r.sector}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Analyzing spinner */}
      {analyzing && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Running 36 pattern detectors & computing indicators...</p>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !analyzing && (
        <div className="space-y-6">
          {/* Stock Header + Recommendation Hero */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              {/* Left: Stock info */}
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-card-foreground">{analysis.tradingSymbol}</h2>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {analysis.sector}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{analysis.companyName}</p>
                <p className="mt-2 font-mono text-3xl font-bold text-card-foreground">
                  {formatPrice(analysis.currentPrice)}
                </p>
              </div>

              {/* Right: Recommendation badge */}
              {rec && actionStyle && (
                <div className={cn('rounded-xl border p-5 text-center lg:min-w-[280px]', actionStyle.bg, actionStyle.border)}>
                  <div className={cn('font-mono text-3xl font-extrabold uppercase tracking-[0.05em]', actionStyle.text)}>
                    {rec.action.toUpperCase()}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{rec.summary}</p>
                  {rec.bestPattern && (
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <TierBadge tier={rec.bestPattern.tier ?? 3} />
                      <ConfluenceDots score={rec.bestPattern.confluenceScore ?? 0} />
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-center gap-1.5 font-mono text-xs text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Suggested: {rec.suggestedTimeframe}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Entry / SL / Target row */}
            {rec?.bestPattern && (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <InfoCard
                  label="Entry Price"
                  value={formatPrice(rec.bestPattern.entryPrice)}
                  icon={<ArrowUpRight className="h-4 w-4 text-primary" />}
                />
                <InfoCard
                  label="Stop Loss"
                  value={formatPrice(rec.bestPattern.stopLoss)}
                  icon={<ShieldAlert className="h-4 w-4 text-red-400" />}
                />
                <InfoCard
                  label="Target 1"
                  value={formatPrice(rec.bestPattern.target1)}
                  icon={<Target className="h-4 w-4 text-green-400" />}
                />
                <InfoCard
                  label="Target 2"
                  value={rec.bestPattern.target2 ? formatPrice(rec.bestPattern.target2) : '-'}
                  icon={<Target className="h-4 w-4 text-green-400" />}
                />
                <InfoCard
                  label="Risk : Reward"
                  value={rec.bestPattern.riskRewardRatio ? `1 : ${rec.bestPattern.riskRewardRatio.toFixed(1)}` : '-'}
                  icon={<BarChart3 className="h-4 w-4 text-yellow-400" />}
                />
              </div>
            )}
          </div>

          {/* Detected Patterns Table */}
          {analysis.patterns.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                <Layers className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Pattern Detection
                  </div>
                  <h3 className="text-lg font-semibold text-card-foreground">
                    Detected Patterns ({analysis.patterns.length})
                  </h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Pattern</th>
                      <th className="px-4 py-3 font-medium">Direction</th>
                      <th className="px-4 py-3 font-medium">Tier</th>
                      <th className="px-4 py-3 font-medium">Signal</th>
                      <th className="px-4 py-3 font-medium">Confluence</th>
                      <th className="px-4 py-3 font-medium">Entry</th>
                      <th className="px-4 py-3 font-medium">Stop Loss</th>
                      <th className="px-4 py-3 font-medium">Target</th>
                      <th className="px-4 py-3 font-medium">R:R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.patterns.map((p: PatternResult, idx: number) => (
                      <tr
                        key={`${p.patternName}-${idx}`}
                        className="border-b border-border/50 transition-colors hover:bg-secondary/50"
                      >
                        <td className="px-6 py-3">
                          <div className="font-medium text-foreground">
                            {formatPatternName(p.patternName)}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">{p.category}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <DirectionIcon direction={p.direction} />
                            <span className={cn(
                              'font-mono text-[11px] font-medium capitalize',
                              p.direction === 'bullish' ? 'text-green-400' : p.direction === 'bearish' ? 'text-red-400' : 'text-yellow-400',
                            )}>
                              {p.direction}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <TierBadge tier={p.tier ?? 3} />
                        </td>
                        <td className="px-4 py-3">
                          <SignalBar strength={p.signalStrength} />
                        </td>
                        <td className="px-4 py-3">
                          <ConfluenceDots score={p.confluenceScore ?? 0} />
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">{formatPrice(p.entryPrice)}</td>
                        <td className="px-4 py-3 font-mono text-red-400">{formatPrice(p.stopLoss)}</td>
                        <td className="px-4 py-3 font-mono text-green-400">{formatPrice(p.target1)}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {p.riskRewardRatio ? `1:${p.riskRewardRatio.toFixed(1)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No patterns message */}
          {analysis.patterns.length === 0 && (
            <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
              <Minus className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-lg font-medium text-foreground">No Patterns Detected</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No technical patterns found for this stock currently. Check back after market hours.
              </p>
            </div>
          )}

          {/* Technical Indicators Grid */}
          {ind && (
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                <Activity className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Indicators
                  </div>
                  <h3 className="text-lg font-semibold text-card-foreground">Technical Indicators</h3>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4">
                {/* RSI */}
                <IndicatorCard
                  label="RSI (14)"
                  value={ind.rsi.toFixed(1)}
                  sub={ind.rsiZone}
                  subColor={
                    ind.rsiZone === 'oversold'
                      ? 'text-green-400'
                      : ind.rsiZone === 'overbought'
                        ? 'text-red-400'
                        : 'text-muted-foreground'
                  }
                />

                {/* EMA Alignment */}
                <IndicatorCard
                  label="EMA Alignment"
                  value={ind.emaAlignment}
                  valueColor={
                    ind.emaAlignment === 'bullish'
                      ? 'text-green-400'
                      : ind.emaAlignment === 'bearish'
                        ? 'text-red-400'
                        : 'text-yellow-400'
                  }
                  sub="9 > 21 > 50 > 200"
                />

                {/* Volume Ratio */}
                <IndicatorCard
                  label="Volume Ratio"
                  value={`${ind.volumeRatio.toFixed(2)}x`}
                  sub={ind.volumeRatio >= 1.5 ? 'High volume' : ind.volumeRatio >= 1.0 ? 'Normal' : 'Low volume'}
                  subColor={ind.volumeRatio >= 1.5 ? 'text-green-400' : 'text-muted-foreground'}
                />

                {/* ATR */}
                <IndicatorCard
                  label="ATR (14)"
                  value={formatPrice(ind.atr)}
                  sub={`${((ind.atr / ind.currentPrice) * 100).toFixed(1)}% of price`}
                />

                {/* Weekly Trend */}
                <IndicatorCard
                  label="Weekly Trend"
                  value={ind.weeklyTrend}
                  valueColor={
                    ind.weeklyTrend === 'bullish'
                      ? 'text-green-400'
                      : ind.weeklyTrend === 'bearish'
                        ? 'text-red-400'
                        : 'text-yellow-400'
                  }
                />

                {/* EMA Values */}
                <IndicatorCard label="EMA 9" value={formatPrice(ind.ema9)} sub={emaLabel(ind.ema9, ind.currentPrice)} subColor={ind.ema9 < ind.currentPrice ? 'text-green-400' : 'text-red-400'} />
                <IndicatorCard label="EMA 21" value={formatPrice(ind.ema21)} sub={emaLabel(ind.ema21, ind.currentPrice)} subColor={ind.ema21 < ind.currentPrice ? 'text-green-400' : 'text-red-400'} />
                <IndicatorCard label="EMA 50" value={formatPrice(ind.ema50)} sub={emaLabel(ind.ema50, ind.currentPrice)} subColor={ind.ema50 < ind.currentPrice ? 'text-green-400' : 'text-red-400'} />
              </div>

              {/* Support & Resistance */}
              <div className="border-t border-border p-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Support Levels */}
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ArrowDownRight className="h-4 w-4 text-green-400" />
                      Support Levels
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {ind.supportLevels.length > 0 ? (
                        ind.supportLevels.slice(0, 5).map((level, i) => (
                          <span
                            key={i}
                            className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5 font-mono text-sm font-medium text-green-400"
                          >
                            {formatPrice(level)}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No clear levels</span>
                      )}
                    </div>
                  </div>

                  {/* Resistance Levels */}
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ArrowUpRight className="h-4 w-4 text-red-400" />
                      Resistance Levels
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {ind.resistanceLevels.length > 0 ? (
                        ind.resistanceLevels.slice(0, 5).map((level, i) => (
                          <span
                            key={i}
                            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 font-mono text-sm font-medium text-red-400"
                          >
                            {formatPrice(level)}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No clear levels</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fibonacci Levels */}
              {ind.fibonacciLevels.length > 0 && (
                <div className="border-t border-border p-6">
                  <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Fibonacci Retracement</h4>
                  <div className="flex flex-wrap gap-2">
                    {ind.fibonacciLevels.map((fib, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-center"
                      >
                        <div className="font-mono text-[11px] text-muted-foreground">{fib.label}</div>
                        <div className="font-mono text-sm font-medium text-foreground">{formatPrice(fib.price)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!analysis && !analyzing && !error && (
        <div className="flex flex-col items-center justify-center py-20">
          <Search className="h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            Search for a stock to get started
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground/60">
            Type any stock name or symbol above to run instant technical analysis
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------------------

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function IndicatorCard({
  label,
  value,
  valueColor,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="bg-card p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className={cn('mt-1 font-mono text-lg font-semibold capitalize', valueColor || 'text-foreground')}>
        {value}
      </div>
      {sub && (
        <div className={cn('mt-0.5 font-mono text-[11px] capitalize', subColor || 'text-muted-foreground')}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPatternName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function emaLabel(ema: number, price: number): string {
  const diff = ((price - ema) / ema) * 100;
  return diff >= 0 ? `${diff.toFixed(1)}% above` : `${Math.abs(diff).toFixed(1)}% below`;
}
