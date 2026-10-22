"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import * as d3 from "d3";
import type { MarketId, Pulse, PulseStock } from "@/lib/api";
import { price } from "@/lib/format";
import { StockLogo } from "@/components/StockLogo";
import { FONT, useChartColors } from "@/lib/charts/theme";
import { useWidth } from "@/lib/charts/useWidth";

const H = 220;
const M = { top: 18, right: 8, bottom: 30, left: 8 };
const LIST = 40; // stocks listed for a bar, most traded first (each band from the server carries its 40 most traded)

type Bin = Pulse["histogram"][number];
export type MoveMode = "bands" | "atleast";
/** One bar: a band ("+2 to +3%"), or in "at least" mode a threshold ("+2% or more") covering every band past it. */
type Bar = { key: string; tick: string; label: string; up: boolean; count: number; stocks: PulseStock[] };

const signed = (v: number) => `${v > 0 ? "+" : ""}${v}`;

function bandBars(bins: Bin[]): Bar[] {
  return bins.map((b, i) => ({
    key: String(i),
    tick: b.from == null ? `<${b.to}` : b.to == null ? `>${b.from}` : signed(b.from),
    label: b.from == null ? `below ${b.to}%` : b.to == null ? `above +${b.from}%` : `${signed(b.from)} to ${signed(b.to)}%`,
    up: b.from != null && b.from >= 0,
    count: b.count,
    stocks: b.stocks ?? [],
  }));
}

/** Cumulative bars: on the down side "-2% or worse" sums every band at or below -2%; on the up side "+2% or more" sums
 *  every band at or above +2%. The 40 most traded of the merged bands are exactly the 40 most traded overall, since
 *  each band already sends its own 40 most traded. */
function atLeastBars(bins: Bin[]): Bar[] {
  const merge = (picked: Bin[]): PulseStock[] =>
    picked.flatMap((b) => b.stocks ?? []).sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0)).slice(0, LIST);
  const down = bins.filter((b) => b.to != null && b.to <= 0).map((b) => b.to as number); // -5, -4, ..., 0
  const up = bins.filter((b) => b.from != null && b.from >= 0).map((b) => b.from as number); // 0, 1, ..., 5
  const bars: Bar[] = down.map((edge) => {
    const picked = bins.filter((b) => b.to != null && b.to <= edge);
    return {
      key: `d${edge}`, tick: edge === 0 ? "<0" : `≤${edge}`, up: false,
      label: edge === 0 ? "down (below 0%)" : `${edge}% or worse`,
      count: d3.sum(picked, (b) => b.count), stocks: merge(picked),
    };
  });
  return bars.concat(up.map((edge) => {
    const picked = bins.filter((b) => b.from != null && b.from >= edge);
    return {
      key: `u${edge}`, tick: edge === 0 ? "≥0" : `≥${signed(edge)}`, up: true,
      label: edge === 0 ? "flat or up (0% or more)" : `${signed(edge)}% or more`,
      count: d3.sum(picked, (b) => b.count), stocks: merge(picked),
    };
  }));
}

