"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import type { MarketId, Pulse } from "@/lib/api";
import { useChartColors, FONT } from "@/lib/charts/theme";
import { duration, useReducedMotion } from "@/lib/charts/motion";
import { useWidth } from "@/lib/charts/useWidth";
import { compact } from "@/lib/format";

const H = 360;
const M = { top: 12, right: 16, bottom: 34, left: 44 };

/** The most traded stocks today: price move (x) against relative volume (y), bubble size = value traded.
 *  Top-right = rising on heavy volume; bottom = moves on light volume (more likely to fade). */
export function Bubbles({ data, market }: { data: Pulse["bubbles"]; market: MarketId }) {
  const COLORS = useChartColors();
  const reduced = useReducedMotion();
  const router = useRouter();
  const [box, width] = useWidth<HTMLDivElement>();
  const g = useRef<SVGGElement>(null);
  const [hover, setHover] = useState<(Pulse["bubbles"][number] & { x: number; y: number }) | null>(null);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;

  const lim = useMemo(() => Math.min(10, Math.max(2, d3.quantile(data.map((d) => Math.abs(d.change_pct)).sort(d3.ascending), 0.97) ?? 3)), [data]);
  const x = d3.scaleLinear().domain([-lim, lim]).range([0, innerW]).clamp(true);
  // Up to the busiest stock (capped at 50×, beyond which a bubble sits on the top edge).
  const top = Math.min(50, Math.max(8, (d3.max(data, (d) => d.rvol) ?? 8) * 1.2));
  const y = d3.scaleLog().domain([0.2, top]).range([innerH, 0]).clamp(true);
  const r = d3.scaleSqrt().domain([0, d3.max(data, (d) => d.turnover) || 1]).range([3, 22]);

  // Bubbles glide to their new place on each refresh (keyed by symbol); new ones grow in.
  useEffect(() => {
    if (!g.current || innerW === 0) return;
    const sel = d3.select(g.current).selectAll<SVGCircleElement, Pulse["bubbles"][number]>("circle").data(data, (d) => d.symbol);
    sel.exit().transition().duration(duration(400, reduced)).attr("r", 0).remove();
    const enter = sel.enter().append("circle").attr("r", 0).attr("cx", (d) => x(d.change_pct)).attr("cy", (d) => y(Math.max(0.2, d.rvol)));
    enter.merge(sel)
      .attr("fill", (d) => (d.change_pct >= 0 ? COLORS.up : COLORS.down))
      .attr("fill-opacity", 0.55).attr("stroke", COLORS.paper).attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mousemove", (e, d) => {
        const [mx, my] = d3.pointer(e, box.current);
        setHover({ ...d, x: mx, y: my });
      })
      .on("mouseleave", () => setHover(null))
      .on("click", (_, d) => router.push(`/stock/${market}/${encodeURIComponent(d.symbol)}`))
      .transition().duration(duration(900, reduced)).ease(d3.easeCubicInOut)
      .attr("cx", (d) => x(d.change_pct)).attr("cy", (d) => y(Math.max(0.2, d.rvol))).attr("r", (d) => r(d.turnover));
  }, [data, innerW, reduced, COLORS, market]);

  return (
    <div ref={box} className="relative w-full" style={{ height: H }}>
      {width > 0 && (
        <svg width={width} height={H} className="block max-w-full" style={{ fontFamily: FONT }} role="img"
          aria-label="Bubble chart of today's most traded stocks: price change against relative volume">
          <g transform={`translate(${M.left},${M.top})`}>
            {[0.5, 1, 1.5, 3, 6, 12, 25, 50].filter((v) => v <= top).map((v) => (
              <g key={v}>
                <line x2={innerW} y1={y(v)} y2={y(v)} stroke={v === 1.5 ? COLORS.ink3 : COLORS.line} strokeDasharray={v === 1.5 ? "4 3" : undefined} />
                <text x={-8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={10} fill={COLORS.ink3}>{v}×</text>
              </g>
            ))}
            <text x={innerW} y={y(1.5) - 5} textAnchor="end" fontSize={10} fill={COLORS.ink2}>1.5× usual volume</text>
            <line x1={x(0)} x2={x(0)} y2={innerH} stroke={COLORS.ink3} />
            {x.ticks(6).map((t) => (
              <text key={t} x={x(t)} y={innerH + 16} textAnchor="middle" fontSize={10} fill={COLORS.ink3}>{t > 0 ? "+" : ""}{t}%</text>
            ))}
            <text x={innerW / 2} y={innerH + 30} textAnchor="middle" fontSize={10} fill={COLORS.ink3}>change today →</text>
            <g ref={g} />
          </g>
        </svg>
      )}
      {hover && (
        <div className="pointer-events-none absolute z-10 rounded-lg border border-line bg-paper px-3 py-2 text-xs shadow-sm"
          style={{ left: Math.min(hover.x + 12, width - 190), top: Math.max(0, hover.y - 70) }}>
          <p className="font-semibold">{hover.symbol}</p>
          {hover.sector && <p className="text-ink-3">{hover.sector}</p>}
          <p className="tabular mt-1">
            <span className={hover.change_pct >= 0 ? "text-up" : "text-down"}>{hover.change_pct >= 0 ? "+" : ""}{hover.change_pct.toFixed(2)}%</span>
            {" · "}{hover.rvol.toFixed(1)}× usual volume · {compact(hover.turnover, market)} traded
          </p>
        </div>
      )}
    </div>
  );
}
