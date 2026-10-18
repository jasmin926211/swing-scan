"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, X } from "lucide-react";
import { runBacktest, type Backtest, type Interval, type MarketId } from "@/lib/api";
import { barTime, pct, price } from "@/lib/format";

const HORIZON: Record<Interval, { bars: number; unit: string }> = {
  "1h": { bars: 14, unit: "hours" },
  "1d": { bars: 10, unit: "days" },
  "1wk": { bars: 8, unit: "weeks" },
};
const CHECKS = 8;

export type AccuracyState = ReturnType<typeof useAccuracyCheck>;

/** Re-runs Kronos from recent past dates (seeing only data before each) and compares with what happened.
 *  Lives in the page so a forecast can start it and the forecast panel can show its verdict. */
export function useAccuracyCheck(market: MarketId, symbol: string, interval: Interval) {
  const [result, setResult] = useState<Backtest | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { bars } = HORIZON[interval];
  const current = useRef("");
  const key = `${market}/${symbol}/${interval}`;

  useEffect(() => {
    current.current = key;
    setResult(null);
    setError(null);
  }, [key]);

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);

  const run = useCallback(async () => {
    setRunning(true);
    setElapsed(0);
    setError(null);
    try {
      const r = await runBacktest(market, symbol, { interval, horizon: bars, n_samples: 8, n_checks: CHECKS });
      if (current.current === key) setResult(r); // ignore a reply for a stock the user has left
    } catch (e) {
      if (current.current === key) setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }, [market, symbol, interval, bars, key]);

  return { result, running, elapsed, error, run };
}

export function AccuracyCheck({ symbol, market, interval, check }: { symbol: string; market: MarketId; interval: Interval; check: AccuracyState }) {
  const { result, running, elapsed, error, run } = check;
  const { bars, unit } = HORIZON[interval];

  const beatsNaive = result && result.mean_error_pct < result.naive_error_pct;

  return (
    <section className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">How has Kronos done on {symbol}?</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            Forecasts {bars} {unit} ahead from the last {CHECKS} past points, each using only data before it, then compares with
            what actually happened. Default model, 8 paths each.
          </p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-wash disabled:opacity-60"
        >
          {running ? `Checking… ${elapsed}s` : result ? "Check again" : "Check recent accuracy"}
        </button>
      </div>
      {error && <p className="px-4 pb-4 text-sm text-down">{error}</p>}

      {result && (
        <div className="border-t border-line">
          <div className="grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-4">
            <Metric
              label="Direction right"
              value={`${Math.round(result.direction_accuracy * result.checks.length)} / ${result.checks.length}`}
              note="a coin flip gets half"
            />
            <Metric label="Avg price error" value={pct(result.mean_error_pct)} note={`no-change guess: ${pct(result.naive_error_pct)}`} />
            <Metric label="Inside 80% range" value={pct(result.band_coverage, 0)} note="well calibrated ≈ 80%" />
            <div>
              <p className="text-xs text-ink-3">Verdict</p>
              <p className="mt-0.5 font-medium">{beatsNaive ? "Beat “no change”" : "Did not beat “no change”"}</p>
              <p className="text-xs text-ink-3">{CHECKS} checks is a small sample</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-line text-left text-xs text-ink-3">
                  <th className="px-4 py-2 font-normal">From</th>
                  <th className="px-4 py-2 font-normal">To</th>
                  <th className="px-4 py-2 text-right font-normal">Close then</th>
                  <th className="px-4 py-2 text-right font-normal">Kronos said</th>
                  <th className="hidden px-4 py-2 text-right font-normal md:table-cell">80% range</th>
                  <th className="px-4 py-2 text-right font-normal">Actual</th>
                  <th className="px-4 py-2 text-center font-normal">Direction</th>
                </tr>
              </thead>
              <tbody>
                {result.checks.map((c) => (
                  <tr key={c.from_time} className="tabular border-t border-line">
                    <td className="px-4 py-2 text-ink-2">{barTime(c.from_time, interval === "1h")}</td>
                    <td className="px-4 py-2 text-ink-2">{barTime(c.to_time, interval === "1h")}</td>
                    <td className="px-4 py-2 text-right">{price(c.base, market)}</td>
                    <td className="px-4 py-2 text-right">{price(c.predicted, market)}</td>
                    <td className="hidden px-4 py-2 text-right text-ink-3 md:table-cell">
                      {price(c.low, market)} – {price(c.high, market)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{price(c.actual, market)}</td>
                    <td className="px-4 py-2">
                      <span className={clsx("flex items-center justify-center gap-1 text-xs", c.direction_hit ? "text-up" : "text-down")}>
                        {c.direction_hit ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        {c.direction_hit ? "Right" : "Wrong"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-2.5 text-xs text-ink-3">Took {result.seconds}s on CPU.</p>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="tabular mt-0.5 text-lg font-semibold">{value}</p>
      <p className="text-xs text-ink-3">{note}</p>
    </div>
  );
}
