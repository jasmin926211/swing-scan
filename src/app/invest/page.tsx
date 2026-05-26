'use client';

import { useState } from 'react';
import {
  Wallet,
  Calculator,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Target,
  IndianRupee,
  BarChart3,
  Shield,
  Zap,
  Flame,
} from 'lucide-react';
import { cn, formatPrice, formatAmount, formatPercent } from '@/lib/utils';
import type {
  RiskProfile,
  InvestmentHorizon,
  OptimizedPortfolio,
  StockAllocation,
} from '@/types/portfolio';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HORIZON_OPTIONS: { value: InvestmentHorizon; label: string; desc: string }[] = [
  { value: 5, label: '5 Days', desc: 'Short-term momentum' },
  { value: 15, label: '15 Days', desc: 'Swing trade' },
  { value: 30, label: '30 Days', desc: 'Position trade' },
  { value: 60, label: '60 Days', desc: 'Medium-term hold' },
];

const RISK_PROFILES: {
  value: RiskProfile;
  label: string;
  desc: string;
  icon: typeof Shield;
  color: string;
}[] = [
  {
    value: 'conservative',
    label: 'Conservative',
    desc: 'Tier 1 only, 4/5+ confluence, max 5 stocks',
    icon: Shield,
    color: 'text-blue-400 border-blue-400/30 bg-blue-400/5',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    desc: 'Tier 1-2, 3/5+ confluence, max 10 stocks',
    icon: Zap,
    color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    desc: 'All tiers, 2/5+ confluence, max 15 stocks',
    icon: Flame,
    color: 'text-red-400 border-red-400/30 bg-red-400/5',
  },
];

