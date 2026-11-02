"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import * as d3 from "d3";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useChartColors } from "@/lib/charts/theme";
import { useWidth } from "@/lib/charts/useWidth";

type Result = { style: string; market: "in" | "us"; trades: number; hit: number; avg_r: number; periods_avg_r: (number | null)[]; random_avg_r: number | null };
type Example = {
  ticker: string; market: "in" | "us"; timeframe: "daily" | "weekly"; signal: number;
  bars: [string, number, number, number, number][];
  entry: number; stop: number; target: number; limit: boolean;
  swings?: [number, number][]; zone?: [number, number]; candles?: number;
};
type Pattern = {
  name: string; family: string; direction: 1 | -1; status: "validated" | "held_back" | "failed";
  on_site: string[]; results: Result[]; example: Example | null;
};
type Lab = { generated: string; patterns: Pattern[] };

const STATUS = {
  validated: { label: "On the site", cls: "bg-up-wash text-up" },
  held_back: { label: "Held back", cls: "bg-warn-wash text-warn" },
  failed: { label: "Failed the test", cls: "bg-wash text-ink-2" },
} as const;
const FILTERS = [["all", "All"], ["validated", "On the site"], ["held_back", "Held back"], ["failed", "Failed"]] as const;
const STYLE_ORDER = ["Intraday 15m", "Intraday 1h", "Swing (daily)", "Positional (weekly)", "Long-term (monthly)"];
const signed = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}R`);

/** Every pattern we tested: a real example of what the detector found, and how it did in 10 years of data. */
export default function PatternLabPage() {
  const [lab, setLab] = useState<Lab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<(typeof FILTERS)[number][0]>("all");
  const [family, setFamily] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/pattern-lab.json").then((r) => r.json()).then(setLab).catch((e) => setError((e as Error).message));
  }, []);

  const families = useMemo(() => [...new Set((lab?.patterns ?? []).map((p) => p.family))].sort(), [lab]);
  const shown = (lab?.patterns ?? []).filter(
    (p) => (status === "all" || p.status === status) && (family === "all" || p.family === family) && p.name.toLowerCase().includes(q.toLowerCase()),
  );
  const count = (s: string) => (lab?.patterns ?? []).filter((p) => s === "all" || p.status === s).length;

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Pattern lab</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-2">
          Every chart and candlestick pattern we tested on 10 years of Indian and US stocks: a real example of what the detector found, with the
          entry, stop and 1:2 target the test used, and how the pattern did. Only the ones marked &quot;On the site&quot; are shown on stock pages.
        </p>
        {lab && (
          <p className="mt-1.5 text-xs text-ink-3">
            {lab.patterns.length} patterns · {count("validated")} on the site · {count("held_back")} held back (they passed, but almost all their
            gains came from the 2020 crash and rebound) · {count("failed")} failed · examples from {lab.generated}
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([id, label]) => (
          <button key={id} onClick={() => setStatus(id)} aria-pressed={status === id}
            className={clsx("rounded-md px-2.5 py-1 text-xs", status === id ? "bg-ink font-medium text-paper" : "bg-wash text-ink-2 hover:text-ink")}>
            {label} {lab && <span className="opacity-60">{count(id)}</span>}
          </button>
        ))}
        <select value={family} onChange={(e) => setFamily(e.target.value)} className="rounded-md border border-line bg-paper px-2 py-1 text-xs">
          <option value="all">Every family</option>
          {families.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patterns"
          className="w-44 rounded-md border border-line bg-paper px-2 py-1 text-xs outline-none focus:border-ink-3" />
      </div>

      {error && <p className="text-sm text-down">{error}</p>}
      {!lab && !error && <div className="h-64 animate-pulse rounded-xl bg-wash" />}

      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((p) => <PatternCard key={p.name} p={p} />)}
      </div>
      {lab && shown.length === 0 && <p className="text-sm text-ink-2">No pattern matches.</p>}

      <details className="rounded-xl border border-line px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">How a pattern passes</summary>
        <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink-2">
          <p>Each pattern was traded mechanically on every liquid stock: entry at the next open (ICT blocks: a limit order at the zone&apos;s middle), the
            stop shown, targets of 1 to 3 times the risk, costs included, in two periods (2016-22 and 2023-26).</p>
          <p>To be shown on stock pages it needs at least 200 trades, a profit after costs in both periods, a result better than random entries with the
            same stops, at least +0.10R a trade and an edge too big to be luck across the thousands of setups tested.</p>
          <p>The table on each card shows the 1:2 target without filters; a pattern can pass only in one style and market, or only with a filter (the
            &quot;On the site&quot; line says where). R = the trade&apos;s risk, entry to stop. Full details: docs/PATTERNS.md.</p>
        </div>
      </details>
    </div>
  );
}

function PatternCard({ p }: { p: Pattern }) {
  const up = p.direction > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const ex = p.example;
  const st = STATUS[p.status];
  return (
    <article className="rounded-xl border border-line" id={p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <span className={clsx("inline-flex items-center gap-1 text-sm font-semibold", up ? "text-up" : "text-down")}>
          <Icon className="h-4 w-4" /> {p.name}
        </span>
        <span className={clsx("rounded px-1.5 py-0.5 text-[11px] font-medium", st.cls)}>{st.label}</span>
        <span className="ml-auto text-[11px] text-ink-3">{p.family}</span>
      </div>
      {ex ? (
        <div className="px-3 pt-2">
          <p className="px-1 text-[11px] text-ink-3">
            Example: {ex.ticker.replace(/\.NS$/, "")} · {ex.timeframe} candles · signal {ex.bars[ex.signal][0]}
            {ex.limit ? " · limit order at the zone's middle" : " · entry at the next open"}
          </p>
          <MiniChart ex={ex} up={up} />
        </div>
      ) : (
        <p className="px-4 pt-3 text-xs text-ink-3">No example on the sample stocks: this pattern is very rare.</p>
      )}
      <div className="overflow-x-auto px-4 pb-3 pt-2">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-ink-3">
              <th className="py-1 pr-2 font-normal">Style</th>
              <th className="py-1 pr-2 font-normal">Market</th>
              <th className="py-1 pr-2 text-right font-normal">Trades</th>
              <th className="py-1 pr-2 text-right font-normal">Hit 1:2</th>
              <th className="py-1 pr-2 text-right font-normal">Avg (2016-22 / 23-26)</th>
              <th className="py-1 text-right font-normal">Random</th>
            </tr>
          </thead>
          <tbody>
            {[...p.results].sort((a, b) => a.market.localeCompare(b.market) || STYLE_ORDER.indexOf(a.style) - STYLE_ORDER.indexOf(b.style)).map((r) => {
              const both = r.periods_avg_r.every((v) => v != null && v > 0);
              return (
                <tr key={`${r.style}-${r.market}`} className="tabular border-t border-line">
                  <td className="py-1 pr-2 text-ink-2">{r.style}</td>
                  <td className="py-1 pr-2 text-ink-2">{r.market === "in" ? "India" : "USA"}</td>
                  <td className="py-1 pr-2 text-right text-ink-2">{r.trades.toLocaleString()}</td>
                  <td className="py-1 pr-2 text-right text-ink-2">{(r.hit * 100).toFixed(0)}%</td>
                  <td className={clsx("py-1 pr-2 text-right", both ? "text-up" : "text-ink-2")}>
                    {signed(r.periods_avg_r[0])} / {signed(r.periods_avg_r[1])}
                  </td>
                  <td className="py-1 text-right text-ink-3">{signed(r.random_avg_r)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {p.on_site.length > 0 && <p className="mt-2 text-[11px] text-up">On stock pages: {p.on_site.join("; ")} (with the filters that passed)</p>}
        {p.status === "held_back" && (
          <p className="mt-2 text-[11px] text-warn">Passed the trade-by-trade test, but most of its gains came in a few months of 2020; held back until it passes a stricter, month-by-month test.</p>
        )}
      </div>
    </article>
  );
}

const H = 210;
const M = { top: 8, right: 52, bottom: 16, left: 4 };

function MiniChart({ ex, up }: { ex: Example; up: boolean }) {
  const C = useChartColors();
  const [box, width] = useWidth<HTMLDivElement>();
  const n = ex.bars.length;
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const lows = [...ex.bars.map((b) => b[3]), ex.stop, ex.target, ex.entry];
  const highs = [...ex.bars.map((b) => b[2]), ex.stop, ex.target, ex.entry];
  const y = d3.scaleLinear().domain([d3.min(lows)!, d3.max(highs)!]).nice(4).range([innerH, 0]);
  const x = d3.scaleBand<number>().domain(d3.range(n)).range([0, innerW]).padding(0.25);
  const cx = (i: number) => (x(i) ?? 0) + x.bandwidth() / 2;
  const s = ex.signal;
  const from = ex.candles ? s - ex.candles + 1 : s;
  const fmt = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: v >= 100 ? 0 : 2 });
  const levels: [string, number, string][] = [["target", ex.target, C.up], ["entry", ex.entry, C.ink2], ["stop", ex.stop, C.down]];

  return (
    <div ref={box} className="w-full">
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={`Example of the pattern on ${ex.ticker}`}>
          <g transform={`translate(${M.left},${M.top})`}>
            {y.ticks(4).map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x2={innerW} stroke={C.line} />
                <text x={innerW + 6} dy="0.32em" fontSize={10} fill={C.ink3} className="tabular">{fmt(t)}</text>
              </g>
            ))}
            {/* the pattern's candles */}
            <rect x={(x(from) ?? 0) - 2} width={cx(s) - (x(from) ?? 0) + x.bandwidth() / 2 + 4} y={0} height={innerH} fill={C.forecast} opacity={0.1} />
            {ex.zone && (
              <rect x={x(Math.max(0, s - 3)) ?? 0} width={innerW - (x(Math.max(0, s - 3)) ?? 0)} y={y(ex.zone[1])}
                height={Math.max(1, y(ex.zone[0]) - y(ex.zone[1]))} fill={up ? C.up : C.down} opacity={0.15} />
            )}
            {ex.bars.map(([, o, h, l, c], i) => {
              const color = c >= o ? C.up : C.down;
              return (
                <g key={i} opacity={i > s ? 0.45 : 1}>
                  <line x1={cx(i)} x2={cx(i)} y1={y(h)} y2={y(l)} stroke={color} />
                  <rect x={x(i)} width={x.bandwidth()} y={y(Math.max(o, c))} height={Math.max(1, Math.abs(y(o) - y(c)))} fill={color} />
                </g>
              );
            })}
            {ex.swings && ex.swings.length > 1 && (
              <path d={d3.line()(ex.swings.map(([i, p]) => [cx(i), y(p)])) ?? ""} fill="none" stroke={C.forecast} strokeWidth={1.5} />
            )}
            {levels.map(([label, v, color]) => (
              <g key={label}>
                <line x1={cx(s)} x2={innerW} y1={y(v)} y2={y(v)} stroke={color} strokeDasharray={label === "entry" ? "3 3" : undefined} strokeWidth={1.2} />
                <text x={innerW - 4} y={y(v)} dy={label === "stop" ? (up ? "1.1em" : "-0.4em") : label === "target" ? (up ? "-0.4em" : "1.1em") : "-0.4em"}
                  textAnchor="end" fontSize={10} fontWeight={600} fill={color} paintOrder="stroke" stroke={C.paper} strokeWidth={3}>
                  {label} {fmt(v)}
                </text>
              </g>
            ))}
            <text x={cx(s)} y={innerH + 12} textAnchor="middle" fontSize={10} fill={C.ink3}>signal</text>
          </g>
        </svg>
      )}
      <p className="px-1 pb-1 text-[10px] text-ink-3">
        Shaded: the pattern{ex.swings ? "; blue line: the swing points the detector used" : ""}{ex.zone ? "; coloured band: the block's zone" : ""}.
        Faded candles: what happened after the signal.
      </p>
    </div>
  );
}
