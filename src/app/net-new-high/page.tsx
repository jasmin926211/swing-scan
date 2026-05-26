'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  BarChart3,
  Loader2,
  RefreshCw,
  Minus,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';

// ── Types ──

interface StockHighInfo {
  symbol: string;
  company: string;
  sector: string | null;
  currentPrice: number;
  high52w: number;
  percentFromHigh: number;
}

interface StockLowInfo {
  symbol: string;
  company: string;
  sector: string | null;
  currentPrice: number;
  low52w: number;
  percentFromLow: number;
}

interface SectorData {
  sector: string;
  highs: number;
  lows: number;
  net: number;
}

interface HistoryEntry {
  date: string;
  netNewHigh: number;
  newHighs: number;
  newLows: number;
  ma10: number | null;
  ma20: number | null;
}

interface Divergence {
  type: 'bullish_divergence' | 'bearish_divergence' | null;
  message: string;
}

interface BreadthData {
  newHighs: number;
  newLows: number;
  netNewHigh: number;
  totalStocks: number;
  nearHighs: number;
  nearLows: number;
  stocks: {
    atNewHigh: StockHighInfo[];
    atNewLow: StockLowInfo[];
    nearHigh: StockHighInfo[];
    nearLow: StockLowInfo[];
  };
  sectorBreakdown: SectorData[];
  history: HistoryEntry[];
  ma10: number | null;
  ma20: number | null;
  divergence: Divergence;
  timestamp: string;
}

// ── Components ──

function GaugeBar({ value, max }: { value: number; max: number }) {
  const clamped = Math.max(-max, Math.min(max, value));
  const percent = ((clamped + max) / (2 * max)) * 100;

  return (
    <div className="relative h-8 w-full overflow-hidden rounded-full bg-zinc-800">
      <div className="absolute left-1/2 top-0 h-full w-0.5 bg-zinc-500 z-10" />
      <div
        className="absolute top-0 h-full transition-all duration-700 ease-out"
        style={{
          left: clamped >= 0 ? '50%' : `${percent}%`,
          width: `${Math.abs(percent - 50)}%`,
          backgroundColor: clamped >= 0 ? '#22c55e' : '#ef4444',
          opacity: 0.8,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-white z-20">
        {value > 0 ? '+' : ''}{value}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={`mt-2 text-2xl font-bold ${color.includes('green') ? 'text-green-400' : color.includes('red') ? 'text-red-400' : color.includes('blue') ? 'text-blue-400' : color.includes('orange') ? 'text-orange-400' : 'text-card-foreground'}`}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

function SignalBadge({ netHigh }: { netHigh: number }) {
  if (netHigh > 10) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1.5 font-mono text-xs text-green-400">
        <TrendingUp className="h-3.5 w-3.5" /> Strong Bullish
      </span>
    );
  }
  if (netHigh > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1.5 font-mono text-xs text-green-400">
        <ArrowUpRight className="h-3.5 w-3.5" /> Bullish
      </span>
    );
  }
  if (netHigh === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1.5 font-mono text-xs text-yellow-400">
        <Minus className="h-3.5 w-3.5" /> Neutral
      </span>
    );
  }
  if (netHigh > -10) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 font-mono text-xs text-red-400">
        <ArrowDownRight className="h-3.5 w-3.5" /> Bearish
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 font-mono text-xs text-red-400">
      <TrendingDown className="h-3.5 w-3.5" /> Strong Bearish
    </span>
  );
}