const SECTOR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500',
  'bg-indigo-500', 'bg-lime-500',
];

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function TierBadge({ tier }: { tier: number }) {
  const styles: Record<number, string> = {
    1: 'bg-green-500/15 text-green-400 border-green-500/30',
    2: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    3: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span className={cn('rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium', styles[tier] ?? styles[3])}>
      T{tier}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, score);
  const color =
    pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 rounded-full bg-secondary">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[11px] text-muted-foreground">{pct.toFixed(0)}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof TrendingUp;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em]">{label}</span>
      </div>
      <p className="mt-1 font-mono text-xl font-bold text-card-foreground">{value}</p>
      {sub && <p className="font-mono text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function InvestPage() {
  const [amount, setAmount] = useState(100000);
  const [days, setDays] = useState<InvestmentHorizon>(15);
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('moderate');
  const [portfolio, setPortfolio] = useState<OptimizedPortfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOptimize() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portfolio/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, days, riskProfile }),
      });
      const data = await res.json();
      if (data.success) {
        setPortfolio(data.data);
      } else {
        setError(data.error || 'Optimization failed');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  const formatInputAmount = (val: number) =>
    new Intl.NumberFormat('en-IN').format(val);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Portfolio Management
        </div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-card-foreground">
          <Wallet className="h-7 w-7 text-primary" />
          Smart Portfolio Optimizer
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your investment amount, pick a timeframe and risk appetite — get an
          optimized portfolio with exact allocations.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Input section */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        {/* Amount + Horizon row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Amount */}
          <div>
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Investment Amount
            </label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                inputMode="numeric"
                value={formatInputAmount(amount)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  const num = parseInt(raw, 10);
                  if (!isNaN(num) && num <= 10000000) setAmount(num);
                  if (raw === '') setAmount(0);
                }}
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="1,00,000"
              />
            </div>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              Min ₹10,000 — Max ₹1,00,00,000
            </p>
          </div>

          {/* Horizon */}
          <div>
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Investment Horizon
            </label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value) as InvestmentHorizon)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {HORIZON_OPTIONS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label} — {h.desc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Risk profile cards */}
        <div>
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Risk Profile
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {RISK_PROFILES.map((p) => {
              const Icon = p.icon;
              const isActive = riskProfile === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => setRiskProfile(p.value)}
                  className={cn(
                    'rounded-lg border p-4 text-left transition-all',
                    isActive
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-secondary/30',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        'h-5 w-5',
                        isActive ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                    <span className="font-medium text-foreground">{p.label}</span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{p.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optimize button */}
        <button
          onClick={handleOptimize}
          disabled={loading || amount < 10000}
          className={cn(
            'flex items-center gap-2 rounded-lg px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.05em] text-white transition-colors',
            loading || amount < 10000
              ? 'cursor-not-allowed bg-primary/50'
              : 'bg-primary hover:bg-primary/90',
          )}
        >
          <Calculator className="h-4 w-4" />
          {loading ? 'Optimizing...' : 'Optimize Portfolio'}
        </button>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Results (shown after optimization) */}
      {/* ------------------------------------------------------------------ */}
      {portfolio && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Invested"
              value={formatAmount(portfolio.summary.actualInvested)}
              sub={`${formatAmount(portfolio.summary.cashRemaining)} remaining`}
              icon={Wallet}
              color="text-primary"
            />
            <StatCard
              label="Expected Return"
              value={formatAmount(portfolio.summary.expectedReturnLikely)}
              sub={formatPercent(portfolio.summary.expectedReturnLikelyPercent)}
              icon={TrendingUp}
              color="text-green-400"
            />
            <StatCard
              label="Max Risk"
              value={formatAmount(portfolio.summary.totalRiskAmount)}
              sub={formatPercent(portfolio.summary.totalRiskPercent)}
              icon={ShieldCheck}
              color="text-yellow-400"
            />
            <StatCard
              label="Stocks Selected"
              value={String(portfolio.summary.stockCount)}
              sub={`Avg R:R ${portfolio.summary.averageRiskReward.toFixed(1)}`}
              icon={BarChart3}
              color="text-purple-400"
            />
          </div>

          {/* Return range */}
          <ReturnRangeBar summary={portfolio.summary} />

          {/* Sector distribution */}
          {portfolio.summary.sectorDistribution.length > 0 && (
            <SectorBar sectors={portfolio.summary.sectorDistribution} />
          )}

          {/* Allocation table */}
          <AllocationTable allocations={portfolio.allocations} totalAmount={portfolio.request.amount} />

          {/* Risk disclaimer */}
          <RiskDisclaimer summary={portfolio.summary} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Return range bar component
// ---------------------------------------------------------------------------

function ReturnRangeBar({ summary }: { summary: OptimizedPortfolio['summary'] }) {
  const worst = summary.expectedReturnWorst;
  const likely = summary.expectedReturnLikely;
  const best = summary.expectedReturnBest;

  // Normalize to 0-100 range for the bar
  const range = best - worst || 1;
  const likelyPos = ((likely - worst) / range) * 100;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Projection</div>
      <h3 className="text-sm font-medium text-card-foreground">Return Projection</h3>
      <div className="mt-3">
        <div className="relative h-3 rounded-full bg-gradient-to-r from-red-500/30 via-yellow-500/30 to-green-500/30">
          <div
            className="absolute top-0 h-3 w-1 rounded-full bg-white"
            style={{ left: `${Math.min(100, Math.max(0, likelyPos))}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[11px]">
          <span className="text-red-400">
            Worst: {formatAmount(worst)}
          </span>
          <span className="font-medium text-yellow-400">
            Likely: {formatAmount(likely)} ({formatPercent(summary.expectedReturnLikelyPercent)})
          </span>
          <span className="text-green-400">
            Best: +{formatAmount(best)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sector distribution bar
// ---------------------------------------------------------------------------

function SectorBar({ sectors }: { sectors: OptimizedPortfolio['summary']['sectorDistribution'] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Diversification</div>
      <h3 className="text-sm font-medium text-card-foreground">Sector Distribution</h3>
      {/* Stacked bar */}
      <div className="mt-3 flex h-4 overflow-hidden rounded-full">
        {sectors.map((s, i) => (
          <div
            key={s.sector}
            className={cn('h-full', SECTOR_COLORS[i % SECTOR_COLORS.length])}
            style={{ width: `${s.allocationPercent * 100}%` }}
            title={`${s.sector}: ${formatPercent(s.allocationPercent)}`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {sectors.map((s, i) => (
          <div key={s.sector} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <div className={cn('h-2.5 w-2.5 rounded-sm', SECTOR_COLORS[i % SECTOR_COLORS.length])} />
            {s.sector} ({s.stockCount}) — {formatPercent(s.allocationPercent)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Allocation table
// ---------------------------------------------------------------------------

function AllocationTable({
  allocations,
  totalAmount,
}: {
  allocations: StockAllocation[];
  totalAmount: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-3">
        <div className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Allocations</div>
        <h3 className="text-sm font-medium text-card-foreground">
          Stock Allocations ({allocations.length} stocks)
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Stock</th>
              <th className="px-4 py-3 text-left">Pattern</th>
              <th className="px-4 py-3 text-center">Tier</th>
              <th className="px-4 py-3 text-center">Score</th>
              <th className="px-4 py-3 text-right">Allocation</th>
              <th className="px-4 py-3 text-right">Shares</th>
              <th className="px-4 py-3 text-right">Entry</th>
              <th className="px-4 py-3 text-right">Stop Loss</th>
              <th className="px-4 py-3 text-right">Target</th>
              <th className="px-4 py-3 text-right">Exp. Return</th>
              <th className="px-4 py-3 text-right">Risk</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((a) => (
              <tr
                key={a.tradingSymbol}
                className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-muted-foreground">{a.rank}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{a.tradingSymbol}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{a.sector}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-foreground">{a.patternName.replace(/_/g, ' ')}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{a.patternCategory}</div>
                </td>
                <td className="px-4 py-3 text-center">
                  <TierBadge tier={a.tier} />
                </td>
                <td className="px-4 py-3">
                  <ScoreBar score={a.compositeScore} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="font-mono font-medium text-foreground">{formatAmount(a.investedAmount)}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {formatPercent(a.allocationPercent)}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
                  {a.sharesToBuy}
                </td>
                <td className="px-4 py-3 text-right font-mono text-primary">
                  {formatPrice(a.entryPrice)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-red-400">
                  {formatPrice(a.stopLoss)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-green-400">
                  {formatPrice(a.target1)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className={`font-mono ${a.expectedReturnAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {a.expectedReturnAmount >= 0 ? '+' : ''}
                    {formatAmount(a.expectedReturnAmount)}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {formatPercent(a.expectedReturnPercent)}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="font-mono text-red-400">{formatAmount(a.riskAmount)}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {formatPercent(a.riskPercent)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk disclaimer
// ---------------------------------------------------------------------------

function RiskDisclaimer({ summary }: { summary: OptimizedPortfolio['summary'] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-medium text-card-foreground">
        <Target className="h-4 w-4 text-yellow-400" />
        Risk Summary
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 font-mono text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Portfolio Risk</span>
            <span className="text-red-400">
              {formatAmount(summary.totalRiskAmount)} ({formatPercent(summary.totalRiskPercent)})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Max Single Stock Risk</span>
            <span className="text-red-400">
              {formatAmount(summary.maxSingleStockRisk)} ({formatPercent(summary.maxSingleStockRiskPercent)})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg Risk:Reward</span>
            <span className="text-foreground">1:{summary.averageRiskReward.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg Signal Strength</span>
            <span className="text-foreground">{(summary.averageSignalStrength * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg Confluence</span>
            <span className="text-foreground">{summary.averageConfluence.toFixed(1)} / 5</span>
          </div>
        </div>
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 text-xs text-yellow-300/80 space-y-1">
          <p className="flex items-center gap-1 font-medium text-yellow-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Disclaimer
          </p>
          <p>Past patterns do not guarantee future performance.</p>
          <p>Always set stop-losses and follow your risk management rules.</p>
          <p>Results are based on the latest scan data and historical win rates.</p>
          <p>Consider market conditions, news, and your own analysis before trading.</p>
        </div>
      </div>
    </div>
  );
}
