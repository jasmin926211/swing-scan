"use client";

import clsx from "clsx";
import type { Pulse } from "@/lib/api";

const ROW = 30;

/** Sectors ranked by their median move today. Rows glide to their new rank on each refresh. */
export function SectorBars({ sectors }: { sectors: Pulse["sectors"] }) {
  const shown = sectors.slice(0, 14);
  const order = [...shown].sort((a, b) => b.change_pct - a.change_pct);
  const max = Math.max(0.5, ...shown.map((s) => Math.abs(s.change_pct)));
  // Rendered in a fixed (alphabetical) order so React keeps each row's element; the rank only moves it.
  const stable = [...shown].sort((a, b) => a.sector.localeCompare(b.sector));
  return (
    <div className="relative" style={{ height: shown.length * ROW }} role="list" aria-label="Sectors by median change today">
      {stable.map((s) => {
        const rank = order.findIndex((o) => o.sector === s.sector);
        const w = (Math.abs(s.change_pct) / max) * 50;
        return (
          <div key={s.sector} role="listitem" className="absolute inset-x-0 flex items-center gap-2 text-xs transition-transform duration-700 ease-out motion-reduce:transition-none"
            style={{ transform: `translateY(${rank * ROW}px)`, height: ROW }}>
            <span className="w-32 shrink-0 truncate text-ink-2 sm:w-40" title={s.sector}>{s.sector}</span>
            <span className="relative h-3 flex-1">
              <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
              <span
                className={clsx("absolute inset-y-0 rounded-sm transition-all duration-700 ease-out motion-reduce:transition-none", s.change_pct >= 0 ? "bg-up" : "bg-down")}
                style={s.change_pct >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
              />
            </span>
            <span className={clsx("tabular w-14 shrink-0 text-right", s.change_pct >= 0 ? "text-up" : "text-down")}>
              {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
            </span>
            <span className="tabular hidden w-16 shrink-0 text-right text-ink-3 sm:inline" title="Share of the sector's stocks above their 20 EMA">
              {s.above_ema20 != null ? `${Math.round(s.above_ema20 * 100)}% ↑20` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
