"use client";

import { useState } from "react";
import * as d3 from "d3";
import type { Pulse } from "@/lib/api";
import { FONT, useChartColors } from "@/lib/charts/theme";
import { useWidth } from "@/lib/charts/useWidth";

const H = 220;
const M = { top: 18, right: 8, bottom: 30, left: 8 };

type Bin = Pulse["histogram"][number];

function label(b: Bin) {
  if (b.from == null) return `below ${b.to}%`;
  if (b.to == null) return `above +${b.from}%`;
  return `${b.from > 0 ? "+" : ""}${b.from} to ${b.to > 0 ? "+" : ""}${b.to}%`;
}

/** How many stocks moved by how much today: the shape of the day in one chart. */
export function MoveHistogram({ bins }: { bins: Bin[] }) {
  const COLORS = useChartColors();
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const x = d3.scaleBand<number>().domain(bins.map((_, i) => i)).range([0, innerW]).padding(0.12);
  const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.count) || 1]).range([innerH, 0]);
  const total = d3.sum(bins, (b) => b.count) || 1;

  return (
    <div ref={box} className="w-full" style={{ height: H }}>
      {width > 0 && (
        <svg width={width} height={H} className="block max-w-full" style={{ fontFamily: FONT }} role="img"
          aria-label="Histogram of today's moves across liquid stocks">
          <g transform={`translate(${M.left},${M.top})`}>
            {bins.map((b, i) => {
              const up = b.from != null && b.from >= 0;
              const h = innerH - y(b.count);
              return (
                <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={x(i)} y={0} width={x.bandwidth()} height={innerH} fill="transparent" />
                  <rect x={x(i)} y={y(b.count)} width={x.bandwidth()} height={Math.max(0, h)} rx={3}
                    fill={up ? COLORS.up : COLORS.down} fillOpacity={hover == null || hover === i ? 0.85 : 0.35} />
                  {(hover === i || b.count / total >= 0.08) && (
                    <text x={(x(i) ?? 0) + x.bandwidth() / 2} y={y(b.count) - 5} textAnchor="middle" fontSize={11} fill={COLORS.ink2} className="tabular">
                      {b.count}
                    </text>
                  )}
                  <text x={(x(i) ?? 0) + x.bandwidth() / 2} y={innerH + 16} textAnchor="middle" fontSize={10} fill={COLORS.ink3}>
                    {b.from == null ? `<${b.to}` : b.to == null ? `>${b.from}` : b.from >= 0 ? `+${b.from}` : `${b.from}`}
                  </text>
                </g>
              );
            })}
            <line x1={(x(bins.findIndex((b) => b.from === 0)) ?? 0) - 2} x2={(x(bins.findIndex((b) => b.from === 0)) ?? 0) - 2}
              y1={-6} y2={innerH} stroke={COLORS.ink3} strokeDasharray="3 3" />
          </g>
        </svg>
      )}
      <p className="h-4 text-center text-[11px] text-ink-3">
        {hover != null ? `${bins[hover].count} stocks (${Math.round((bins[hover].count / total) * 100)}%) moved ${label(bins[hover])} today` : "% change today · hover a bar"}
      </p>
    </div>
  );
}
