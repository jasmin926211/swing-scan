"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { getHeatmap, type HeatmapStock, type MarketId } from "@/lib/api";
import { compact, price, signedPct } from "@/lib/format";
import { COLORS, DIVERGING, FONT } from "@/lib/charts/theme";
import { duration, useReducedMotion } from "@/lib/charts/motion";
import { useWidth } from "@/lib/charts/useWidth";

const HEIGHT = 560;
const RANGE = 3; // ±3% and beyond take the strongest colour
const STORAGE_KEY = "ct.heatmap.palette";

type SectorNode = { sector: string; children: HeatmapStock[] };
type TreeNode = { children: SectorNode[] } | SectorNode | HeatmapStock;
type Rect = d3.HierarchyRectangularNode<TreeNode>;

/** Treemap of the market's largest stocks: area = market cap, colour = today's change, grouped by sector.
 *  Colours ease to new values on every refresh; tiles carry signed % labels so colour isn't the only cue. */
export function MarketHeatmap({ market, open }: { market: MarketId; open: boolean }) {
  const [box, width] = useWidth<HTMLDivElement>();
  const reduced = useReducedMotion();
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [stocks, setStocks] = useState<HeatmapStock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [palette, setPalette] = useState<keyof typeof DIVERGING>("market");
  const [hover, setHover] = useState<{ stock: HeatmapStock; x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "colorblind") setPalette("colorblind");
    } catch {
      // storage unavailable: default palette
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    setStocks(null);
    async function load() {
      try {
        const r = await getHeatmap(market);
        if (alive) {
          setStocks(r.stocks);
          setError(null);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
      if (alive) timer = setTimeout(load, open ? 20_000 : 120_000);
    }
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [market, open]);

  const color = useMemo(
    () => d3.scaleLinear<string>().domain(d3.range(7).map((i) => -RANGE + i * RANGE / 3)).range(DIVERGING[palette]).interpolate(d3.interpolateLab).clamp(true),
    [palette],
  );

  // Layout depends only on the set of stocks, their caps and the width; colour changes animate separately.
  const sectors: Rect[] = useMemo(() => {
    if (!stocks || width === 0) return [];
    const data: TreeNode = { children: [...d3.group(stocks, (s) => s.sector)].map(([sector, children]) => ({ sector, children })) };
    const root = d3
      .hierarchy<TreeNode>(data, (d) => ("children" in d ? (d.children as TreeNode[]) : undefined))
      .sum((d) => ("market_cap" in d ? d.market_cap : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return d3.treemap<TreeNode>().size([width, HEIGHT]).paddingOuter(2).paddingTop((n) => (n.depth === 1 ? 18 : 2)).paddingInner(2).round(true)(root).children ?? [];
  }, [stocks, width]);

  // Ease tile colours to the latest change on every refresh.
  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .selectAll<SVGRectElement, unknown>("rect.tile")
      .transition().duration(duration(800, reduced))
      .attr("fill", function () {
        return color(Number(this.dataset.change));
      });
  }, [stocks, color, reduced, sectors]);

  function togglePalette() {
    const next = palette === "market" ? "colorblind" : "market";
    setPalette(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  return (
    <section className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Market heatmap</h2>
          <p className="mt-0.5 text-xs text-ink-3">Largest {stocks?.length ?? ""} stocks by market cap, grouped by sector. Click a tile to open it.</p>
        </div>
        <div className="flex items-center gap-4">
          <ColorKey color={color} />
          <button onClick={togglePalette} className="text-xs text-ink-2 underline-offset-2 hover:underline" aria-pressed={palette === "colorblind"}>
            {palette === "market" ? "Colour-blind palette" : "Red / green palette"}
          </button>
        </div>
      </div>

      <div ref={box} className="relative w-full" style={{ height: HEIGHT }}>
        {error && !stocks && <p className="p-6 text-sm text-down">Could not load the heatmap: {error}</p>}
        {!stocks && !error && <div className="m-4 h-[528px] animate-pulse rounded-lg bg-wash" />}
        {stocks && width > 0 && (
          <svg ref={svgRef} width={width} height={HEIGHT} style={{ fontFamily: FONT }} role="img"
            aria-label="Treemap of the largest stocks: tile area is market cap, colour is today's change">
            {sectors.map((s) => (
              <g key={(s.data as SectorNode).sector}>
                <text x={s.x0 + 4} y={s.y0 + 13} fontSize={11} fontWeight={600} fill={COLORS.ink2}>
                  {truncate((s.data as SectorNode).sector, (s.x1 - s.x0) / 6.5)}
                </text>
                {(s.children ?? []).map((leaf) => {
                  const d = leaf.data as HeatmapStock;
                  const w = leaf.x1 - leaf.x0;
                  const h = leaf.y1 - leaf.y0;
                  const strong = Math.abs(d.change_pct) >= RANGE * 0.55;
                  const ink = strong ? "#ffffff" : COLORS.ink;
                  const big = w > 52 && h > 30;
                  return (
                    <g key={d.symbol} transform={`translate(${leaf.x0},${leaf.y0})`} style={{ cursor: "pointer" }}
                      onClick={() => router.push(`/stock/${market}/${encodeURIComponent(d.symbol)}`)}
                      onMouseMove={(e) => {
                        const [x, y] = d3.pointer(e, box.current);
                        setHover({ stock: d, x, y });
                      }}
                      onMouseLeave={() => setHover(null)}>
                      <rect className="tile" data-change={d.change_pct} width={w} height={h} rx={3} fill={COLORS.line}
                        stroke={hover?.stock.symbol === d.symbol ? COLORS.ink : "none"} strokeWidth={1.5} />
                      {big && (
                        <>
                          <text x={6} y={16} fontSize={Math.min(14, 9 + w / 30)} fontWeight={600} fill={ink}>{truncate(d.symbol, w / 7.5)}</text>
                          <text x={6} y={16 + Math.min(14, 9 + w / 30) + 2} fontSize={11} fill={ink} className="tabular">{signedPct(d.change_pct)}</text>
                        </>
                      )}
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        )}
        {hover && (
          <div className="pointer-events-none absolute z-10 w-56 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-sm"
            style={{ left: Math.min(hover.x + 14, width - 236), top: Math.min(hover.y + 14, HEIGHT - 96) }}>
            <p className="font-semibold">{hover.stock.symbol}</p>
            <p className="truncate text-ink-3">{hover.stock.name}</p>
            <p className="tabular mt-1">
              {price(hover.stock.price, market)}{" "}
              <span className={hover.stock.change_pct >= 0 ? "text-up" : "text-down"}>{signedPct(hover.stock.change_pct)}</span>
            </p>
            <p className="tabular text-ink-3">Mkt cap {compact(hover.stock.market_cap, market)} · {hover.stock.sector}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function ColorKey({ color }: { color: d3.ScaleLinear<string, string> }) {
  const stops = d3.range(-RANGE, RANGE + 0.01, RANGE / 3);
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-ink-3" aria-label="Colour key: today's change">
      <span>−{RANGE}%</span>
      <span className="flex overflow-hidden rounded">
        {stops.map((s) => (
          <span key={s} className="h-2.5 w-5" style={{ background: color(s) }} />
        ))}
      </span>
      <span>+{RANGE}%</span>
    </div>
  );
}

const truncate = (s: string, chars: number) => (s.length <= chars ? s : s.slice(0, Math.max(0, Math.floor(chars) - 1)) + "…");
