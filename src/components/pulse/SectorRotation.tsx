"use client";

import { useState } from "react";
import * as d3 from "d3";
import type { Pulse } from "@/lib/api";
import { FONT, useChartColors } from "@/lib/charts/theme";
import { useWidth } from "@/lib/charts/useWidth";

const H = 360;
const M = { top: 16, right: 16, bottom: 40, left: 52 };
const QUADRANTS = [
  { name: "Leading", note: "up over the month and the week", x: 1, y: 1 },
  { name: "Weakening", note: "up over the month, down this week", x: 1, y: -1 },
  { name: "Lagging", note: "down over the month and the week", x: -1, y: -1 },
  { name: "Improving", note: "down over the month, up this week", x: -1, y: 1 },
] as const;

type Sector = Pulse["sectors"][number];
const pct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

/** Sectors by their median move over the last month (x) against the last week (y): which are gaining or losing strength. */
export function SectorRotation({ sectors }: { sectors: Sector[] }) {
  const COLORS = useChartColors();
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const data = sectors.filter((s): s is Sector & { week: number; month: number } => s.week != null && s.month != null);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  if (data.length === 0)
    return <p className="py-10 text-center text-sm text-ink-3">Available after tonight&apos;s scan (it adds each stock&apos;s price a week ago).</p>;
  const mx = Math.max(0.02, ...data.map((d) => Math.abs(d.month))) * 1.15;
  const my = Math.max(0.01, ...data.map((d) => Math.abs(d.week))) * 1.15;
  const x = d3.scaleLinear().domain([-mx, mx]).range([0, innerW]);
  const y = d3.scaleLinear().domain([-my, my]).range([innerH, 0]);
  const r = d3.scaleSqrt().domain([0, d3.max(data, (d) => d.turnover) || 1]).range([4, 16]);

  return (
    <div ref={box} className="relative w-full" style={{ height: H }}>
      {width > 0 && (
        <svg width={width} height={H} className="block max-w-full" style={{ fontFamily: FONT }} role="img"
          aria-label="Sector rotation: one-month move against one-week move">
          <g transform={`translate(${M.left},${M.top})`}>
            {QUADRANTS.map((q) => (
              <g key={q.name}>
                <rect x={q.x > 0 ? x(0) : 0} y={q.y > 0 ? 0 : y(0)} width={innerW / 2} height={innerH / 2}
                  fill={q.name === "Leading" ? COLORS.up : q.name === "Lagging" ? COLORS.down : COLORS.wash}
                  fillOpacity={q.name === "Leading" || q.name === "Lagging" ? 0.06 : 1} />
                <text x={q.x > 0 ? innerW - 6 : 6} y={q.y > 0 ? 14 : innerH - 6} textAnchor={q.x > 0 ? "end" : "start"} fontSize={11}
                  fontWeight={600} fill={COLORS.ink3}>{q.name}</text>
              </g>
            ))}
            <line x1={x(0)} x2={x(0)} y1={0} y2={innerH} stroke={COLORS.ink3} strokeDasharray="3 3" />
            <line x1={0} x2={innerW} y1={y(0)} y2={y(0)} stroke={COLORS.ink3} strokeDasharray="3 3" />
            {x.ticks(5).map((t) => (
              <text key={`x${t}`} x={x(t)} y={innerH + 16} textAnchor="middle" fontSize={10} fill={COLORS.ink3}>{pct(t)}</text>
            ))}
            {y.ticks(5).map((t) => (
              <text key={`y${t}`} x={-8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={COLORS.ink3}>{pct(t)}</text>
            ))}
            <text x={innerW / 2} y={innerH + 34} textAnchor="middle" fontSize={11} fill={COLORS.ink2}>Last month (median move) →</text>
            <text transform={`translate(${-42},${innerH / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={COLORS.ink2}>This week →</text>
            {data.map((d) => {
              const on = hover === d.sector;
              return (
                <g key={d.sector} transform={`translate(${x(d.month)},${y(d.week)})`} onMouseEnter={() => setHover(d.sector)} onMouseLeave={() => setHover(null)}>
                  <circle r={r(d.turnover)} fill={d.week >= 0 ? COLORS.up : COLORS.down} fillOpacity={on ? 0.9 : 0.55} stroke={COLORS.paper} strokeWidth={2} />
                  <text y={-r(d.turnover) - 4} textAnchor="middle" fontSize={10} fill={on ? COLORS.ink : COLORS.ink2} fontWeight={on ? 600 : 400}
                    paintOrder="stroke" stroke={COLORS.paper} strokeWidth={3}>
                    {on ? `${d.sector}: month ${pct(d.month)}, week ${pct(d.week)}` : d.sector.split(/[ ,&]/)[0]}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
