"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import clsx from "clsx";
import { Check, X } from "lucide-react";
import type { Candle, MarketId, PulseCandidate, PulseCheck } from "@/lib/api";
import { useChartColors, FONT } from "@/lib/charts/theme";
import { duration, useReducedMotion } from "@/lib/charts/motion";
import { useWidth } from "@/lib/charts/useWidth";
import { ema } from "@/lib/charts/ema";
import { adxSeries, priorHigh, rsiSeries, smaSeries } from "@/lib/charts/indicators";
import { compact, price } from "@/lib/format";

const BARS = 60; // completed days shown
const M = { left: 8, right: 66 };
const PANES = [
  { id: "price", h: 230 },
  { id: "volume", h: 84 },
  { id: "rsi", h: 74 },
  { id: "adx", h: 74 },
  { id: "rs", h: 96 },
] as const;
const HEAD = 30; // pane title row
const GAP = 10;

type Props = {
  market: MarketId;
  c: PulseCandidate;
  candles: Candle[]; // stock, completed days only
  index: Candle[]; // index, completed days only
  indexName: string;
  indexLive: number | null;
  tz: string;
};

/** Every condition of a breakout candidate drawn on its own chart, so it can be checked by eye. The last slot is
 *  today's live price, compared (as the screen does) with indicators from the last completed day. */
