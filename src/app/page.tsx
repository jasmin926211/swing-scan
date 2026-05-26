'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Clock,
  Target,
  ShieldAlert,
  Shield,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { formatPrice, formatSignalStrength, getDirectionBg, timeAgo } from '@/lib/utils';
import { PATTERN_DISPLAY_NAMES } from '@/types/pattern';

interface ScanResultItem {
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
  sector?: string;
  patternDisplayName?: string;
}

interface ScanSession {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  totalStocks: number;
  scannedCount: number;
  patternsFound: number;
  triggerType: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [results, setResults] = useState<ScanResultItem[]>([]);
  const [session, setSession] = useState<ScanSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [authAlert, setAuthAlert] = useState(false);

  useEffect(() => {
    fetchResults();
  }, []);

  async function handleScanClick() {
    try {
      const authRes = await fetch('/api/auth/token');
      const authData = await authRes.json();
      if (!authData.success || !authData.data?.connected || authData.data?.expired) {
        setAuthAlert(true);
        return;
      }
    } catch {
      setAuthAlert(true);
      return;
    }
    router.push('/scanner');
  }

  async function fetchResults() {
    try {
      const res = await fetch('/api/scan/results?limit=10');
      const data = await res.json();
      if (data.success && data.data) {
        setResults(data.data.results || []);
        setSession(data.data.session || null);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  const bullishCount = results.filter((r) => r.direction === 'bullish').length;
  const bearishCount = results.filter((r) => r.direction === 'bearish').length;

  return (
    <div className="space-y-6">
      {/* Auth Alert */}
      {authAlert && (
        <div className="relative rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <button
            onClick={() => setAuthAlert(false)}
            className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-red-500/10 p-2.5">
              <Shield className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-card-foreground">Upstox Login Required</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                You need to connect your Upstox account before scanning stocks. The scanner uses Upstox API to fetch real-time market data.
              </p>
              <Link
                href="/auth"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-mono text-xs font-medium uppercase tracking-[0.05em] text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Shield className="h-3.5 w-3.5" />
                Connect Upstox
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Last Scan"
          value={session ? timeAgo(session.completedAt || session.startedAt) : 'Never'}
          subtitle={session ? `${session.scannedCount}/${session.totalStocks} stocks` : 'No scans yet'}
          icon={<Clock className="h-5 w-5" />}
          color="text-primary"
        />
        <StatCard
          title="Patterns Found"
          value={session?.patternsFound?.toString() || '0'}
          subtitle="Across all stocks"
          icon={<Activity className="h-5 w-5" />}
          color="text-purple-500"
        />
        <StatCard
          title="Bullish Signals"
          value={bullishCount.toString()}
          subtitle="In top 10"
          icon={<TrendingUp className="h-5 w-5" />}
          color="text-green-500"
        />
        <StatCard
          title="Bearish Signals"
          value={bearishCount.toString()}
          subtitle="In top 10"
          icon={<TrendingDown className="h-5 w-5" />}
          color="text-red-500"
        />
      </div>

      {/* Top 10 Signals Table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Latest Results
            </div>
            <h3 className="text-lg font-semibold text-card-foreground">Top 10 Trading Signals</h3>
          </div>
          <button
            onClick={handleScanClick}
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 font-mono text-xs font-medium tracking-[0.05em] text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ScanIcon />
            SCAN NOW
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Activity className="mx-auto mb-3 h-8 w-8 animate-pulse" />
            <p>Loading results...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <BarChart3 className="mx-auto mb-3 h-8 w-8" />
            <p className="text-lg font-medium">No scan results yet</p>
            <p className="mt-1 text-sm">
              Go to{' '}
              <Link href="/auth" className="text-primary hover:underline">
                Upstox Auth
              </Link>{' '}
              to connect, then run your first scan.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">Stock</th>
                  <th className="px-6 py-3">Pattern</th>
                  <th className="px-6 py-3">Tier</th>
                  <th className="px-6 py-3">Direction</th>
                  <th className="px-6 py-3">Strength</th>
                  <th className="px-6 py-3">Confluence</th>
                  <th className="px-6 py-3">Entry</th>
                  <th className="px-6 py-3">Stop Loss</th>
                  <th className="px-6 py-3">Target</th>
                  <th className="px-6 py-3">R:R</th>
                  <th className="px-6 py-3">RSI</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, idx) => {
                  const strength = formatSignalStrength(result.signalStrength);
                  return (
                    <tr
                      key={result.id}
                      className="border-b border-border/50 transition-colors hover:bg-secondary/30"
                    >
                      <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-foreground">
                            {result.tradingSymbol}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {formatPrice(result.currentPrice)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-foreground">
                          {result.patternDisplayName ||
                            PATTERN_DISPLAY_NAMES[result.patternName] ||
                            result.patternName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <TierBadge tier={result.tier} />
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${getDirectionBg(
                            result.direction
                          )}`}
                        >
                          {result.direction === 'bullish' ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : result.direction === 'bearish' ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : null}
                          {result.direction}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 rounded-full bg-secondary">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${result.signalStrength * 100}%`,
                                backgroundColor: strength.color,
                              }}
                            />
                          </div>
                          <span className={`font-mono text-[11px] font-medium ${strength.className}`}>
                            {(result.signalStrength * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <ConfluenceDots score={result.confluenceScore} />
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-foreground">
                        {formatPrice(result.entryPrice)}
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-red-400">
                        {formatPrice(result.stopLoss)}
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-green-400">
                        {formatPrice(result.target1)}
                      </td>
                      <td className="px-6 py-4">
                        {result.riskRewardRatio ? (
                          <span className="font-mono text-sm font-medium text-foreground">
                            1:{result.riskRewardRatio.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {result.rsiValue ? (
                          <span
                            className={`font-mono text-sm font-medium ${
                              result.rsiValue > 70
                                ? 'text-red-400'
                                : result.rsiValue < 30
                                ? 'text-green-400'
                                : 'text-foreground'
                            }`}
                          >
                            {result.rsiValue.toFixed(0)}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/stock/${result.tradingSymbol}`}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-card-foreground">
            <Target className="h-5 w-5 text-primary" />
            How It Works
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Scans all Nifty 500 stocks using Upstox API</li>
            <li>Detects 35+ patterns: candlestick, chart, and crossover signals</li>
            <li>3-tier reliability system: Tier 1 (high), Tier 2 (medium), Tier 3 (early warning)</li>
            <li>5-point confluence scoring: pattern + volume + S/R level + weekly trend + RSI</li>
            <li>Fibonacci retracement and support/resistance confluence detection</li>
            <li>Hard volume filter: reversal patterns rejected below 1.5x average volume</li>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-card-foreground">
            <ShieldAlert className="h-5 w-5 text-yellow-500" />
            Risk Management
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Always use the suggested stop-loss levels</li>
            <li>Never risk more than 1-2% of capital per trade</li>
            <li>Patterns with R:R below 1:1.5 should be avoided</li>
            <li>Confirm signals with volume surge (Volume Ratio &gt; 1.5x)</li>
            <li>Best for 5-7 day swing holding period</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{title}</p>
        <div className={color}>{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-bold text-card-foreground">{value}</p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function ScanIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const config = {
    1: { label: 'T1', className: 'bg-green-500/15 text-green-400 border-green-500/30' },
    2: { label: 'T2', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
    3: { label: 'T3', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  }[tier] ?? { label: `T${tier}`, className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' };

  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${config.className}`}>
      {config.label}
    </span>
  );
}

function ConfluenceDots({ score }: { score: number }) {
  const maxDots = 5;
  return (
    <div className="flex items-center gap-1" title={`Confluence: ${score}/5`}>
      {Array.from({ length: maxDots }, (_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < score
              ? score >= 4
                ? 'bg-green-500'
                : score >= 3
                ? 'bg-yellow-500'
                : 'bg-red-500'
              : 'bg-zinc-700'
          }`}
        />
      ))}
      <span className="ml-1 font-mono text-[11px] text-muted-foreground">{score}/5</span>
    </div>
  );
}
