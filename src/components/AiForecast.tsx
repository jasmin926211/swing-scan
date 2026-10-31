"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Play } from "lucide-react";
import { runForecast, type Forecast, type Interval, type MarketId } from "@/lib/api";
import { pct, price, signedPct } from "@/lib/format";

const when = (t: number) => new Date(t).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

/** The AI's price forecast for the next 10 sessions, with what testing said about it: the range held, the direction didn't. */
export function AiForecast({ market, symbol, interval, forecast, onForecast }: {
  market: MarketId;
  symbol: string;
  interval: Interval;
  forecast: Forecast | null;
  onForecast: (f: Forecast) => void;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);

  async function run() {
    setRunning(true);
    setElapsed(0);
    setError(null);
    try {
      onForecast(await runForecast(market, symbol));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const s = forecast?.summary;
  const end = forecast?.points[forecast.points.length - 1];
  const upPaths = s && forecast ? Math.round(s.prob_up * forecast.paths.length) : 0;
  // In testing the range held 84% of outcomes, but only 43% when the last close sat outside the AI's own range.
  const oneSided = s ? s.last_close < s.close_p10 * (1 - 1e-4) || s.last_close > s.close_p90 * (1 + 1e-4) : false;

  return (
    <section className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">AI forecast</h2>
          <p className="text-xs text-ink-3">Possible prices over the next 10 trading days, from the last 64 daily candles.</p>
        </div>
        <button onClick={run} disabled={running}
          className="flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60">
          {running ? <>Running… {elapsed}s</> : <><Play className="h-3.5 w-3.5" /> {forecast ? "Run again" : `Forecast ${symbol}`}</>}
        </button>
      </div>
      {error && <p className="px-4 pb-3 text-sm text-down">{error}</p>}

      {s && forecast && end && (
        <div className={clsx("grid gap-4 border-t border-line p-4 md:grid-cols-3", running && "opacity-50")}>
          <div>
            <p className="text-xs text-ink-3">Middle forecast for {when(end.time)}</p>
            <p className="tabular text-2xl font-semibold tracking-tight">{price(s.predicted_close, market)}</p>
            <p className="tabular text-xs text-ink-3">{signedPct((s.predicted_close / s.last_close - 1) * 100, 1)} from the last close {price(s.last_close, market)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">80% range</p>
            <p className="tabular text-2xl font-semibold tracking-tight">
              {price(s.close_p10, market)} – {price(s.close_p90, market)}
            </p>
            <p className="text-xs text-ink-3">In testing the close landed inside this range 83% of the time.</p>
          </div>
          <div className="rounded-lg bg-warn-wash px-3 py-2.5 text-xs leading-relaxed text-warn">
            <b>Don&apos;t trade on the direction.</b> {upPaths} of {forecast.paths.length} paths end higher, but in tests on 4,245 past
            forecasts the price went the way the AI leaned only about half the time
            {s.tested_prob_up != null && <> (after views like this one, {pct(s.tested_prob_up, 0)} closed higher)</>}: a coin flip.
            Use the range for how far it may move.
          </div>
          {oneSided && (
            <p className="rounded-lg bg-warn-wash px-3 py-2 text-xs leading-relaxed text-warn md:col-span-3">
              <b>Don&apos;t use this range either.</b> The last close is outside the AI&apos;s own range: it is extremely one-sided, which
              happens after very sharp moves. In testing the range then held only 43% of the time.
            </p>
          )}
          <p className="text-[11px] text-ink-3 md:col-span-3">
            {forecast.bars_used} daily candles to {when(forecast.as_of)} · {forecast.seconds}s · drawn on the daily chart below
            {interval !== "1d" && " (switch the chart to Daily to see it)"}. A statistical forecast, not advice.
          </p>
        </div>
      )}
    </section>
  );
}
