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

/** Re-runs the AI from recent past dates (seeing only data before each) and compares with what happened.
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

  const n = result?.checks.length ?? 0;
  const inside = result ? result.checks.filter((c) => c.actual >= c.low && c.actual <= c.high).length : 0;
  const rightWay = result ? result.checks.filter((c) => c.direction_hit).length : 0;

  return (
    <section className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">How has the AI done on {symbol}?</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            Forecasts {bars} {unit} ahead from the last {CHECKS} past points, each using only data before it, then checks whether the actual
            price landed inside the AI&apos;s 80% range. The range is the part that held up in testing; its up / down lean didn&apos;t.
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
          <div className="grid grid-cols-1 gap-4 p-4 text-sm sm:grid-cols-3">
            <Metric label="Price landed inside the 80% range" value={`${inside} / ${n}`}
              note={`expected about ${Math.round(n * 0.8)} of ${n} · in testing it held 84%`} />
            <Metric label="Up / down lean right" value={`${rightWay} / ${n}`} note={`a coin flip gets about ${n / 2}; not used for calls`} />
            <Metric label="Middle of the range vs the price" value={`${pct(result.mean_error_pct)} off`}
              note={`“no change” was ${pct(result.naive_error_pct)} off`} />
          </div>
          <p className="border-t border-line px-4 py-2.5 text-xs leading-relaxed text-ink-2">
            {inside >= Math.round(n * 0.75)
              ? `The range held on ${symbol} recently: use it for how far the price may swing (stops, position size), not for which way.`
              : `The range missed more often than usual on ${symbol} recently: allow for bigger swings than it shows.`}{" "}
            {n} checks is a small sample.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-line text-left text-xs text-ink-3">
                  <th className="px-4 py-2 font-normal">From</th>
                  <th className="px-4 py-2 font-normal">To</th>
                  <th className="px-4 py-2 text-right font-normal">Close then</th>
                  <th className="px-4 py-2 text-right font-normal">AI 80% range</th>
                  <th className="px-4 py-2 text-right font-normal">Actual</th>
                  <th className="px-4 py-2 text-center font-normal">Inside range?</th>
                  <th className="hidden px-4 py-2 font-normal md:table-cell">Up / down lean (not used)</th>
                </tr>
              </thead>
              <tbody>
                {result.checks.map((c) => {
                  const hit = c.actual >= c.low && c.actual <= c.high;
                  const leanUp = c.predicted >= c.base, wentUp = c.actual >= c.base;
                  return (
                    <tr key={c.from_time} className="tabular border-t border-line">
                      <td className="px-4 py-2 text-ink-2">{barTime(c.from_time, interval === "1h")}</td>
                      <td className="px-4 py-2 text-ink-2">{barTime(c.to_time, interval === "1h")}</td>
                      <td className="px-4 py-2 text-right">{price(c.base, market)}</td>
                      <td className="px-4 py-2 text-right text-ink-2">{price(c.low, market)} – {price(c.high, market)}</td>
                      <td className="px-4 py-2 text-right font-medium">{price(c.actual, market)}</td>
                      <td className="px-4 py-2">
                        <span className={clsx("flex items-center justify-center gap-1 text-xs", hit ? "text-up" : "text-down")}>
                          {hit ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                          {hit ? "Inside" : c.actual > c.high ? "Above" : "Below"}
                        </span>
                      </td>
                      <td className="hidden px-4 py-2 text-xs text-ink-3 md:table-cell">
                        AI leaned {leanUp ? "up" : "down"}, price went {wentUp ? "up" : "down"} {c.direction_hit ? "(matched)" : "(didn’t)"}
                      </td>
                    </tr>
                  );
                })}
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
