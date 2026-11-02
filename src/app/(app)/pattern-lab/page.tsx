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
type Setup = { style: string; market: "in" | "us"; filters: string[]; reward_risk: number; trades: number; hit_rate: number; avg_r: number; edge_r: number };
type Pattern = {
  name: string; family: string; direction: 1 | -1; status: "validated" | "held_back" | "failed";
  on_site: string[]; setups: Setup[]; results: Result[]; example: Example | null;
};
type Lab = { generated: string; tested: number; patterns: Pattern[] };

const FILTER_TEXT: Record<string, string> = { volume: "high volume", trend: "with the trend", confirm: "after a confirmation candle" };
const signed = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}R`);

/** The patterns that passed a 10-year test: a real example of each, and the record it passed with. */
export default function PatternLabPage() {
  const [lab, setLab] = useState<Lab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/pattern-lab.json").then((r) => r.json()).then(setLab).catch((e) => setError((e as Error).message));
  }, []);

  const families = useMemo(() => [...new Set((lab?.patterns ?? []).map((p) => p.family))].sort(), [lab]);
  const shown = (lab?.patterns ?? []).filter((p) => (family === "all" || p.family === family) && p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Tested patterns</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-2">
          The chart and candlestick patterns that held up when traded mechanically on 10 years of Indian and US stocks, after costs, in two separate
          periods and better than random entries. Each card shows a real example and the record it passed with. These are the patterns flagged on
          stock pages.
        </p>
        {lab && (
          <p className="mt-1.5 text-xs text-ink-3">
            {lab.patterns.length} of the {lab.tested} patterns we tested passed. None wins most of the time: the best hit their target 35-60% of the
            time and make money because their winners are bigger than their losers. Size every trade so a losing streak is affordable.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
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
        <summary className="cursor-pointer font-medium">How a pattern passed</summary>
        <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink-2">
          <p>Each pattern was traded mechanically on every liquid stock: entry at the next open (ICT blocks: a limit order at the zone&apos;s middle), the
            stop shown, targets of 1 to 3 times the risk, costs included, in two periods (2016-22 and 2023-26).</p>
          <p>To be shown on stock pages it needs at least 200 trades, a profit after costs in both periods, a result better than random entries with the
            same stops, at least +0.10R a trade and an edge too big to be luck across the thousands of setups tested.</p>
          <p>Each card&apos;s table is the exact version that passed: where (timeframe and market), when (its filters) and its target. On other
            timeframes, markets or without those filters the pattern didn&apos;t pass, and the stock pages only flag this version. Full records of
            every pattern tested, including the ones that failed: docs/PATTERNS.md.</p>
        </div>
      </details>
    </div>
  );
}

function PatternCard({ p }: { p: Pattern }) {
  const up = p.direction > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const ex = p.example;
  return (
    <article className="rounded-xl border border-line" id={p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <span className={clsx("inline-flex items-center gap-1 text-sm font-semibold", up ? "text-up" : "text-down")}>
          <Icon className="h-4 w-4" /> {p.name}
        </span>
        <span className="rounded bg-up-wash px-1.5 py-0.5 text-[11px] font-medium text-up">Passed</span>
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
        <p className="mb-1 text-[11px] font-medium text-ink-2">The record it passed with (10 years, after costs)</p>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-ink-3">
              <th className="py-1 pr-2 font-normal">Where</th>
              <th className="py-1 pr-2 font-normal">When</th>
              <th className="py-1 pr-2 text-right font-normal">Trades</th>
              <th className="py-1 pr-2 text-right font-normal">Hit target</th>
              <th className="py-1 pr-2 text-right font-normal">Avg per trade</th>
              <th className="py-1 text-right font-normal">vs random</th>
            </tr>
          </thead>
          <tbody>
            {p.setups.map((r, k) => (
              <tr key={k} className="tabular border-t border-line">
                <td className="py-1 pr-2 text-ink-2">{r.style}, {r.market === "in" ? "India" : "USA"}</td>
                <td className="py-1 pr-2 text-ink-2">
                  {r.filters.length ? r.filters.map((f) => FILTER_TEXT[f] ?? f).join(", ") : "any time"} · 1:{r.reward_risk}
                </td>
                <td className="py-1 pr-2 text-right text-ink-2">{r.trades.toLocaleString()}</td>
                <td className="py-1 pr-2 text-right text-ink-2">{(r.hit_rate * 100).toFixed(0)}%</td>
                <td className="py-1 pr-2 text-right text-up">{signed(r.avg_r)}</td>
                <td className="py-1 text-right text-up">{signed(r.edge_r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1.5 text-[10px] text-ink-3">1:2 = the target is twice the risk (entry to stop). R = that risk: +0.20R on a ₹1,000 risk is ₹200 a trade on average.</p>
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
