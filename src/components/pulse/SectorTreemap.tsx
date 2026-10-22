"use client";

import { useState } from "react";
import * as d3 from "d3";
import type { MarketId, Pulse } from "@/lib/api";
import { FONT, useDiverging } from "@/lib/charts/theme";
import { useWidth } from "@/lib/charts/useWidth";
import { compact } from "@/lib/format";

const H = 340;
const LIMIT = 3; // % change at which a tile reaches full colour

type Sector = Pulse["sectors"][number];

/** Every sector as a tile sized by value traded today and coloured by its median move: where the market is, at a glance. */
export function SectorTreemap({ sectors, market }: { sectors: Sector[]; market: MarketId }) {
  const ramp = useDiverging().market;
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<(Sector & { x: number; y: number }) | null>(null);
  const colour = d3.scaleQuantize<string>().domain([-LIMIT, LIMIT]).range(ramp);
  const data = sectors.filter((s) => s.turnover > 0);
  const root = d3.hierarchy<{ children?: Sector[] } | Sector>({ children: data }).sum((d) => ("turnover" in d ? d.turnover : 0));
  const tiles = width > 0 ? d3.treemap<{ children?: Sector[] } | Sector>().size([width, H]).paddingInner(2).round(true)(root).leaves() : [];

  return (
    <div>
    <div ref={box} className="relative w-full" style={{ height: H }}>
      {width > 0 && (
        <svg width={width} height={H} className="block max-w-full" style={{ fontFamily: FONT }} role="img"
          aria-label="Sectors sized by value traded today and coloured by their median move">
          {tiles.map((t) => {
            const s = t.data as Sector;
            const w = t.x1 - t.x0, h = t.y1 - t.y0;
            const dark = Math.abs(s.change_pct) >= LIMIT * 0.45;
            return (
              <g key={s.sector} transform={`translate(${t.x0},${t.y0})`}
                onMouseMove={(e) => {
                  const r = box.current!.getBoundingClientRect();
                  setHover({ ...s, x: e.clientX - r.left, y: e.clientY - r.top });
                }}
                onMouseLeave={() => setHover(null)}>
                <rect width={w} height={h} rx={4} fill={colour(s.change_pct)} />
                {w > 70 && h > 34 && (
                  <>
                    <text x={8} y={18} fontSize={12} fontWeight={600} fill={dark ? "#ffffff" : "currentColor"} className={dark ? "" : "text-ink"}>
                      {s.sector.length * 7 > w - 10 ? `${s.sector.slice(0, Math.max(3, Math.floor((w - 16) / 7)))}…` : s.sector}
                    </text>
                    <text x={8} y={34} fontSize={11} fill={dark ? "#ffffff" : "currentColor"} className={dark ? "" : "text-ink-2"}>
                      {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover && (
        <div className="pointer-events-none absolute z-10 rounded-lg border border-line bg-paper px-3 py-2 text-xs shadow-sm"
          style={{ left: Math.min(hover.x + 12, width - 210), top: Math.max(0, hover.y - 70) }}>
          <p className="font-medium text-ink">{hover.sector}</p>
          <p className="tabular text-ink-2">
            Today {hover.change_pct >= 0 ? "+" : ""}{hover.change_pct.toFixed(2)}% (median of {hover.stocks} stocks)
          </p>
          <p className="tabular text-ink-3">Traded {compact(hover.turnover, market)} · {hover.above_ema20 != null ? `${Math.round(hover.above_ema20 * 100)}% above 20 EMA` : ""}</p>
        </div>
      )}
    </div>
    <Legend ramp={ramp} />
    </div>
  );
}

function Legend({ ramp }: { ramp: string[] }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-3">
      <span>−{LIMIT}%</span>
      <span className="flex h-2 w-40 overflow-hidden rounded-full">
        {ramp.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
      </span>
      <span>+{LIMIT}%</span>
      <span className="ml-2">Tile size = value traded today</span>
    </div>
  );
}
