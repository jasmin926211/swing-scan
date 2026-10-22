"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import * as d3 from "d3";
import type { MarketId, Pulse } from "@/lib/api";
import { price } from "@/lib/format";
import { StockLogo } from "@/components/StockLogo";
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

/** How many stocks moved by how much today: the shape of the day in one chart. Click a bar to list its stocks. */
export function MoveHistogram({ bins, market, days = 1 }: { bins: Bin[]; market: MarketId; days?: number }) {
  const span = days === 1 ? "today" : `over ${days} sessions`;
  const COLORS = useChartColors();
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const shown = hover ?? picked;
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const x = d3.scaleBand<number>().domain(bins.map((_, i) => i)).range([0, innerW]).padding(0.12);
  const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.count) || 1]).range([innerH, 0]);
  const total = d3.sum(bins, (b) => b.count) || 1;

  return (
    <div>
    <div ref={box} className="w-full" style={{ minHeight: H + 16 }}>
      {width > 0 && (
        <svg width={width} height={H} className="block max-w-full" style={{ fontFamily: FONT }} role="img"
          aria-label="Histogram of today's moves across liquid stocks">
          <g transform={`translate(${M.left},${M.top})`}>
            {bins.map((b, i) => {
              const up = b.from != null && b.from >= 0;
              const h = innerH - y(b.count);
              return (
                <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer"
                  onClick={() => setPicked(picked === i ? null : i)} role="button" aria-pressed={picked === i}
                  aria-label={`${b.count} stocks moved ${label(b)}; show them`}>
                  <rect x={x(i)} y={0} width={x.bandwidth()} height={innerH} fill="transparent" />
                  <rect x={x(i)} y={y(b.count)} width={x.bandwidth()} height={Math.max(0, h)} rx={3}
                    fill={up ? COLORS.up : COLORS.down} fillOpacity={shown == null || shown === i ? 0.85 : 0.35}
                    stroke={picked === i ? COLORS.ink : "none"} strokeWidth={1.5} />
                  {(shown === i || b.count / total >= 0.08) && (
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
        {shown != null
          ? `${bins[shown].count} stocks (${Math.round((bins[shown].count / total) * 100)}%) moved ${label(bins[shown])} ${span}`
          : `% change ${span} · click a bar to see its stocks`}
      </p>
    </div>
    {picked != null && <BinStocks bin={bins[picked]} market={market} span={span} onClose={() => setPicked(null)} />}
    </div>
  );
}

function BinStocks({ bin, market, span, onClose }: { bin: Bin; market: MarketId; span: string; onClose: () => void }) {
  const list = bin.stocks ?? [];
  return (
    <div className="mt-3 rounded-lg border border-line p-3 text-xs">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="font-medium text-ink">
          Moved {label(bin)} {span} ·{" "}
          {list.length < bin.count ? `${list.length} most traded of ${bin.count}` : `${bin.count} stocks`}
        </p>
        <button onClick={onClose} className="text-ink-3 hover:text-ink">Close</button>
      </div>
      {list.length === 0 ? (
        <p className="py-1 text-ink-3">No stocks in this band.</p>
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