export function BreakoutChart({ market, c, candles, index, indexName, indexLive, tz }: Props) {
  const COLORS = useChartColors();
  const reduced = useReducedMotion();
  const [box, width] = useWidth<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const s = useMemo(() => {
    const close = candles.map((k) => k[4]), high = candles.map((k) => k[2]), low = candles.map((k) => k[3]), vol = candles.map((k) => k[5]);
    const e20 = ema(close, 20), rsi = rsiSeries(close), adx = adxSeries(high, low, close), avgVol = smaSeries(vol, 20), brk = priorHigh(high, 20);
    const from = Math.max(0, candles.length - BARS);
    // Relative strength: % change since 20 completed days before today, stock vs index (matched by date).
    const base = candles.length - 21;
    const idxByDay = new Map(index.map((k) => [k[0], k[4]]));
    const idxBase = base >= 0 ? idxByDay.get(candles[base][0]) : undefined;
    const rs = candles.map((k, i) => {
      if (i < base || base < 0) return null;
      const ix = idxByDay.get(k[0]);
      return { stock: k[4] / candles[base][4] - 1, index: ix != null && idxBase ? ix / idxBase - 1 : null };
    });
    const liveVol = c.rvol != null && avgVol[avgVol.length - 1] != null ? c.rvol * avgVol[avgVol.length - 1]! : null;
    return {
      from, close, e20, rsi, adx, avgVol, brk, rs, liveVol,
      liveRs: base >= 0 ? { stock: c.price / candles[base][4] - 1, index: indexLive != null && idxBase ? indexLive / idxBase - 1 : null } : null,
    };
  }, [candles, index, c, indexLive]);

  const n = candles.length - s.from; // completed bars shown
  const live = n; // x slot of today's live price
  const innerW = Math.max(0, width - M.left - M.right);
  const x = d3.scaleBand<number>().domain(d3.range(n + 1)).range([0, innerW]).padding(0.3);
  const cx = (i: number) => (x(i) ?? 0) + x.bandwidth() / 2;
  const bar = (i: number) => candles[s.from + i];
  const tops: number[] = [];
  PANES.reduce((y, p) => (tops.push(y), y + HEAD + p.h + GAP), 0);
  const H = tops[tops.length - 1] + HEAD + PANES[PANES.length - 1].h + 24;

  const vis = (arr: (number | null)[]) => arr.slice(s.from);
  const lows = candles.slice(s.from).map((k) => k[3]), highs = candles.slice(s.from).map((k) => k[2]);
  const yPrice = d3.scaleLinear()
    .domain(d3.extent([...lows, ...highs, c.price, c.breakout_level, ...(c.plan ? [c.plan.stop, c.plan.target] : []),
      ...vis(s.e20).filter((v): v is number => v != null)]) as [number, number])
    .nice().range([PANES[0].h, 0]);
  const vmax = d3.max([...candles.slice(s.from).map((k) => k[5]), s.liveVol ?? 0, ...vis(s.avgVol).map((v) => (v ?? 0) * 1.5)]) || 1;
  const yVol = d3.scaleLinear().domain([0, vmax]).range([PANES[1].h, 0]);
  const y100 = (h: number) => d3.scaleLinear().domain([0, 100]).range([h, 0]);
  const yRsi = y100(PANES[2].h), yAdx = d3.scaleLinear().domain([0, Math.max(50, d3.max(s.adx.slice(s.from)) ?? 50)]).range([PANES[3].h, 0]);
  const rsVals = s.rs.slice(s.from).flatMap((r) => (r ? [r.stock, r.index ?? 0] : []));
  const yRs = d3.scaleLinear().domain(d3.extent([0, ...rsVals, s.liveRs?.stock ?? 0, s.liveRs?.index ?? 0]) as [number, number]).nice().range([PANES[4].h, 0]);

  const path = (vals: (number | null)[], y: d3.ScaleLinear<number, number>, extra?: [number, number | null]) => {
    const pts: [number, number][] = [];
    vals.forEach((v, i) => v != null && pts.push([cx(i), y(v)]));
    if (extra && extra[1] != null) pts.push([cx(extra[0]), y(extra[1])]);
    return d3.line()(pts) ?? "";
  };
  const stepPath = (vals: (number | null)[], y: d3.ScaleLinear<number, number>, liveLevel: number) => {
    const pts: [number, number][] = [];
    vals.forEach((v, i) => v != null && pts.push([cx(i), y(v)]));
    pts.push([cx(live), y(liveLevel)]);
    return d3.line().curve(d3.curveStepAfter)(pts) ?? "";
  };

  // Lines draw in when the chart opens.
  useEffect(() => {
    if (!svg.current || width === 0) return;
    d3.select(svg.current).selectAll<SVGPathElement, unknown>("path.draw").each(function () {
      const len = this.getTotalLength();
      d3.select(this).attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len)
        .transition().duration(duration(900, reduced)).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0)
        .on("end", function () {
          d3.select(this).attr("stroke-dasharray", null);
        });
    });
  }, [width, reduced, candles.length]);

  const fmt = (v: number) => price(v, market);
  const date = (i: number) => new Date(bar(i)[0]).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
  const ticks = d3.range(0, n, Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 80)))));
  const lastAvgVol = s.avgVol[s.avgVol.length - 1];
  const lastAdx = s.adx[s.adx.length - 1], adx5 = s.adx[s.adx.length - 6];

  const head: Record<(typeof PANES)[number]["id"], { title: string; checks: PulseCheck[]; note: string }> = {
    price: { title: "Price, 20 EMA and the 20-day high", checks: ["above_ema20", "breakout"],
      note: `Live ${fmt(c.price)} vs 20 EMA ${fmt(c.ema20)} and 20-day high ${fmt(c.breakout_level)}${c.plan ? ` · plan: stop ${fmt(c.plan.stop)}, target ${fmt(c.plan.target)}` : ""}` },
    volume: { title: "Volume vs its 20-day average", checks: ["volume"],
      note: `Today so far ${c.rvol != null ? c.rvol.toFixed(1) : "—"}× the average (${compact(lastAvgVol, market)}); needs 1.5×` },
    rsi: { title: "RSI (14)", checks: ["rsi"], note: `Live ${c.rsi.toFixed(0)}; needs 60 or more` },
    adx: { title: "ADX (14): trend strength", checks: ["adx"],
      note: `${lastAdx.toFixed(0)} at the last close, ${adx5 != null ? (lastAdx > adx5 ? "up" : "down") + ` from ${adx5.toFixed(0)} five days earlier` : ""}; needs > 20 and rising` },
    rs: { title: `Change since 20 days ago: ${c.symbol} vs ${indexName}`, checks: ["relative_strength"],
      note: s.liveRs ? `${(s.liveRs.stock * 100).toFixed(1)}% vs ${s.liveRs.index != null ? (s.liveRs.index * 100).toFixed(1) + "%" : "—"}` : "" },
  };

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const [mx] = d3.pointer(e);
    const i = Math.round((mx - x.bandwidth() / 2) / x.step());
    setHover(i >= 0 && i < n ? i : null);
  }

  return (
    <div ref={box} className="relative w-full">
      {width > 0 && (
        <svg ref={svg} width={width} height={H} className="block max-w-full" style={{ fontFamily: FONT }} role="img"
          aria-label={`${c.symbol}: daily chart with 20 EMA, 20-day high, volume, RSI, ADX and relative strength`}>
          <g transform={`translate(${M.left},0)`}>
            {PANES.map((p, k) => {
              const top = tops[k] + HEAD;
              const h = head[p.id];
              return (
                <g key={p.id}>
                  <foreignObject x={0} y={tops[k]} width={innerW + M.right - 4} height={HEAD}>
                    <div className="flex h-full items-center gap-2 overflow-hidden text-[11px]">
                      {h.checks.map((ck) => (
                        <span key={ck} className={clsx("inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5", c.checks[ck] ? "bg-up-wash text-up" : "bg-wash text-ink-3")}>
                          {c.checks[ck] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        </span>
                      ))}
                      <span className="shrink-0 font-medium text-ink">{h.title}</span>
                      <span className="truncate text-ink-3">{h.note}</span>
                    </div>
                  </foreignObject>
                  <g transform={`translate(0,${top})`}>
                    <rect width={innerW} height={p.h} fill="none" stroke={COLORS.line} />
                    {/* live slot */}
                    <rect x={x(live)} width={x.bandwidth()} height={p.h} fill={COLORS.forecast} fillOpacity={0.06} />
                    {p.id === "price" && (
                      <>
                        {yPrice.ticks(4).map((t) => (
                          <text key={t} x={innerW + 6} y={yPrice(t)} dy="0.32em" fontSize={10} fill={COLORS.ink3}>{fmt(t)}</text>
                        ))}
                        {d3.range(n).map((i) => {
                          const [, o, hi, lo, cl] = bar(i);
                          const col = cl >= o ? COLORS.up : COLORS.down;
                          return (
                            <g key={i}>
                              <line x1={cx(i)} x2={cx(i)} y1={yPrice(hi)} y2={yPrice(lo)} stroke={col} />
                              <rect x={x(i)} width={x.bandwidth()} y={yPrice(Math.max(o, cl))} height={Math.max(1, Math.abs(yPrice(o) - yPrice(cl)))} fill={col} />
                            </g>
                          );
                        })}
                        {c.plan && ([["target", c.plan.target, COLORS.up], ["stop", c.plan.stop, COLORS.down]] as const).map(([label, v, col]) => (
                          <g key={label}>
                            <line x1={cx(Math.max(0, n - 15))} x2={innerW} y1={yPrice(v)} y2={yPrice(v)} stroke={col} strokeWidth={1.25} strokeDasharray="6 3" />
                            <text x={cx(Math.max(0, n - 15)) - 4} y={yPrice(v)} dy="0.32em" textAnchor="end" fontSize={10} fontWeight={600} fill={col}
                              paintOrder="stroke" stroke={COLORS.paper} strokeWidth={3}>{label} {fmt(v)}</text>
                          </g>
                        ))}
                        <path className="draw" d={stepPath(vis(s.brk), yPrice, c.breakout_level)} fill="none" stroke={COLORS.ema9} strokeWidth={1.5} strokeDasharray="5 3" />
                        <path className="draw" d={path(vis(s.e20), yPrice, [live, c.ema20])} fill="none" stroke={COLORS.ema50} strokeWidth={2} />
                        <circle cx={cx(live)} cy={yPrice(c.price)} r={6} fill={c.checks.breakout ? COLORS.up : COLORS.down} stroke={COLORS.paper} strokeWidth={2}>
                          {!reduced && <animate attributeName="r" values="5;8;5" dur="1.6s" repeatCount="indefinite" />}
                        </circle>
                        <text x={cx(live) - 8} y={yPrice(c.price) - 10} textAnchor="end" fontSize={10} fontWeight={600} fill={COLORS.ink}
                          paintOrder="stroke" stroke={COLORS.paper} strokeWidth={3}>live {fmt(c.price)}</text>
                        <Legend items={[["20 EMA", COLORS.ema50, false], ["20-day high (breakout level)", COLORS.ema9, true]]} y={p.h - 6} />
                      </>
                    )}
                    {p.id === "volume" && (
                      <>
                        {d3.range(n).map((i) => (
                          <rect key={i} x={x(i)} width={x.bandwidth()} y={yVol(bar(i)[5])} height={p.h - yVol(bar(i)[5])} fill={COLORS.volume} />
                        ))}
                        {s.liveVol != null && (
                          <rect x={x(live)} width={x.bandwidth()} y={yVol(s.liveVol)} height={p.h - yVol(s.liveVol)} fill={c.checks.volume ? COLORS.up : COLORS.ink3} fillOpacity={0.8} />
                        )}
                        <path className="draw" d={path(vis(s.avgVol), yVol, [live, lastAvgVol])} fill="none" stroke={COLORS.ink2} strokeWidth={1.5} />
                        <path d={path(vis(s.avgVol).map((v) => (v == null ? null : v * 1.5)), yVol, [live, lastAvgVol == null ? null : lastAvgVol * 1.5])}
                          fill="none" stroke={COLORS.ink2} strokeDasharray="4 3" />
                        <text x={innerW + 6} y={lastAvgVol != null ? yVol(lastAvgVol * 1.5) : 0} dy="0.32em" fontSize={10} fill={COLORS.ink3}>1.5× avg</text>
                      </>
                    )}
                    {p.id === "rsi" && (
                      <Osc vals={vis(s.rsi)} live={c.rsi} y={yRsi} w={innerW} lines={[[60, true], [30, false]]} path={path} liveX={live} cx={cx} color={COLORS.forecast} />
                    )}
                    {p.id === "adx" && (
                      <Osc vals={vis(s.adx)} live={null} y={yAdx} w={innerW} lines={[[20, true]]} path={path} liveX={live} cx={cx} color={COLORS.second} />
                    )}
                    {p.id === "rs" && (
                      <>
                        <line x2={innerW} y1={yRs(0)} y2={yRs(0)} stroke={COLORS.ink3} />
                        {yRs.ticks(3).map((t) => (
                          <text key={t} x={innerW + 6} y={yRs(t)} dy="0.32em" fontSize={10} fill={COLORS.ink3}>{(t * 100).toFixed(0)}%</text>
                        ))}
                        <path className="draw" d={path(s.rs.slice(s.from).map((r) => r?.index ?? null), yRs, [live, s.liveRs?.index ?? null])} fill="none" stroke={COLORS.ink3} strokeWidth={1.5} />
                        <path className="draw" d={path(s.rs.slice(s.from).map((r) => r?.stock ?? null), yRs, [live, s.liveRs?.stock ?? null])} fill="none" stroke={COLORS.forecast} strokeWidth={2} />
                        <Legend items={[[c.symbol, COLORS.forecast, false], [indexName, COLORS.ink3, false]]} y={p.h - 6} />
                      </>
                    )}
                    {hover != null && <line x1={cx(hover)} x2={cx(hover)} y2={p.h} stroke={COLORS.crosshair} strokeDasharray="3 3" pointerEvents="none" />}
                  </g>
                </g>
              );
            })}
            {ticks.map((i) => (
              <text key={i} x={cx(i)} y={H - 8} textAnchor="middle" fontSize={10} fill={COLORS.ink3}>{date(i)}</text>
            ))}
            <text x={cx(live)} y={H - 8} textAnchor="middle" fontSize={10} fontWeight={600} fill={COLORS.forecast}>live</text>
            <rect width={innerW} height={H - 20} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
          </g>
        </svg>
      )}
      {hover != null && (
        <div className="pointer-events-none absolute right-2 top-8 z-10 rounded-lg border border-line bg-paper px-3 py-2 text-xs shadow-sm">
          <p className="text-ink-3">{date(hover)}</p>
          <div className="tabular mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
            {([
              ["Close", fmt(bar(hover)[4])],
              ["20 EMA", s.e20[s.from + hover] != null ? fmt(s.e20[s.from + hover]!) : "—"],
              ["20-day high", s.brk[s.from + hover] != null ? fmt(s.brk[s.from + hover]!) : "—"],
              ["Volume", compact(bar(hover)[5], market)],
              ["RSI", s.rsi[s.from + hover]?.toFixed(0) ?? "—"],
              ["ADX", s.adx[s.from + hover].toFixed(0)],
            ] as const).map(([k, v]) => (
              <Fragment key={k}>
                <span className="text-ink-3">{k}</span>
                <span>{v}</span>
              </Fragment>
            ))}
          </div>
        </div>
      )}
      <p className="mt-1 text-[11px] text-ink-3">
        Daily candles up to the last close; the shaded column is today&apos;s live price, checked against the last close&apos;s 20 EMA, 20-day high,
        average volume and ADX, as the screen does. Times in {tz.replace("_", " ")}.
      </p>
    </div>
  );
}