/** How many stocks moved by how much: in bands, or "at least" each threshold. Click a bar to list its stocks. */
export function MoveHistogram({ bins, market, days = 1, mode = "bands" }: { bins: Bin[]; market: MarketId; days?: number; mode?: MoveMode }) {
  const span = days === 1 ? "today" : `over ${days} sessions`;
  const COLORS = useChartColors();
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const bars = mode === "atleast" ? atLeastBars(bins) : bandBars(bins);
  const shown = hover ?? picked;
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const x = d3.scaleBand<number>().domain(bars.map((_, i) => i)).range([0, innerW]).padding(0.12);
  const y = d3.scaleLinear().domain([0, d3.max(bars, (b) => b.count) || 1]).range([innerH, 0]);
  const total = d3.sum(bins, (b) => b.count) || 1;
  const middle = bars.findIndex((b) => b.up);

  return (
    <div>
      <div ref={box} className="w-full" style={{ minHeight: H + 16 }}>
        {width > 0 && (
          <svg width={width} height={H} className="block max-w-full" style={{ fontFamily: FONT }} role="img"
            aria-label={mode === "atleast" ? "Stocks at or beyond each move threshold" : "Histogram of moves across liquid stocks"}>
            <g transform={`translate(${M.left},${M.top})`}>
              {bars.map((b, i) => {
                const h = innerH - y(b.count);
                return (
                  <g key={b.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer"
                    onClick={() => setPicked(picked === i ? null : i)} role="button" aria-pressed={picked === i}
                    aria-label={`${b.count} stocks moved ${b.label}; show them`}>
                    <rect x={x(i)} y={0} width={x.bandwidth()} height={innerH} fill="transparent" />
                    <rect x={x(i)} y={y(b.count)} width={x.bandwidth()} height={Math.max(0, h)} rx={3}
                      fill={b.up ? COLORS.up : COLORS.down} fillOpacity={shown == null || shown === i ? 0.85 : 0.35}
                      stroke={picked === i ? COLORS.ink : "none"} strokeWidth={1.5} />
                    {(shown === i || b.count / total >= 0.08) && (
                      <text x={(x(i) ?? 0) + x.bandwidth() / 2} y={y(b.count) - 5} textAnchor="middle" fontSize={11} fill={COLORS.ink2} className="tabular">
                        {b.count}
                      </text>
                    )}
                    <text x={(x(i) ?? 0) + x.bandwidth() / 2} y={innerH + 16} textAnchor="middle" fontSize={10} fill={COLORS.ink3}>
                      {b.tick}
                    </text>
                  </g>
                );
              })}
              {middle > 0 && (
                <line x1={(x(middle) ?? 0) - 2} x2={(x(middle) ?? 0) - 2} y1={-6} y2={innerH} stroke={COLORS.ink3} strokeDasharray="3 3" />
              )}
            </g>
          </svg>
        )}
        <p className="h-4 text-center text-[11px] text-ink-3">
          {shown != null
            ? `${bars[shown].count} stocks (${Math.round((bars[shown].count / total) * 100)}%) moved ${bars[shown].label} ${span}`
            : `% change ${span} · click a bar to see its stocks`}
        </p>
      </div>
      {picked != null && bars[picked] && <BarStocks bar={bars[picked]} market={market} span={span} onClose={() => setPicked(null)} />}
    </div>
  );
}

function BarStocks({ bar, market, span, onClose }: { bar: Bar; market: MarketId; span: string; onClose: () => void }) {
  const list = bar.stocks;
  return (
    <div className="mt-3 rounded-lg border border-line p-3 text-xs">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="font-medium text-ink">
          Moved {bar.label} {span} ·{" "}
          {list.length < bar.count ? `${list.length} most traded of ${bar.count}` : `${bar.count} stocks`}
        </p>
        <button onClick={onClose} className="text-ink-3 hover:text-ink">Close</button>
      </div>
      {list.length === 0 ? (
        <p className="py-1 text-ink-3">No stocks here.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto">
          {list.map((x) => (
            <li key={x.symbol}>
              <Link href={`/stock/${market}/${encodeURIComponent(x.symbol)}`} className="flex items-center gap-2 py-1.5 hover:bg-wash">
                <StockLogo market={market} symbol={x.symbol} size={18} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-ink">{x.symbol}</span>
                  {x.sector && <span className="text-ink-3"> · {x.sector}</span>}
                </span>
                <span className="tabular text-ink-2">{price(x.price, market)}</span>
                <span className={clsx("tabular w-14 text-right", (x.change_pct ?? 0) >= 0 ? "text-up" : "text-down")}>
                  {x.change_pct == null ? "—" : `${x.change_pct >= 0 ? "+" : ""}${x.change_pct.toFixed(2)}%`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
