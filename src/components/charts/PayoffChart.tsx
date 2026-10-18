"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Idea, MarketId } from "@/lib/api";
import { money, price } from "@/lib/format";
import { COLORS, FONT } from "@/lib/charts/theme";
import { duration, useReducedMotion } from "@/lib/charts/motion";
import { useWidth } from "@/lib/charts/useWidth";

const M = { top: 10, right: 16, bottom: 26, left: 70 };
const PAYOFF_H = 190;
const GAP = 22;
const DIST_H = 90;
const HEIGHT = M.top + PAYOFF_H + GAP + DIST_H + M.bottom;
const BINS = 24;

/** P&L per lot at expiry for one idea (top), over the AI's distribution of prices at expiry (bottom).
 *  Two panels share the price axis; each keeps its own y-axis (no dual axis on one plot). */
export function PayoffChart({ idea, finalPrices, spot, lotSize, market }: {
  idea: Idea; finalPrices: number[]; spot: number; lotSize: number; market: MarketId;
}) {
  const [box, width] = useWidth<HTMLDivElement>();
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const lineRef = useRef<SVGPathElement>(null);
  const histRef = useRef<SVGGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const innerW = Math.max(0, width - M.left - M.right);

  const strikes = idea.legs.map((l) => l.strike);
  const x = useMemo(() => {
    const lo = Math.min(d3.min(finalPrices) ?? spot, spot * 0.9, ...strikes);
    const hi = Math.max(d3.max(finalPrices) ?? spot, spot * 1.1, ...strikes);
    const pad = (hi - lo) * 0.08;
    return d3.scaleLinear().domain([lo - pad, hi + pad]).range([0, innerW]);
  }, [finalPrices, spot, strikes.join(","), innerW]);

  const payoff = (s: number) =>
    lotSize *
    idea.legs.reduce((sum, l) => {
      const v = l.kind === "FUT" ? s - l.strike : l.kind === "CE" ? Math.max(s - l.strike, 0) - l.price : Math.max(l.strike - s, 0) - l.price;
      return sum + (l.side === "BUY" ? v : -v);
    }, 0);

  const curve = useMemo(() => {
    const [a, b] = x.domain();
    const pts = d3.range(0, 241).map((k) => a + ((b - a) * k) / 240);
    return [...new Set([...pts, ...strikes])].sort((p, q) => p - q).map((s) => [s, payoff(s)] as [number, number]);
  }, [x, idea]);

  const y = useMemo(() => {
    const [mn, mx] = d3.extent(curve, (p) => p[1]) as [number, number];
    const pad = (mx - mn) * 0.12 || Math.abs(mx) * 0.2 || 1;
    return d3.scaleLinear().domain([Math.min(mn - pad, 0), Math.max(mx + pad, 0)]).nice(5).range([PAYOFF_H, 0]);
  }, [curve]);

  const bins = useMemo(() => d3.bin().domain(x.domain() as [number, number]).thresholds(BINS)(finalPrices), [x, finalPrices]);
  const yHist = useMemo(() => d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length) || 1]).range([DIST_H, 0]), [bins]);

  const line = d3.line<[number, number]>().x((p) => x(p[0])).y((p) => y(p[1]))(curve) ?? "";
  const areaAbove = d3.area<[number, number]>().x((p) => x(p[0])).y0(y(0)).y1((p) => y(Math.max(p[1], 0)))(curve) ?? "";
  const areaBelow = d3.area<[number, number]>().x((p) => x(p[0])).y0(y(0)).y1((p) => y(Math.min(p[1], 0)))(curve) ?? "";
  const distTop = M.top + PAYOFF_H + GAP;

  // The payoff line draws in and the histogram grows whenever a different idea is shown.
  useEffect(() => {
    if (!lineRef.current || width === 0) return;
    const len = lineRef.current.getTotalLength();
    d3.select(lineRef.current)
      .attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len)
      .transition().duration(duration(800, reduced)).ease(d3.easeCubicInOut).attr("stroke-dashoffset", 0)
      .on("end", function () {
        d3.select(this).attr("stroke-dasharray", null);
      });
    if (histRef.current)
      d3.select(histRef.current).selectAll<SVGRectElement, unknown>("rect")
        .attr("transform", `translate(0,${DIST_H}) scale(1,0)`)
        .transition().delay((_, i) => duration(i * 15, reduced)).duration(duration(450, reduced))
        .attr("transform", "translate(0,0) scale(1,1)");
  }, [idea, width, reduced]);

  const hx = hoverX != null ? x.invert(hoverX) : null;
  const hp = hx != null ? payoff(hx) : null;
  const share = hx != null ? finalPrices.filter((p) => p <= hx).length / Math.max(1, finalPrices.length) : null;

  return (
    <div ref={box} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={HEIGHT} style={{ fontFamily: FONT }} role="img"
          aria-label={`Profit and loss at expiry per lot for ${idea.name}, above the AI's distribution of prices at expiry`}>
          <defs>
            <clipPath id={`clip-${uid}`}><rect width={innerW} height={PAYOFF_H} /></clipPath>
          </defs>
          <g transform={`translate(${M.left},${M.top})`}>
            {y.ticks(5).map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x2={innerW} stroke={t === 0 ? COLORS.ink3 : COLORS.line} />
                <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={COLORS.ink3} className="tabular">
                  {money(t, market)}
                </text>
              </g>
            ))}
            <g clipPath={`url(#clip-${uid})`}>
              <path d={areaAbove} fill={COLORS.up} fillOpacity={0.14} />
              <path d={areaBelow} fill={COLORS.down} fillOpacity={0.12} />
              <path ref={lineRef} d={line} fill="none" stroke={COLORS.ink} strokeWidth={2} />
            </g>
            {idea.breakevens.map((b) => (
              <g key={b} transform={`translate(${x(b)},0)`}>
                <line y1={0} y2={PAYOFF_H} stroke={COLORS.ink3} strokeDasharray="2 3" />
                <text y={PAYOFF_H - 4} x={4} fontSize={10} fill={COLORS.ink2}>breakeven {price(b, market)}</text>
              </g>
            ))}
            <text x={0} y={-1} fontSize={10} fill={COLORS.ink3}>P&amp;L per lot at expiry</text>
          </g>

          <g transform={`translate(${M.left},${distTop})`}>
            <g ref={histRef}>
              {bins.map((b, i) => (
                <rect key={i} x={x(b.x0!) + 1} width={Math.max(0, x(b.x1!) - x(b.x0!) - 2)} y={yHist(b.length)} height={DIST_H - yHist(b.length)} rx={2}
                  fill={COLORS.forecast} fillOpacity={0.55} />
              ))}
            </g>
            <line x2={innerW} y1={DIST_H} y2={DIST_H} stroke={COLORS.line} />
            <text x={-8} y={4} textAnchor="end" fontSize={10} fill={COLORS.ink3}>AI paths</text>
            {x.ticks(6).map((t) => (
              <text key={t} x={x(t)} y={DIST_H + 17} textAnchor="middle" fontSize={11} fill={COLORS.ink3} className="tabular">
                {price(t, market)}
              </text>
            ))}
          </g>

          {/* spot line across both panels */}
          <g transform={`translate(${M.left + x(spot)},${M.top})`} pointerEvents="none">
            <line y1={0} y2={PAYOFF_H + GAP + DIST_H} stroke={COLORS.ink} strokeDasharray="4 3" />
            <text x={4} y={10} fontSize={10} fill={COLORS.ink}>spot</text>
          </g>

          {hoverX != null && (
            <line x1={M.left + hoverX} x2={M.left + hoverX} y1={M.top} y2={distTop + DIST_H} stroke="#c9c9c4" strokeDasharray="3 3" pointerEvents="none" />
          )}
          <rect x={M.left} y={M.top} width={innerW} height={PAYOFF_H + GAP + DIST_H} fill="transparent"
            onMouseMove={(e) => setHoverX(d3.pointer(e)[0] - M.left)} onMouseLeave={() => setHoverX(null)} />
        </svg>
      )}
      {hx != null && hp != null && share != null && hoverX != null && (
        <div className="pointer-events-none absolute top-2 z-10 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-sm"
          style={hoverX > innerW / 2 ? { right: width - (M.left + hoverX) + 12 } : { left: M.left + hoverX + 12 }}>
          <p className="text-ink-3">If it expires at {price(hx, market)}</p>
          <p className={`tabular font-semibold ${hp >= 0 ? "text-up" : "text-down"}`}>{money(hp, market)} per lot</p>
          <p className="tabular mt-0.5 text-ink-3">{Math.round(share * 100)}% of AI paths end at or below this</p>
        </div>
      )}
    </div>
  );
}
