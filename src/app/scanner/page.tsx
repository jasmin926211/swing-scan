'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ScanSearch,
  Play,
  CheckCircle,
  XCircle,
  Shield,
  X,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { formatPrice, formatSignalStrength, getDirectionBg, timeAgo } from '@/lib/utils';
import { PATTERN_DISPLAY_NAMES } from '@/types/pattern';

interface ScanSession {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  triggerType: string;
  totalStocks: number;
  scannedCount: number;
  errorCount: number;
  patternsFound: number;
}

export default function ScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{
    scannedCount: number;
    totalStocks: number;
    patternsFound: number;
    status: string;
  } | null>(null);
  const [history, setHistory] = useState<ScanSession[]>([]);
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [filterDirection, setFilterDirection] = useState<string>('all');
  const [filterPattern, setFilterPattern] = useState<string>('all');
  const [authAlert, setAuthAlert] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/scan/history');
      const data = await res.json();
      if (data.success) setHistory(data.data || []);
    } catch {
      // Ignore
    }
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch('/api/scan/results?limit=100');
      const data = await res.json();
      if (data.success && data.data) setResults(data.data.results || []);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchResults();
  }, [fetchHistory, fetchResults]);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function startScan() {
    // Check auth before scanning
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

    setAuthAlert(false);
    setScanning(true);
    setProgress({ scannedCount: 0, totalStocks: 0, patternsFound: 0, status: 'running' });

    try {
      const triggerRes = await fetch('/api/scan/trigger', { method: 'POST' });
      const triggerData = await triggerRes.json();

      if (!triggerData.success) {
        setScanning(false);
        setProgress(null);
        return;
      }

      // Poll for progress every 2 seconds
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/scan/status');
          const data = await res.json();

          if (data.success && data.data) {
            const status = data.data;
            setProgress({
              scannedCount: status.scannedCount,
              totalStocks: status.totalStocks,
              patternsFound: status.patternsFound,
              status: status.status,
            });

            if (status.status === 'completed' || status.status === 'failed') {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              setScanning(false);
              fetchHistory();
              fetchResults();
            }
          }
        } catch {
          // Ignore poll errors, will retry next interval
        }
      }, 2000);
    } catch {
      setScanning(false);
      setProgress(null);
    }
  }

  const filteredResults = results.filter((r: Record<string, unknown>) => {
    if (filterDirection !== 'all' && r.direction !== filterDirection) return false;
    if (filterPattern !== 'all' && r.patternName !== filterPattern) return false;
    return true;
  });

  const uniquePatterns = Array.from(new Set(results.map((r: Record<string, unknown>) => r.patternName as string)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Scanner Control
          </div>
          <h2 className="text-2xl font-bold text-card-foreground">Stock Scanner</h2>
          <p className="text-sm text-muted-foreground">
            Scan Nifty 500 for chart patterns
          </p>
        </div>

        <button
          onClick={startScan}
          disabled={scanning}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.05em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {scanning ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Play className="h-5 w-5" />
          )}
          {scanning ? 'Scanning...' : 'Scan Now'}
        </button>
      </div>

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

      {/* Progress Bar */}
      {progress && progress.status === 'running' && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              <ScanSearch className="mr-2 inline h-4 w-4 text-primary" />
              Scanning stocks...
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {progress.scannedCount}/{progress.totalStocks} stocks |{' '}
              {progress.patternsFound} patterns found
            </span>
          </div>
          <div className="mt-3 h-3 rounded-full bg-secondary">
            <div
              className="h-3 rounded-full bg-primary transition-all duration-300"
              style={{
                width: `${
                  progress.totalStocks > 0
                    ? (progress.scannedCount / progress.totalStocks) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {progress.totalStocks > 0
              ? `${((progress.scannedCount / progress.totalStocks) * 100).toFixed(0)}% complete`
              : 'Starting...'}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={filterDirection}
          onChange={(e) => setFilterDirection(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-foreground"
        >
          <option value="all">All Directions</option>
          <option value="bullish">Bullish Only</option>
          <option value="bearish">Bearish Only</option>
        </select>

        <select
          value={filterPattern}
          onChange={(e) => setFilterPattern(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-foreground"
        >
          <option value="all">All Patterns</option>
          {uniquePatterns.map((p) => (
            <option key={p} value={p}>
              {PATTERN_DISPLAY_NAMES[p] || p}
            </option>
          ))}
        </select>

        <span className="font-mono text-xs text-muted-foreground">
          {filteredResults.length} results
        </span>
      </div>

      {/* Results Table */}
      {filteredResults.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Pattern</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Strength</th>
                  <th className="px-4 py-3">C</th>
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3">SL</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">R:R</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r: Record<string, unknown>, idx: number) => {
                  const strength = formatSignalStrength(r.signalStrength as number);
                  return (
                    <tr key={r.id as string} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{r.tradingSymbol as string}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{formatPrice(r.currentPrice as number)}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {PATTERN_DISPLAY_NAMES[r.patternName as string] || r.patternName as string}
                      </td>
                      <td className="px-4 py-3">
                        <TierBadge tier={(r.tier as number) ?? 3} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium ${getDirectionBg(r.direction as string)}`}>
                          {r.direction === 'bullish' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {r.direction as string}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-xs font-medium ${strength.className}`}>
                          {((r.signalStrength as number) * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground" title={`Confluence: ${(r.confluenceScore as number) ?? 0}/5`}>
                          {(r.confluenceScore as number) ?? 0}/5
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">{formatPrice(r.entryPrice as number)}</td>
                      <td className="px-4 py-3 font-mono text-sm text-red-400">{formatPrice(r.stopLoss as number)}</td>
                      <td className="px-4 py-3 font-mono text-sm text-green-400">{formatPrice(r.target1 as number)}</td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {r.riskRewardRatio ? `1:${(r.riskRewardRatio as number).toFixed(1)}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/stock/${r.tradingSymbol}`} className="text-muted-foreground hover:text-foreground">
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scan History */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            History
          </div>
          <h3 className="text-base font-semibold text-card-foreground">Scan History</h3>
        </div>
        {history.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No scan history yet. Run your first scan above.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {history.map((scan) => (
              <div key={scan.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  {scan.status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : scan.status === 'failed' ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(scan.startedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Kolkata',
                      })}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {scan.triggerType === 'scheduled' ? 'Auto-scan' : 'Manual'} |{' '}
                      {scan.scannedCount}/{scan.totalStocks} stocks
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-medium text-foreground">
                    {scan.patternsFound} patterns
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {scan.completedAt ? timeAgo(scan.completedAt) : scan.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