/** SVG-based NNH bar chart with MA overlay lines */
function NNHChart({ history }: { history: HistoryEntry[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; entry: HistoryEntry } | null>(null);

  if (history.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground font-mono text-xs">
        No historical data
      </div>
    );
  }

  const padding = { top: 20, bottom: 30, left: 45, right: 15 };
  const width = 800;
  const height = 260;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = history.map((h) => h.netNewHigh);
  const allVals = [
    ...values,
    ...history.map((h) => h.ma10).filter((v): v is number => v !== null),
    ...history.map((h) => h.ma20).filter((v): v is number => v !== null),
  ];
  const maxVal = Math.max(Math.abs(Math.max(...allVals)), Math.abs(Math.min(...allVals)), 5);
  const yScale = chartH / (2 * maxVal);
  const barWidth = Math.max(2, (chartW / history.length) * 0.6);
  const barGap = chartW / history.length;

  const zeroY = padding.top + chartH / 2;

  // MA line path builder
  function maPath(key: 'ma10' | 'ma20'): string {
    const points: string[] = [];
    history.forEach((entry, i) => {
      const val = entry[key];
      if (val === null) return;
      const x = padding.left + i * barGap + barGap / 2;
      const y = zeroY - val * yScale;
      points.push(`${points.length === 0 ? 'M' : 'L'}${x},${y}`);
    });
    return points.join(' ');
  }

  // Y-axis grid lines
  const gridSteps = 5;
  const gridInterval = Math.ceil(maxVal / gridSteps);
  const gridLines: number[] = [];
  for (let v = -gridInterval * gridSteps; v <= gridInterval * gridSteps; v += gridInterval) {
    if (Math.abs(v) <= maxVal) gridLines.push(v);
  }

  return (
    <div ref={containerRef} className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[600px]"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {gridLines.map((v) => {
          const y = zeroY - v * yScale;
          return (
            <g key={v}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke={v === 0 ? '#71717a' : '#27272a'}
                strokeWidth={v === 0 ? 1 : 0.5}
              />
              <text
                x={padding.left - 5}
                y={y + 3}
                textAnchor="end"
                className="fill-zinc-500"
                fontSize="9"
                fontFamily="monospace"
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {history.map((entry, i) => {
          const x = padding.left + i * barGap + (barGap - barWidth) / 2;
          const val = entry.netNewHigh;
          const barH = Math.abs(val) * yScale;
          const y = val >= 0 ? zeroY - barH : zeroY;
          const fill = val >= 0 ? '#22c55e' : '#ef4444';

          return (
            <rect
              key={entry.date}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(1, barH)}
              fill={fill}
              opacity={tooltip?.entry.date === entry.date ? 1 : 0.75}
              rx={1}
              className="cursor-pointer"
              onMouseEnter={() => setTooltip({ x: x + barWidth / 2, entry })}
            />
          );
        })}

        {/* 10-day MA line */}
        <path
          d={maPath('ma10')}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 20-day MA line */}
        <path
          d={maPath('ma20')}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X-axis date labels (every 5th bar) */}
        {history.map((entry, i) => {
          if (i % Math.max(1, Math.floor(history.length / 8)) !== 0) return null;
          const x = padding.left + i * barGap + barGap / 2;
          const label = entry.date.slice(5); // MM-DD
          return (
            <text
              key={entry.date}
              x={x}
              y={height - 5}
              textAnchor="middle"
              className="fill-zinc-500"
              fontSize="8"
              fontFamily="monospace"
            >
              {label}
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute top-2 z-30 rounded-lg border border-border bg-zinc-900 px-3 py-2 shadow-lg"
          style={{ left: `${(tooltip.x / width) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <p className="font-mono text-[10px] text-muted-foreground">{tooltip.entry.date}</p>
          <p className={`font-mono text-sm font-bold ${tooltip.entry.netNewHigh >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            NNH: {tooltip.entry.netNewHigh > 0 ? '+' : ''}{tooltip.entry.netNewHigh}
          </p>
          <div className="flex gap-3 font-mono text-[10px]">
            <span className="text-green-400">{tooltip.entry.newHighs} highs</span>
            <span className="text-red-400">{tooltip.entry.newLows} lows</span>
          </div>
          {tooltip.entry.ma10 !== null && (
            <p className="font-mono text-[10px] text-amber-400">MA10: {tooltip.entry.ma10}</p>
          )}
          {tooltip.entry.ma20 !== null && (
            <p className="font-mono text-[10px] text-violet-400">MA20: {tooltip.entry.ma20}</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-4 font-mono text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500" /> Positive NNH
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> Negative NNH
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-amber-500 rounded" /> 10-Day MA
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-violet-500 rounded border-dashed" style={{ borderTop: '1.5px dashed #8b5cf6', height: 0 }} /> 20-Day MA
        </span>
      </div>
    </div>
  );
}

// ── Main Page ──

export default function NetNewHighPage() {
  const [data, setData] = useState<BreadthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'highs' | 'lows' | 'near-high' | 'near-low'>('highs');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/breadth/net-new-high?history=30');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to fetch data');
      }
    } catch {
      setError('Network error — check your connection');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="font-mono text-xs text-muted-foreground">
            Calculating Net New High across Nifty 500...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Activity className="h-10 w-10 text-red-400" />
          <p className="text-sm text-red-400">{error || 'No data available'}</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            Run a scan first to populate candle data
          </p>
          <button
            onClick={fetchData}
            className="mt-2 rounded-lg border border-border bg-card px-4 py-2 font-mono text-xs text-card-foreground hover:bg-secondary transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const gaugeMax = Math.max(30, Math.abs(data.netNewHigh) + 10);

  const tabs = [
    { key: 'highs' as const, label: '52W Highs', count: data.newHighs },
    { key: 'lows' as const, label: '52W Lows', count: data.newLows },
    { key: 'near-high' as const, label: 'Near High', count: data.nearHighs },
    { key: 'near-low' as const, label: 'Near Low', count: data.nearLows },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-card-foreground">
            NSE Net New High Indicator
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Market Breadth — 52-Week High/Low Analysis — Nifty 500
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SignalBadge netHigh={data.netNewHigh} />
          <button
            onClick={fetchData}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-card-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Divergence Alert */}
      {data.divergence.type && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 ${
            data.divergence.type === 'bearish_divergence'
              ? 'border-red-500/30 bg-red-500/5'
              : 'border-green-500/30 bg-green-500/5'
          }`}
        >
          <AlertTriangle
            className={`h-5 w-5 shrink-0 ${
              data.divergence.type === 'bearish_divergence' ? 'text-red-400' : 'text-green-400'
            }`}
          />
          <div>
            <p className={`text-sm font-medium ${
              data.divergence.type === 'bearish_divergence' ? 'text-red-400' : 'text-green-400'
            }`}>
              {data.divergence.type === 'bearish_divergence' ? 'Bearish Divergence Detected' : 'Bullish Divergence Detected'}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
              {data.divergence.message}
            </p>
          </div>
        </div>
      )}

      {/* Big Number + Gauge */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Big NNH Display */}
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Net New High
          </span>
          <p
            className={`mt-2 text-5xl font-bold tabular-nums ${
              data.netNewHigh > 0 ? 'text-green-400' : data.netNewHigh < 0 ? 'text-red-400' : 'text-yellow-400'
            }`}
          >
            {data.netNewHigh > 0 ? '+' : ''}{data.netNewHigh}
          </p>
          <div className="mt-3 flex items-center gap-4 font-mono text-xs">
            <span className="text-green-400">{data.newHighs} Highs</span>
            <span className="text-muted-foreground">-</span>
            <span className="text-red-400">{data.newLows} Lows</span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            = {data.newHighs} - {data.newLows} = {data.netNewHigh}
          </p>
        </div>

        {/* Gauge + MAs */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Breadth Gauge
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {new Date(data.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>
          <GaugeBar value={data.netNewHigh} max={gaugeMax} />
          <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>Bearish</span>
            <span>Neutral</span>
            <span>Bullish</span>
          </div>

          {/* Moving Averages */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-zinc-900/50 p-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  10-Day MA (Smoothed)
                </span>
              </div>
              <p className={`mt-1 text-lg font-bold font-mono ${
                (data.ma10 ?? 0) > 0 ? 'text-green-400' : (data.ma10 ?? 0) < 0 ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {data.ma10 !== null ? (data.ma10 > 0 ? `+${data.ma10}` : data.ma10) : 'N/A'}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-zinc-900/50 p-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-violet-500" />
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  20-Day MA (Trend)
                </span>
              </div>
              <p className={`mt-1 text-lg font-bold font-mono ${
                (data.ma20 ?? 0) > 0 ? 'text-green-400' : (data.ma20 ?? 0) < 0 ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {data.ma20 !== null ? (data.ma20 > 0 ? `+${data.ma20}` : data.ma20) : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-medium text-card-foreground">
              Net New High — 30-Day History
            </h2>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
              Daily NNH bars with 10-day & 20-day moving averages
            </p>
          </div>
          <Zap className="h-4 w-4 text-amber-400" />
        </div>
        <NNHChart history={data.history} />
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Net New High"
          value={data.netNewHigh > 0 ? `+${data.netNewHigh}` : data.netNewHigh}
          icon={data.netNewHigh >= 0 ? TrendingUp : TrendingDown}
          color={data.netNewHigh > 0 ? 'bg-green-500/10 text-green-400' : data.netNewHigh < 0 ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}
          subtitle="Highs minus Lows"
        />
        <StatCard
          label="New 52W Highs"
          value={data.newHighs}
          icon={ArrowUpRight}
          color="bg-green-500/10 text-green-400"
          subtitle={`${((data.newHighs / data.totalStocks) * 100).toFixed(1)}% of universe`}
        />
        <StatCard
          label="New 52W Lows"
          value={data.newLows}
          icon={ArrowDownRight}
          color="bg-red-500/10 text-red-400"
          subtitle={`${((data.newLows / data.totalStocks) * 100).toFixed(1)}% of universe`}
        />
        <StatCard
          label="Near 52W High"
          value={data.nearHighs}
          icon={TrendingUp}
          color="bg-blue-500/10 text-blue-400"
          subtitle="Within 3% of high"
        />
        <StatCard
          label="Near 52W Low"
          value={data.nearLows}
          icon={TrendingDown}
          color="bg-orange-500/10 text-orange-400"
          subtitle="Within 3% of low"
        />
      </div>

      {/* Main Content: Stocks + Sector + Guide */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Stock Lists */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="flex border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-4 py-3 font-mono text-xs transition-colors ${
                  activeTab === tab.key
                    ? 'border-b-2 border-primary text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-card-foreground hover:bg-secondary'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeTab === tab.key ? 'bg-primary/20' : 'bg-zinc-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            {activeTab === 'highs' || activeTab === 'near-high' ? (
              <HighsTable
                stocks={activeTab === 'highs' ? data.stocks.atNewHigh : data.stocks.nearHigh}
                isNear={activeTab === 'near-high'}
              />
            ) : (
              <LowsTable
                stocks={activeTab === 'lows' ? data.stocks.atNewLow : data.stocks.nearLow}
                isNear={activeTab === 'near-low'}
              />
            )}
          </div>
        </div>

        {/* Right Column: Sector + Interpretation */}
        <div className="space-y-6">
          {/* Sector Breakdown */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-4">
              Sector Breakdown
            </h3>
            {data.sectorBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No sector data
              </p>
            ) : (
              <div className="space-y-3">
                {data.sectorBreakdown.map((s) => (
                  <div key={s.sector} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-card-foreground truncate">{s.sector}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-green-400">{s.highs}H</span>
                        <span className="font-mono text-[10px] text-muted-foreground">/</span>
                        <span className="font-mono text-[10px] text-red-400">{s.lows}L</span>
                      </div>
                    </div>
                    <span
                      className={`font-mono text-sm font-bold ${
                        s.net > 0 ? 'text-green-400' : s.net < 0 ? 'text-red-400' : 'text-yellow-400'
                      }`}
                    >
                      {s.net > 0 ? '+' : ''}{s.net}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interpretation Guide */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-4">
              How to Use This Indicator
            </h3>
            <div className="space-y-3 text-[11px]">
              {/* Formula */}
              <div className="rounded-lg bg-zinc-800/60 p-3 font-mono text-[10px] text-center text-card-foreground">
                NNH = Stocks at 52W High - Stocks at 52W Low
              </div>

              {/* Signal interpretation */}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-muted-foreground">
                    <span className="text-green-400 font-medium">Positive (+):</span> More stocks hitting highs — bullish strength
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-red-500 shrink-0" />
                  <span className="text-muted-foreground">
                    <span className="text-red-400 font-medium">Negative (-):</span> More stocks hitting lows — bearish sentiment
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-yellow-500 shrink-0" />
                  <span className="text-muted-foreground">
                    <span className="text-yellow-400 font-medium">Near Zero:</span> Market neutral / sideways
                  </span>
                </div>
              </div>

              {/* Advanced */}
              <div className="border-t border-border pt-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">
                  Advanced Signals
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-3 w-3 mt-0.5 text-green-400 shrink-0" />
                    <span className="text-muted-foreground">
                      <span className="text-card-foreground">Trend Confirmation:</span> Nifty rising + NNH rising = strong uptrend
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-400 shrink-0" />
                    <span className="text-muted-foreground">
                      <span className="text-card-foreground">Divergence:</span> Index new high + NNH falling = weak rally (warning)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Activity className="h-3 w-3 mt-0.5 text-violet-400 shrink-0" />
                    <span className="text-muted-foreground">
                      <span className="text-card-foreground">Capitulation:</span> Extremely negative NNH = possible reversal zone
                    </span>
                  </div>
                </div>
              </div>

              {/* MA Guide */}
              <div className="border-t border-border pt-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">
                  Moving Averages
                </p>
                <div className="space-y-1.5 text-muted-foreground">
                  <p><span className="text-amber-400">10-Day MA</span> — Removes daily noise, shows short-term trend</p>
                  <p><span className="text-violet-400">20-Day MA</span> — Shows medium-term breadth direction</p>
                  <p className="text-[10px] mt-1.5 text-zinc-500">
                    When 10-MA crosses above 20-MA = breadth momentum improving
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center font-mono text-[10px] text-muted-foreground">
        Analyzing {data.totalStocks} stocks from Nifty 500 — Based on cached candle data (run scanner to update)
      </div>
    </div>
  );
}

// ── Stock Tables ──

function HighsTable({ stocks, isNear }: { stocks: StockHighInfo[]; isNear: boolean }) {
  if (stocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No stocks {isNear ? 'near' : 'at'} 52-week high
        </p>
      </div>
    );
  }

  return (
    <table className="w-full">
      <thead className="sticky top-0 bg-card z-10">
        <tr className="border-b border-border">
          <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Stock
          </th>
          <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Sector
          </th>
          <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Price
          </th>
          <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            52W High
          </th>
          <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            % from High
          </th>
        </tr>
      </thead>
      <tbody>
        {stocks.map((s) => (
          <tr
            key={s.symbol}
            className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
          >
            <td className="px-4 py-2.5">
              <p className="text-xs font-medium text-card-foreground">{s.symbol}</p>
              <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[160px]">
                {s.company}
              </p>
            </td>
            <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
              {s.sector || '-'}
            </td>
            <td className="px-4 py-2.5 text-right font-mono text-xs text-card-foreground">
              {formatPrice(s.currentPrice)}
            </td>
            <td className="px-4 py-2.5 text-right font-mono text-xs text-green-400">
              {formatPrice(s.high52w)}
            </td>
            <td className="px-4 py-2.5 text-right">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] ${
                  s.percentFromHigh >= 0
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-yellow-500/10 text-yellow-400'
                }`}
              >
                {s.percentFromHigh >= 0 ? '+' : ''}{s.percentFromHigh.toFixed(2)}%
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LowsTable({ stocks, isNear }: { stocks: StockLowInfo[]; isNear: boolean }) {
  if (stocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No stocks {isNear ? 'near' : 'at'} 52-week low
        </p>
      </div>
    );
  }

  return (
    <table className="w-full">
      <thead className="sticky top-0 bg-card z-10">
        <tr className="border-b border-border">
          <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Stock
          </th>
          <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Sector
          </th>
          <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Price
          </th>
          <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            52W Low
          </th>
          <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            % from Low
          </th>
        </tr>
      </thead>
      <tbody>
        {stocks.map((s) => (
          <tr
            key={s.symbol}
            className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
          >
            <td className="px-4 py-2.5">
              <p className="text-xs font-medium text-card-foreground">{s.symbol}</p>
              <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[160px]">
                {s.company}
              </p>
            </td>
            <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
              {s.sector || '-'}
            </td>
            <td className="px-4 py-2.5 text-right font-mono text-xs text-card-foreground">
              {formatPrice(s.currentPrice)}
            </td>
            <td className="px-4 py-2.5 text-right font-mono text-xs text-red-400">
              {formatPrice(s.low52w)}
            </td>
            <td className="px-4 py-2.5 text-right">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] ${
                  s.percentFromLow <= 0
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-yellow-500/10 text-yellow-400'
                }`}
              >
                {s.percentFromLow >= 0 ? '+' : ''}{s.percentFromLow.toFixed(2)}%
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
