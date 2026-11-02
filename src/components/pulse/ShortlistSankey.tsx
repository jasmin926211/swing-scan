"use client";

import { useMemo, useState } from "react";
import { sankey, sankeyLinkHorizontal, sankeyJustify, type SankeyLink, type SankeyNode } from "d3-sankey";
import { useChartColors } from "@/lib/charts/theme";
import { useWidth } from "@/lib/charts/useWidth";

type Sector = { sector: string; pool: number; picked: number };
type N = { id: string; label: string; kind: "pool" | "sector" | "picked" | "rest" };
type L = { source: string; target: string; value: number; sector: string };

const H = 380;
const MAX_SECTORS = 9; // the rest are merged into "Other sectors" so the labels stay readable
const PICKED = "Top 30 by momentum";
const REST = "Not picked";

/** Sankey: the most-traded pool, by sector, flowing into the 30 picked or the rest. */
export function ShortlistSankey({ sectors, poolLabel }: { sectors: Sector[]; poolLabel: string }) {
  const C = useChartColors();
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);

  const graph = useMemo(() => {
    const ranked = [...sectors].sort((a, b) => b.picked - a.picked || b.pool - a.pool);
    const shown = ranked.slice(0, MAX_SECTORS);
    const other = ranked.slice(MAX_SECTORS).reduce((acc, s) => ({ ...acc, pool: acc.pool + s.pool, picked: acc.picked + s.picked }),
      { sector: "Other sectors", pool: 0, picked: 0 });
    const rows = other.pool > 0 ? [...shown, other] : shown;
    const total = rows.reduce((s, r) => s + r.pool, 0);
    const picked = rows.reduce((s, r) => s + r.picked, 0);
    const nodes: N[] = [
      { id: "pool", label: `${poolLabel} (${total})`, kind: "pool" },
      ...rows.map((r) => ({ id: `s:${r.sector}`, label: `${r.sector} ${r.picked}/${r.pool}`, kind: "sector" as const })),
      { id: "picked", label: `${PICKED} (${picked})`, kind: "picked" },
      { id: "rest", label: `${REST} (${total - picked})`, kind: "rest" },
    ];
    const links: L[] = rows.flatMap((r) => [
      { source: "pool", target: `s:${r.sector}`, value: r.pool, sector: r.sector },
      ...(r.picked > 0 ? [{ source: `s:${r.sector}`, target: "picked", value: r.picked, sector: r.sector }] : []),
      ...(r.pool - r.picked > 0 ? [{ source: `s:${r.sector}`, target: "rest", value: r.pool - r.picked, sector: r.sector }] : []),
    ]);
    return { nodes, links, rows };
  }, [sectors, poolLabel]);

  const layout = useMemo(() => {
    if (width <= 0) return null;
    const w = Math.max(width, 560);
    const gen = sankey<N, L>().nodeId((d) => d.id).nodeAlign(sankeyJustify).nodeWidth(12).nodePadding(9)
      .nodeSort(() => null).extent([[1, 6], [w - 1, H - 6]]);
    return { w, ...gen({ nodes: graph.nodes.map((d) => ({ ...d })), links: graph.links.map((d) => ({ ...d })) }) };
  }, [graph, width]);

  const nodeColor = (n: N) => (n.kind === "picked" ? C.up : n.kind === "rest" ? C.ink3 : n.kind === "pool" ? C.forecast : C.ink2);
  const linkColor = (l: SankeyLink<N, L>) => {
    const t = l.target as SankeyNode<N, L>;
    return t.kind === "picked" ? C.up : t.kind === "rest" ? C.ink3 : C.forecast;
  };
  const tip = (l: SankeyLink<N, L>) => {
    const t = l.target as SankeyNode<N, L>;
    const row = graph.rows.find((r) => r.sector === l.sector);
    if (t.kind === "sector") return `${l.sector}: ${l.value} of the most-traded stocks`;
    if (t.kind === "picked") return `${l.sector}: ${l.value} of its ${row?.pool} most-traded stocks made the top 30`;
    return `${l.sector}: ${l.value} of its ${row?.pool} not picked (weaker momentum)`;
  };

  return (
    <div ref={box} className="w-full overflow-x-auto">
      {layout && (
        <svg width={layout.w} height={H} role="img"
          aria-label={`Sankey chart: ${graph.rows.map((r) => `${r.sector} ${r.picked} of ${r.pool}`).join(", ")}`}>
          <g fill="none">
            {layout.links.map((l, i) => {
              const dim = hover != null && hover !== l.sector;
              return (
                <path key={i} d={sankeyLinkHorizontal()(l) ?? ""} stroke={linkColor(l)} strokeWidth={Math.max(1, l.width ?? 1)}
                  strokeOpacity={dim ? 0.06 : (l.target as N).kind === "rest" ? 0.18 : (l.target as N).kind === "sector" ? 0.2 : 0.5}
                  onMouseEnter={() => setHover(l.sector)} onMouseLeave={() => setHover(null)} style={{ transition: "stroke-opacity 150ms" }}>
                  <title>{tip(l)}</title>
                </path>
              );
            })}
          </g>
          {layout.nodes.map((n) => {
            const x0 = n.x0 ?? 0, x1 = n.x1 ?? 0, y0 = n.y0 ?? 0, y1 = n.y1 ?? 0;
            const right = x0 < layout.w / 2;
            return (
              <g key={n.id} onMouseEnter={() => n.kind === "sector" && setHover(n.id.slice(2))} onMouseLeave={() => setHover(null)}>
                <rect x={x0} y={y0} width={x1 - x0} height={Math.max(1, y1 - y0)} rx={2} fill={nodeColor(n)} />
                <text x={right ? x1 + 6 : x0 - 6} y={(y0 + y1) / 2} dy="0.35em" textAnchor={right ? "start" : "end"}
                  fontSize={11} fontWeight={n.kind === "picked" ? 600 : 400} fill={n.kind === "picked" ? C.up : C.ink2}
                  paintOrder="stroke" stroke={C.paper} strokeWidth={3}>
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <p className="pt-1 text-[11px] text-ink-3">
        Band width = number of stocks. Each sector shows how many of its most-traded stocks made the top 30 (7/30 = 7 of its 30 most-traded stocks). Hover a sector to follow it.
      </p>
    </div>
  );
}
