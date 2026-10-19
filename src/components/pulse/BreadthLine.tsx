"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { useChartColors, FONT } from "@/lib/charts/theme";
import { duration, useReducedMotion } from "@/lib/charts/motion";
import { useWidth } from "@/lib/charts/useWidth";

const H = 300;
const M = { top: 10, right: 40, bottom: 22, left: 8 };

/** % of stocks above their 20 EMA through today's session, one point every ~3 minutes. */
export function BreadthLine({ points, tz }: { points: { t: number; above_ema20: number | null }[]; tz: string }) {
  const COLORS = useChartColors();
  const reduced = useReducedMotion();
  const [box, width] = useWidth<HTMLDivElement>();
  const path = useRef<SVGPathElement>(null);
  const data = points.filter((p): p is { t: number; above_ema20: number } => p.above_ema20 != null);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const x = useMemo(() => d3.scaleTime().domain(d3.extent(data, (d) => new Date(d.t)) as [Date, Date]).range([0, innerW]), [data, innerW]);
  const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);
  const line = d3.line<(typeof data)[number]>().x((d) => x(new Date(d.t))).y((d) => y(d.above_ema20)).curve(d3.curveMonotoneX);
  const area = d3.area<(typeof data)[number]>().x((d) => x(new Date(d.t))).y0(innerH).y1((d) => y(d.above_ema20)).curve(d3.curveMonotoneX);
  const last = data[data.length - 1];

  // Draw the line in on first render, then let each new point extend it.
  useEffect(() => {
    if (!path.current || data.length < 2) return;
    const len = path.current.getTotalLength();
    d3.select(path.current).attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len)
      .transition().duration(duration(900, reduced)).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0)
      .on("end", function () {
        d3.select(this).attr("stroke-dasharray", null);
      });
  }, [data.length, width, reduced]);

  return (
    <div ref={box} className="w-full" style={{ height: H }}>
      {width > 0 && data.length < 2 && (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
          {last && <p className="tabular text-3xl font-semibold tracking-tight">{Math.round(last.above_ema20 * 100)}%</p>}
          {last && <p className="text-xs text-ink-2">of stocks above their 20 EMA right now</p>}
          <p className="mt-2 max-w-sm text-xs text-ink-3">The line builds through the session, adding a point every 3 minutes while anyone has this page open.</p>
        </div>
      )}
      {width > 0 && data.length >= 2 && (
        <svg width={width} height={H} className="block max-w-full" role="img" style={{ fontFamily: FONT }}
          aria-label={`Share of stocks above their 20 EMA today, now ${Math.round(last.above_ema20 * 100)}%`}>
          <g transform={`translate(${M.left},${M.top})`}>
            {[0.3, 0.6].map((v) => (
              <g key={v}>
                <line x2={innerW} y1={y(v)} y2={y(v)} stroke={COLORS.line} strokeDasharray="3 3" />
                <text x={innerW + 6} y={y(v)} dy="0.32em" fontSize={10} fill={COLORS.ink3}>{v * 100}%</text>
              </g>
            ))}
            <path d={area(data) ?? ""} fill={COLORS.forecast} fillOpacity={0.1} />
            <path ref={path} d={line(data) ?? ""} fill="none" stroke={COLORS.forecast} strokeWidth={2} />
            <circle cx={x(new Date(last.t))} cy={y(last.above_ema20)} r={4} fill={COLORS.forecast} stroke={COLORS.paper} strokeWidth={2} />
            {x.ticks(Math.max(2, Math.floor(innerW / 90))).map((t) => (
              <text key={+t} x={x(t)} y={innerH + 16} textAnchor="middle" fontSize={10} fill={COLORS.ink3}>
                {t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz })}
              </text>
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}
