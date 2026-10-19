"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import type { MarketId, PulseLeader } from "@/lib/api";
import { useChartColors, FONT } from "@/lib/charts/theme";
import { duration, useReducedMotion } from "@/lib/charts/motion";
import { useWidth } from "@/lib/charts/useWidth";
import { compact } from "@/lib/format";

const H = 380;
const M = { top: 14, right: 16, bottom: 36, left: 46 };
const FLOOR = -0.6; // distances below this are drawn on the bottom edge

/** Every liquid stock: momentum rating (x, 1-99) against distance from its 52-week high (y). The shaded top-right
 *  corner is the leaders zone: strong momentum and still close to the highs. */
export function LeadersMap({ data, zone, market }: { data: PulseLeader[]; zone: { rating: number; from_high: number }; market: MarketId }) {
  const COLORS = useChartColors();
  const reduced = useReducedMotion();
  const router = useRouter();
  const [box, width] = useWidth<HTMLDivElement>();
  const g = useRef<SVGGElement>(null);
  const [hover, setHover] = useState<(PulseLeader & { x: number; y: number }) | null>(null);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const x = d3.scaleLinear().domain([1, 99]).range([0, innerW]);
  const y = d3.scaleLinear().domain([FLOOR, 0]).range([innerH, 0]).clamp(true);
  const r = d3.scaleSqrt().domain([0, d3.max(data, (d) => d.turnover) || 1]).range([2, 12]);

  useEffect(() => {
    if (!g.current || innerW === 0) return;
    const inZone = (d: PulseLeader) => d.rating >= zone.rating && d.from_high >= zone.from_high;
    const sel = d3.select(g.current).selectAll<SVGCircleElement, PulseLeader>("circle").data(data, (d) => d.symbol);
    sel.exit().transition().duration(duration(400, reduced)).attr("r", 0).remove();
    sel.enter().append("circle").attr("r", 0).attr("cx", (d) => x(d.rating)).attr("cy", (d) => y(Math.max(FLOOR, d.from_high)))
      .merge(sel)
      .attr("fill", (d) => (d.above_200dma ? COLORS.up : COLORS.down))
      .attr("fill-opacity", (d) => (inZone(d) ? 0.85 : 0.3))
      .attr("stroke", (d) => (inZone(d) ? COLORS.ink : "none")).attr("stroke-width", 0.75)
      .style("cursor", "pointer")
      .on("mousemove", (e, d) => {
        const [mx, my] = d3.pointer(e, box.current);
        setHover({ ...d, x: mx, y: my });
      })
      .on("mouseleave", () => setHover(null))
      .on("click", (_, d) => router.push(`/stock/${market}/${encodeURIComponent(d.symbol)}`))
      .transition().duration(duration(900, reduced)).ease(d3.easeCubicInOut)
      .attr("cx", (d) => x(d.rating)).attr("cy", (d) => y(Math.max(FLOOR, d.from_high))).attr("r", (d) => r(d.turnover));
  }, [data, innerW, reduced, COLORS, market, zone]);

  return (
    <div ref={box} className="relative w-full" style={{ height: H }}>
      {width > 0 && (
        <svg width={width} height={H} className="block max-w-full" style={{ fontFamily: FONT }} role="img"
          aria-label="Scatter of liquid stocks: momentum rating against distance from the 52-week high">
          <g transform={`translate(${M.left},${M.top})`}>
            <rect x={x(zone.rating)} y={0} width={innerW - x(zone.rating)} height={y(zone.from_high)} fill={COLORS.up} fillOpacity={0.08}
              stroke={COLORS.up} strokeOpacity={0.5} strokeDasharray="4 3" />
            <text x={innerW - 6} y={14} textAnchor="end" fontSize={11} fontWeight={600} fill={COLORS.up}>Leaders zone</text>
            {[0, -0.1, -0.25, -0.4, -0.6].map((v) => (
              <g key={v}>
                <line x2={innerW} y1={y(v)} y2={y(v)} stroke={COLORS.line} />
                <text x={-8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={10} fill={COLORS.ink3}>{v === 0 ? "at high" : `${v * 100}%`}</text>
              </g>
            ))}
            {[1, 20, 40, 60, 80, 99].map((v) => (
              <text key={v} x={x(v)} y={innerH + 16} textAnchor="middle" fontSize={10} fill={COLORS.ink3}>{v}</text>
            ))}
            <text x={innerW / 2} y={innerH + 31} textAnchor="middle" fontSize={10} fill={COLORS.ink3}>momentum rating (vs all liquid stocks) →</text>
            <g ref={g} />
          </g>
        </svg>
      )}
      {hover && (
        <div className="pointer-events-none absolute z-10 rounded-lg border border-line bg-paper px-3 py-2 text-xs shadow-sm"
          style={{ left: Math.min(hover.x + 12, width - 200), top: Math.max(0, hover.y - 76) }}>
          <p className="font-semibold">{hover.symbol}</p>
          {hover.sector && <p className="text-ink-3">{hover.sector}</p>}
          <p className="tabular mt-1">
            Momentum {hover.rating} · {(hover.from_high * 100).toFixed(1)}% from 52-week high
          </p>
          <p className="tabular text-ink-3">
            {hover.above_200dma ? "Above" : "Below"} its 200-day average · {compact(hover.turnover, market)} traded today
          </p>
        </div>
      )}
    </div>
  );
}
