"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { MarketId, OptionChain } from "@/lib/api";
import { compact, price } from "@/lib/format";
import { useChartColors, FONT } from "@/lib/charts/theme";
import { duration, useReducedMotion } from "@/lib/charts/motion";
import { useWidth } from "@/lib/charts/useWidth";

const ROW = 18;
const M = { top: 26, right: 12, bottom: 8, left: 12 };
const STRIKE_W = 78; // centre column with the strike labels

/** Open interest by strike: calls grow to the left, puts to the right, from a shared strike column.
 *  Spot and max pain are marked; bars animate out from the centre when the chain loads. */
export function OIButterfly({ rows, chain, market }: { rows: OptionChain["rows"]; chain: OptionChain; market: MarketId }) {
  const COLORS = useChartColors();
  const [box, width] = useWidth<HTMLDivElement>();
  const reduced = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const height = M.top + rows.length * ROW + M.bottom;
  const half = Math.max(0, (width - M.left - M.right - STRIKE_W) / 2);
  const maxOi = d3.max(rows, (r) => Math.max(r.call?.oi ?? 0, r.put?.oi ?? 0)) || 1;
  const len = useMemo(() => d3.scaleLinear().domain([0, maxOi]).range([0, half]), [maxOi, half]);
  const yRow = (i: number) => M.top + i * ROW;
  const centre = M.left + half;
  const strikeIndex = (k: number | null) => (k == null ? -1 : rows.findIndex((r) => r.strike === k));
  const spotY = useMemo(() => {
    // Spot usually falls between two strikes: place the marker proportionally.
    if (chain.spot == null || rows.length < 2) return null;
    const i = rows.findIndex((r) => r.strike >= chain.spot!);
    if (i <= 0) return null;
    const f = (chain.spot - rows[i - 1].strike) / (rows[i].strike - rows[i - 1].strike);
    return yRow(i - 1) + ROW / 2 + f * ROW;
  }, [chain.spot, rows]);

  // Bars grow out from the strike column whenever the rows (expiry or refresh) change.
  useEffect(() => {
    if (!svgRef.current || width === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGRectElement, unknown>("rect.oi")
      .attr("width", 0)
      .attr("x", function () {
        return this.dataset.side === "call" ? centre : centre + STRIKE_W;
      })
      .transition().delay((_, i) => duration(i * 6, reduced)).duration(duration(650, reduced)).ease(d3.easeCubicOut)
      .attr("width", function () {
        return Number(this.dataset.w);
      })
      .attr("x", function () {
        return this.dataset.side === "call" ? centre - Number(this.dataset.w) : centre + STRIKE_W;
      });
  }, [rows, width, reduced, centre]);

  const maxPainI = strikeIndex(chain.max_pain);
  const h = hover != null ? rows[hover] : null;

  return (
    <div ref={box} className="relative w-full">
      {width > 0 && (
        <svg ref={svgRef} className="block max-w-full" width={width} height={height} style={{ fontFamily: FONT }} role="img"
          aria-label="Open interest by strike: calls on the left, puts on the right">
          <text x={centre - 6} y={14} textAnchor="end" fontSize={11} fill={COLORS.ink2}>
            ← Call OI
          </text>
          <text x={centre + STRIKE_W + 6} y={14} fontSize={11} fill={COLORS.ink2}>
            Put OI →
          </text>
          {rows.map((r, i) => {
            const atm = r.strike === chain.atm_strike;
            const cw = len(r.call?.oi ?? 0);
            const pw = len(r.put?.oi ?? 0);
            return (
              <g key={r.strike} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={M.left} y={yRow(i)} width={width - M.left - M.right} height={ROW} fill={hover === i ? COLORS.wash : "transparent"} />
                <rect className="oi" data-side="call" data-w={cw} x={centre - cw} y={yRow(i) + 3} width={cw} height={ROW - 6} rx={2} fill={COLORS.forecast} />
                <rect className="oi" data-side="put" data-w={pw} x={centre + STRIKE_W} y={yRow(i) + 3} width={pw} height={ROW - 6} rx={2} fill={COLORS.second} />
                <text x={centre + STRIKE_W / 2} y={yRow(i) + ROW / 2} dy="0.32em" textAnchor="middle" fontSize={11}
                  fontWeight={atm ? 700 : 400} fill={atm ? COLORS.ink : COLORS.ink2} className="tabular">
                  {price(r.strike, market)}
                </text>
                {i === maxPainI && (
                  <text x={width - M.right} y={yRow(i) + ROW / 2} dy="0.32em" textAnchor="end" fontSize={10} fill={COLORS.ink3}>
                    max pain
                  </text>
                )}
              </g>
            );
          })}
          {spotY != null && (
            <g pointerEvents="none">
              <line x1={M.left} x2={width - M.right} y1={spotY} y2={spotY} stroke={COLORS.ink} strokeDasharray="4 3" />
              <text x={M.left + 2} y={spotY - 4} fontSize={10} fill={COLORS.ink}>
                spot {price(chain.spot, market)}
              </text>
            </g>
          )}
        </svg>
      )}
      {h && hover != null && (
        <div className="pointer-events-none absolute z-10 rounded-lg border border-line bg-paper px-3 py-2 text-xs shadow-sm"
          style={{ top: yRow(hover) + ROW + 4, left: centre - 40 }}>
          <p className="font-medium">Strike {price(h.strike, market)}</p>
          <p className="tabular mt-0.5 text-ink-2">
            Calls: {compact(h.call?.oi, market)} OI · Puts: {compact(h.put?.oi, market)} OI
          </p>
        </div>
      )}
    </div>
  );
}
