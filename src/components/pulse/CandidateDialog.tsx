"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { X } from "lucide-react";
import { getHistory, runForecast, type Candle, type Forecast, type MarketId, type PulseCandidate } from "@/lib/api";
import { price } from "@/lib/format";
import { BreakoutChart } from "./BreakoutChart";
import { StockLogo } from "../StockLogo";

const INDEX: Record<MarketId, string> = { in: "^NSEI", us: "^GSPC" }; // the index Market Pulse compares with

/** Completed daily bars only: what last night's indicators were computed from (today is the live price). */
function completed(candles: Candle[], tz: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  return candles.filter((k) => new Date(k[0]).toISOString().slice(0, 10) < today);
}

/** A breakout candidate's conditions, each drawn on a real chart. */
export function CandidateDialog({ market, c, indexName, indexLive, tz, onClose }: {
  market: MarketId;
  c: PulseCandidate;
  indexName: string;
  indexLive: number | null;
  tz: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ stock: Candle[]; index: Candle[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getHistory(market, c.symbol, "1d"), getHistory(market, INDEX[market], "1d")])
      .then(([s, i]) => alive && setData({ stock: completed(s.candles, tz), index: completed(i.candles, tz) }))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load the chart"));
    return () => {
      alive = false;
    };
  }, [market, c.symbol, tz]);

  // Enter animation, Escape closes, focus moves into the dialog, and the page behind doesn't scroll.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  function close() {
    setShown(false);
    window.setTimeout(onClose, 180);
  }

  const met = Object.values(c.checks).filter(Boolean).length;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="cand-title">
      <div className={clsx("absolute inset-0 bg-black/45 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")} onClick={close} />
      <div className={clsx(
        "relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-line bg-paper shadow-xl transition-all duration-200 sm:rounded-2xl",
        shown ? "translate-y-0 opacity-100 sm:scale-100" : "translate-y-4 opacity-0 sm:scale-[0.98]",
      )}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <StockLogo market={market} symbol={c.symbol} size={36} />
            <div className="min-w-0">
              <h2 id="cand-title" className="text-base font-semibold">
                {c.symbol} · {met} of 6 conditions met
              </h2>
              <p className="truncate text-xs text-ink-3">
                {c.name ?? c.sector} · live {price(c.price, market)}{" "}
                <span className={(c.change_pct ?? 0) >= 0 ? "text-up" : "text-down"}>
                  {(c.change_pct ?? 0) >= 0 ? "+" : ""}{(c.change_pct ?? 0).toFixed(2)}%
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={`/stock/${market}/${encodeURIComponent(c.symbol)}`} className="hidden rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-ink-3 hover:text-ink sm:inline-block">
              Open stock page →
            </Link>
            <button ref={closeRef} onClick={close} aria-label="Close" className="rounded-lg p-1.5 text-ink-2 hover:bg-wash hover:text-ink">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-4">
          {error && <p className="text-sm text-down">{error}</p>}
          {!data && !error && <div className="h-[640px] animate-pulse rounded-xl bg-wash" />}
          {data && data.stock.length >= 30 && (
            <BreakoutChart market={market} c={c} candles={data.stock} index={data.index} indexName={indexName} indexLive={indexLive} tz={tz} />
          )}
          {data && data.stock.length < 30 && <p className="text-sm text-ink-2">Not enough price history to draw the indicators.</p>}
          {c.plan && <AiRange market={market} c={c} />}
        </div>
      </div>
    </div>
  );
}

/** Kronos's 10-day range next to the plan's stop and target, on demand. Its range is tested (held 83% of outcomes);
 *  its up / down view isn't reliable, so no hit probabilities are claimed. */