function Osc({ vals, live, y, w, lines, path, liveX, cx, color }: {
  vals: (number | null)[];
  live: number | null;
  y: d3.ScaleLinear<number, number>;
  w: number;
  lines: [number, boolean][];
  path: (v: (number | null)[], y: d3.ScaleLinear<number, number>, extra?: [number, number | null]) => string;
  liveX: number;
  cx: (i: number) => number;
  color: string;
}) {
  const COLORS = useChartColors();
  return (
    <>
      {lines.map(([v, key]) => (
        <g key={v}>
          <line x2={w} y1={y(v)} y2={y(v)} stroke={key ? COLORS.ink2 : COLORS.line} strokeDasharray={key ? "4 3" : undefined} />
          <text x={w + 6} y={y(v)} dy="0.32em" fontSize={10} fill={key ? COLORS.ink2 : COLORS.ink3}>{v}</text>
        </g>
      ))}
      <path className="draw" d={path(vals, y, live != null ? [liveX, live] : undefined)} fill="none" stroke={color} strokeWidth={1.75} />
      {live != null && <circle cx={cx(liveX)} cy={y(live)} r={4} fill={color} stroke={COLORS.paper} strokeWidth={1.5} />}
    </>
  );
}

function Legend({ items, y }: { items: [string, string, boolean][]; y: number }) {
  const COLORS = useChartColors();
  let xPos = 8;
  return (
    <g transform={`translate(0,${y})`}>
      {items.map(([label, color, dashed]) => {
        const at = xPos;
        xPos += 26 + label.length * 5.6;
        return (
          <g key={label} transform={`translate(${at},0)`}>
            <line x2={16} y1={-3} y2={-3} stroke={color} strokeWidth={2} strokeDasharray={dashed ? "4 2" : undefined} />
            <text x={20} fontSize={10} fill={COLORS.ink2} paintOrder="stroke" stroke={COLORS.paper} strokeWidth={3}>{label}</text>
          </g>
        );
      })}
    </g>
  );
}
