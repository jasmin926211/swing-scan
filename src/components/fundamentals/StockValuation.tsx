"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import * as d3 from "d3";
import { getStockFundamentals, type FundamentalsRow, type StockFundamentals } from "@/lib/api";
import { price } from "@/lib/format";
import { useChartColors } from "@/lib/charts/theme";
import { useWidth } from "@/lib/charts/useWidth";

const fy = (iso: string) => `FY${iso.slice(2, 4)}`;
const fmt = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));
const signed = (v: number) => `${v > 0 ? "+" : ""}${fmt(v * 100)}%`;
const date = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** One company's earnings and P/E over the last four financial years, and what today's price implies. */
export function StockValuation({ row }: { row: FundamentalsRow }) {
  const [d, setD] = useState<StockFundamentals | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getStockFundamentals(row.symbol).then((x) => alive && setD(x)).catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [row.symbol]);

  const r = d ?? row;
  const hist = d?.pe_history ?? null;
  const yearPes = (hist ?? []).map((h) => h.pe).filter((v): v is number => v != null && v > 0);
  const usualPe = yearPes.length >= 2 ? median(yearPes) : null;
  const usualPrice = usualPe != null && r.eps_ttm != null && r.eps_ttm > 0 ? usualPe * r.eps_ttm : null;
  const first = hist?.find((h) => h.pe != null && h.price != null && h.eps != null && h.eps > 0) ?? null;
  const years = first ? (Date.now() - Date.parse(`${first.end}T00:00:00Z`)) / (365.25 * 864e5) : 0;
  const priceCagr = first && r.price && years > 1 ? (r.price / first.price!) ** (1 / years) - 1 : null;
  const epsCagr = first && r.eps_ttm && r.eps_ttm > 0 && years > 1 ? (r.eps_ttm / first.eps!) ** (1 / years) - 1 : null;
  const peChange = first?.pe && r.pe ? r.pe / first.pe : null;

  return (
    <div className="space-y-4 bg-wash/50 px-4 py-4">
      <p className="text-xs text-ink-3">
        {r.basis === "consolidated" ? "Consolidated" : "Standalone"} results to {date(r.quarter_end)}
        {r.filed && <> (filed {r.filed.split(" ")[0].replaceAll("-", " ")})</>}
        {r.promoter_date && <> · shareholding at {date(r.promoter_date)}</>}
        {r.bs_date && <> · balance sheet at {date(r.bs_date)}</>}
      </p>

      {error && <p className="text-sm text-down">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <MiniChart
          title="Earnings per share"
          note="Each financial year, and the last 12 months; adjusted for splits and bonus issues"
          kind="bar"
          loading={!d && !error}
          points={[
            ...(hist ?? []).map((h) => ({ label: fy(h.end), value: h.eps, tip: h.eps == null ? "A loss year" : `₹${fmt(h.eps, 2)} a share` })),
            ...(d ? [{ label: "12m", value: r.eps_ttm, tip: r.eps_ttm == null ? "—" : `₹${fmt(r.eps_ttm, 2)} a share, last 12 months` }] : []),
          ]}
          format={(v) => fmt(v, v >= 100 ? 0 : 1)}
        />
        <MiniChart
          title="P/E"
          note="At each 31 March on that year's earnings, and today on the last 12 months"
          kind="dot"
          loading={!d && !error}
          points={[
            ...(hist ?? []).map((h) => ({ label: fy(h.end), value: h.pe, tip: h.pe == null ? "No P/E (a loss year)" : `P/E ${fmt(h.pe)}: price ₹${fmt(h.price, 0)} ÷ EPS ₹${fmt(h.eps, 2)}` })),
            ...(d ? [{ label: "Now", value: r.pe, tip: r.pe == null ? "No P/E (a loss)" : `P/E ${fmt(r.pe)}: price ₹${fmt(r.price, 2)} ÷ EPS ₹${fmt(r.eps_ttm, 2)}` }] : []),
          ]}
          refLine={usualPe != null ? { value: usualPe, label: `usual P/E ${fmt(usualPe)}` } : undefined}
          format={(v) => fmt(v)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="At its usual P/E">
          {usualPrice != null && r.price ? (
            <>
              <p className="tabular text-lg font-semibold">₹{price(usualPrice, "in")}</p>
              <p className="text-xs text-ink-2">
                <span className={clsx("font-medium", usualPrice >= r.price ? "text-up" : "text-down")}>{signed(usualPrice / r.price - 1)}</span> vs ₹{price(r.price, "in")} now.
                EPS ₹{fmt(r.eps_ttm, 2)} × the median year-end P/E of {fmt(usualPe)}.
              </p>
            </>
          ) : (
            <p className="text-xs text-ink-2">{d ? "Needs at least two profitable years and a profit in the last 12 months." : "…"}</p>
          )}
        </Stat>
        <Stat label="P/E against growth (PEG)">
          {r.peg != null ? (
            <>
              <p className="tabular text-lg font-semibold">{fmt(r.peg, 2)}</p>
              <p className="text-xs text-ink-2">
                P/E {fmt(r.pe)} ÷ profit growth {fmt((r.profit_g3 ?? 0) * 100)}% a year.{" "}
                {r.peg < 1 ? "Below 1: cheap for its growth" : r.peg <= 2 ? "1 to 2: priced in line with its growth" : "Above 2: expensive for its growth"} (a rule of thumb).
              </p>
            </>
          ) : (
            <p className="text-xs text-ink-2">Needs a P/E and positive 3-year profit growth.</p>
          )}
        </Stat>
        <Stat label="Price against earnings">
          {priceCagr != null && epsCagr != null && peChange != null && first ? (
            <>
              <p className="tabular text-sm">
                Price <span className="font-semibold">{signed(priceCagr)}</span> a year · EPS <span className="font-semibold">{signed(epsCagr)}</span> a year
              </p>
              <p className="text-xs text-ink-2">
                Since {fy(first.end)}.{" "}
                {peChange > 1.15
                  ? `The P/E rose from ${fmt(first.pe)} to ${fmt(r.pe)}: the price ran ahead of earnings.`
                  : peChange < 0.87
                    ? `The P/E fell from ${fmt(first.pe)} to ${fmt(r.pe)}: earnings grew faster than the price.`
                    : `The P/E stayed near ${fmt(r.pe)}: the price moved with earnings.`}
              </p>
            </>
          ) : (
            <p className="text-xs text-ink-2">{d ? "Needs a profitable year three years back and a profit now." : "…"}</p>
          )}
        </Stat>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-[11px] leading-relaxed text-ink-3">
          Arithmetic on the company&apos;s reported numbers, not a forecast or a target: we haven&apos;t tested whether prices move toward
          these levels. A P/E can stay above or below its usual level for years.
        </p>
        <Link href={`/stock/in/${encodeURIComponent(row.symbol)}`} className="text-sm font-medium text-accent hover:underline">
          Open {row.symbol} →
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <p className="mb-1 text-xs text-ink-3">{label}</p>
      {children}
    </div>
  );
}

type Pt = { label: string; value: number | null; tip: string };
const H = 150;
const M = { top: 18, right: 8, bottom: 20, left: 8 };

/** A handful of values by year: bars (EPS) or dots (P/E), each labelled, with a hover note. */
function MiniChart({ title, note, kind, points, format, refLine, loading }: {
  title: string; note: string; kind: "bar" | "dot"; points: Pt[]; format: (v: number) => string;
  refLine?: { value: number; label: string }; loading: boolean;
}) {
  const C = useChartColors();
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  const lo = Math.min(0, ...vals, refLine?.value ?? 0);
  const hi = Math.max(0, ...vals, refLine?.value ?? 0) || 1;
  const innerW = Math.max(0, width - M.left - M.right);
  const x = d3.scaleBand<string>().domain(points.map((p) => p.label)).range([0, innerW]).padding(0.35);
  const y = d3.scaleLinear().domain([lo, hi * 1.1]).range([H - M.top - M.bottom, 0]);
  const last = points.length - 1;

  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <p className="flex items-center justify-between gap-2 text-sm font-medium">
        {title}
        {refLine && (
          <span className="flex items-center gap-1.5 text-[11px] font-normal text-ink-3">
            <svg width="16" height="2" aria-hidden><line x1="0" x2="16" y1="1" y2="1" stroke={C.ink3} strokeDasharray="4 3" /></svg>
            {refLine.label}
          </span>
        )}
      </p>
      <p className="text-[11px] text-ink-3">{note}</p>
      <div ref={box} className="relative mt-2">
        {loading ? (
          <div className="animate-pulse rounded bg-wash" style={{ height: H }} />
        ) : points.length === 0 ? (
          <p className="text-xs text-ink-3" style={{ height: H }}>No yearly figures in the filings.</p>
        ) : (
          width > 0 && (
            <svg width={width} height={H} role="img" aria-label={`${title}: ${points.map((p) => `${p.label} ${p.value == null ? "none" : format(p.value)}`).join(", ")}`}>
              <g transform={`translate(${M.left},${M.top})`}>
                <line x1={0} x2={innerW} y1={y(0)} y2={y(0)} stroke={C.line} />
                {refLine && <line x1={0} x2={innerW} y1={y(refLine.value)} y2={y(refLine.value)} stroke={C.ink3} strokeDasharray="4 3" />}
                {points.map((p, i) => {
                  const cx = (x(p.label) ?? 0) + x.bandwidth() / 2;
                  const emph = i === last; // the latest value: today's
                  const fill = emph ? C.forecast : C.ink3;
                  return (
                    <g key={p.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                      <rect x={x(p.label)! - x.step() * x.paddingInner() / 2} width={x.step()} y={-M.top} height={H} fill="transparent" />
                      {p.value != null && kind === "bar" && (
                        <rect x={x(p.label)} width={x.bandwidth()} y={Math.min(y(p.value), y(0))} height={Math.max(1, Math.abs(y(p.value) - y(0)))}
                          rx={3} fill={fill} opacity={hover == null || hover === i ? 1 : 0.6} />
                      )}
                      {p.value != null && kind === "dot" && (
                        <circle cx={cx} cy={y(p.value)} r={hover === i ? 6 : 5} fill={fill} stroke={C.paper} strokeWidth={2} />
                      )}
                      <text x={cx} y={p.value == null ? y(0) - 4 : (p.value >= 0 ? y(p.value) : y(0)) - (kind === "dot" ? 9 : 4)} textAnchor="middle" fontSize={10.5}
                        fill={emph ? C.ink : C.ink2} fontWeight={emph ? 600 : 400} className="tabular">
                        {p.value == null ? "—" : format(p.value)}
                      </text>
                      <text x={cx} y={H - M.top - 4} textAnchor="middle" fontSize={10.5} fill={C.ink3}>{p.label}</text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )
        )}
        {hover != null && points[hover] && (
          <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-paper px-2 py-1 text-xs shadow-sm"
            style={{ left: Math.min(Math.max(M.left + (x(points[hover].label) ?? 0) + x.bandwidth() / 2, 70), width - 70) }}>
            <span className="font-medium">{points[hover].label}</span> · {points[hover].tip}
          </div>
        )}
      </div>
    </div>
  );
}