function AiRange({ market, c }: { market: MarketId; c: PulseCandidate }) {
  const plan = c.plan!;
  const [fc, setFc] = useState<Forecast | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setFc(await runForecast(market, c.symbol, { interval: "1d", model: "fast", horizon: plan.max_days, n_samples: 20 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The forecast failed");
    } finally {
      setBusy(false);
    }
  }

  const s = fc?.summary;
  // In testing the range held 84% of outcomes, but only 43% when the latest close sat outside the AI's own range
  // (56 of 4,247 forecasts): the model is then extremely one-sided and shouldn't be trusted.
  const eps = s ? s.last_close * 1e-4 : 0; // "on the edge" counts as inside, as in the test
  const oneSided = !!s && (s.last_close < s.close_p10 - eps || s.last_close > s.close_p90 + eps);
  const drift = s ? plan.entry / s.last_close - 1 : 0; // the forecast starts from the last completed close
  const where = (v: number) => (!s ? "" : v < s.close_p10 ? "below the range" : v > s.close_p90 ? "above the range" : "inside the range");
  const lo = s ? Math.min(s.close_p10, plan.stop) : 0;
  const hi = s ? Math.max(s.close_p90, plan.target) : 1;
  const at = (v: number) => `${((v - lo) / (hi - lo || 1)) * 100}%`;
  return (
    <section className="mt-4 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">AI forecast range for the next {plan.max_days} days</h3>
          <p className="mt-0.5 text-xs text-ink-3">
            Where CandleTrade AI expects the price to land, next to the plan&apos;s stop and target. Its range has been reliable in testing; its
            up / down call hasn&apos;t, so read the range, not a direction.
          </p>
        </div>
        <button onClick={run} disabled={busy}
          className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60">
          {busy ? "Running… (about 10 s)" : fc ? "Run again" : "Show AI range"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-down">{error}</p>}
      {s && oneSided && (
        <p className="mt-3 rounded-lg bg-warn-wash px-3 py-2 text-xs leading-relaxed text-warn">
          <b>Don&apos;t use this range.</b> The AI is extremely one-sided here: the latest close ({price(s.last_close, market)}) is outside its own
          80% range ({price(s.close_p10, market)} – {price(s.close_p90, market)}). In testing that happened in 56 of 4,247 forecasts, and the range then
          held only 43% of the time (84% otherwise). It often happens after very sharp moves like this one.
        </p>
      )}
      {s && !oneSided && (
        <div className="mt-4">
          <div className="relative h-8">
            <div className="absolute inset-x-0 top-3.5 h-1 rounded-full bg-line" />
            <div className="absolute top-2.5 h-3 rounded bg-accent/30" style={{ left: at(s.close_p10), width: `calc(${at(s.close_p90)} - ${at(s.close_p10)})` }}
              title="80% likely range" />
            {([["stop", plan.stop, "bg-down"], ["entry", plan.entry, "bg-ink"], ["target", plan.target, "bg-up"], ["median", s.predicted_close, "bg-accent"]] as const).map(([k, v, cls]) => (
              <div key={k} className={clsx("absolute top-1 h-6 w-0.5", cls)} style={{ left: at(v) }} title={k} />
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
            {([["bg-accent/30", "80% range"], ["bg-accent", "median"], ["bg-ink", "entry"], ["bg-down", "stop"], ["bg-up", "target"]] as const).map(([cls, label]) => (
              <span key={label} className="flex items-center gap-1.5"><span className={clsx("h-2.5 w-2.5 rounded-sm", cls)} />{label}</span>
            ))}
          </div>
          <div className="tabular mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
            <span><span className="text-ink-3">80% range </span>{price(s.close_p10, market)} – {price(s.close_p90, market)}</span>
            <span><span className="text-ink-3">Median </span>{price(s.predicted_close, market)}</span>
            <span className="text-down"><span className="text-ink-3">Stop </span>{price(plan.stop, market)} ({where(plan.stop)})</span>
            <span className="text-up"><span className="text-ink-3">Target </span>{price(plan.target, market)} ({where(plan.target)})</span>
          </div>
          {Math.abs(drift) > 0.02 && (
            <p className="mt-2 text-[11px] text-warn">
              The forecast starts from the last completed close, {price(s.last_close, market)}; the live price has moved {drift >= 0 ? "+" : ""}
              {(drift * 100).toFixed(1)}% since, so read the range with that in mind.
            </p>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            The 80% range held the actual price 84% of the time in testing. A target above the range means the AI&apos;s paths rarely reach it within
            {" "}{plan.max_days} days; a stop inside the range means ordinary swings can reach it. Closed higher after views like this in testing:{" "}
            {s.tested_prob_up != null ? `≈ ${Math.round(s.tested_prob_up * 100)}%` : "not tested"}.
          </p>
        </div>
      )}
    </section>
  );
}
