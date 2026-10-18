"use client";

import { useState } from "react";
import clsx from "clsx";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { MarketId, PatternSignal, PatternStatus, PatternStyle } from "@/lib/api";
import { pct, price } from "@/lib/format";

const STYLE: Record<PatternStyle, string> = {
  swing: "Swing · daily chart",
  positional: "Positional · weekly chart",
  long_term: "Long-term · monthly chart",
};

const STATUS: Record<PatternStatus, { label: string; cls: string }> = {
  new: { label: "New: entry at the next open", cls: "bg-accent-wash text-accent" },
  awaiting_confirmation: { label: "Waiting for a confirmation candle", cls: "bg-warn-wash text-warn" },
  open: { label: "Trade still open", cls: "bg-accent-wash text-accent" },
  target_hit: { label: "Target hit", cls: "bg-up-wash text-up" },
  stopped: { label: "Stopped out", cls: "bg-down-wash text-down" },
  expired: { label: "Closed at the end of the holding period", cls: "bg-wash text-ink-2" },
};

const FILTER_TEXT: Record<string, string> = {
  volume: "high volume",
  trend: "with the bigger trend",
  confirm: "after a confirmation candle",
};

/** Validated pattern signals for one stock: only setups that beat random entry in a 10-year test. */
export function ValidatedPatterns({ signals, liquid, loading, error, market, selected, onSelect }: {
  signals: PatternSignal[] | null;
  liquid: boolean;
  loading: boolean;
  error: string | null;
  market: MarketId;
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const [all, setAll] = useState(false);
  const SHOWN = 6;
  const visible = signals && !all ? signals.slice(0, SHOWN) : signals;
  return (
    <section className="rounded-xl border border-line">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Validated patterns</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
          Only setups that, across 10 years of Indian and US stocks, were profitable after costs in two separate periods and
          beat random entries. Even these miss often: check each one&apos;s record. Click one to see it on the chart.
        </p>
      </div>
      {loading && !signals && <div className="m-4 h-16 animate-pulse rounded-lg bg-wash" />}
      {error && <p className="px-4 py-3 text-sm text-down">{error}</p>}
      {signals && signals.length === 0 && (
        <p className="px-4 py-4 text-sm text-ink-2">
          {liquid
            ? "No validated pattern on this stock in the last five years of completed candles."
            : "Validated patterns are only tracked on liquid stocks (₹1 Cr / $1M traded per day and up); this one trades less."}
        </p>
      )}
      {signals && signals.length > 0 && (
        <ul className="divide-y divide-line">
          {visible!.map((s, i) => {
            const up = s.direction > 0;
            const Icon = up ? TrendingUp : TrendingDown;
            const st = STATUS[s.status];
            const when = new Date(s.time).toLocaleDateString("en-GB", {
              timeZone: "UTC", day: s.style === "long_term" ? undefined : "2-digit", month: "short", year: "numeric",
            });
            return (
              <li key={`${s.style}-${s.pattern}-${s.time}`}>
                <button
                  onClick={() => onSelect(selected === i ? null : i)}
                  aria-pressed={selected === i}
                  className={clsx("block w-full px-4 py-3 text-left transition-colors", selected === i ? "bg-select" : "hover:bg-wash")}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={clsx("inline-flex items-center gap-1 text-sm font-semibold", up ? "text-up" : "text-down")}>
                      <Icon className="h-4 w-4" /> {s.pattern}
                    </span>
                    <span className="rounded bg-wash px-1.5 py-0.5 text-[11px] text-ink-2">{STYLE[s.style]}</span>
                    <span className={clsx("rounded px-1.5 py-0.5 text-[11px] font-medium", st.cls)}>
                      {st.label}
                      {s.outcome_r != null && s.status !== "target_hit" && s.status !== "stopped" && ` (${s.outcome_r >= 0 ? "+" : ""}${s.outcome_r.toFixed(2)}R)`}
                    </span>
                    <span className="ml-auto text-xs text-ink-3">{when}</span>
                  </div>
                  <p className="tabular mt-1.5 text-xs text-ink-2">
                    {up ? "Buy" : "Sell / short"} {s.status === "new" || s.status === "awaiting_confirmation" ? "≈" : "at"} {price(s.entry, market)} · stop{" "}
                    {price(s.stop, market)} · target {price(s.target, market)} (1:{s.reward_risk})
                    {s.filters.length > 0 && ` · ${s.filters.map((f) => FILTER_TEXT[f] ?? f).join(", ")}`}
                  </p>
                  <p className="tabular mt-1 text-xs text-ink-3">
                    Track record: {s.record.trades.toLocaleString()} past trades · target hit {pct(s.record.hit_rate, 0)} · average{" "}
                    {s.record.avg_r >= 0 ? "+" : ""}
                    {s.record.avg_r.toFixed(2)}R per trade · {s.record.edge_r >= 0 ? "+" : ""}
                    {s.record.edge_r.toFixed(2)}R better than random entries
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {signals && signals.length > SHOWN && (
        <button onClick={() => setAll(!all)} className="w-full border-t border-line px-4 py-2.5 text-left text-xs font-medium text-accent hover:bg-wash">
          {all ? "Show the latest 6" : `Show all ${signals.length} signals from the last five years`}
        </button>
      )}
      <p className="border-t border-line px-4 py-2.5 text-[11px] leading-relaxed text-ink-3">
        R = the trade&apos;s risk (entry to stop). Patterns are read from completed candles only. Not advice: past results don&apos;t
        guarantee future ones.{" "}
        {signals?.some((s) => s.direction < 0) && market === "in" && "Short setups in India need stock futures or options to hold overnight."}
      </p>
    </section>
  );
}
