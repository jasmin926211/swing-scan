"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import clsx from "clsx";
import type { Candle, Forecast, Interval, PatternSignal } from "@/lib/api";
import { COLORS, FONT } from "@/lib/charts/theme";
import { duration, useReducedMotion } from "@/lib/charts/motion";
import { useWidth } from "@/lib/charts/useWidth";

const HEIGHT = 520;
const M = { top: 12, right: 64, bottom: 26, left: 8 };
const VOLUME_SHARE = 0.18; // of the plot height, below the price pane
const GAP = 14; // between price and volume panes

const DAY = 24 * 3600 * 1000;
const RANGES: Record<Interval, { label: string; days: number }[]> = {
  "1h": [{ label: "5D", days: 7 }, { label: "1M", days: 31 }, { label: "3M", days: 92 }, { label: "All", days: Infinity }],
  "1d": [
    { label: "1M", days: 31 }, { label: "3M", days: 92 }, { label: "6M", days: 183 },
    { label: "1Y", days: 366 }, { label: "3Y", days: 1096 }, { label: "All", days: Infinity },
  ],
  "1wk": [{ label: "1Y", days: 366 }, { label: "3Y", days: 1096 }, { label: "5Y", days: 1827 }, { label: "All", days: Infinity }],
};
const DEFAULT_RANGE: Record<Interval, string> = { "1h": "1M", "1d": "6M", "1wk": "3Y" };
const TIME_FORMAT: Record<Interval, (d: Date) => string> = {
  "1h": d3.utcFormat("%d %b %H:%M"),
  "1d": d3.utcFormat("%d %b"),
  "1wk": d3.utcFormat("%b %Y"),
};

type Domain = [number, number]; // visible bar indices (fractional while zooming)

/** Candlestick + volume chart with an animated forecast fan. Bars are spaced by index (trading sessions),
 *  so weekends and holidays leave no gaps; forecast bars continue the index after the last candle. */
export function PriceChart({
  candles,
  interval,
  forecast,
  showPaths,
  decimals,
  signals = [],
  selected = null,
  onSelect,
}: {
  candles: Candle[];
  interval: Interval;
  forecast: Forecast | null;
  showPaths: boolean;
  decimals: number;
  /** validated pattern signals to mark on the chart */
  signals?: PatternSignal[];
  /** index into `signals` of the one to highlight with its entry / stop / target */
  selected?: number | null;
  onSelect?: (i: number) => void;
}) {
  const [box, width] = useWidth<HTMLDivElement>();
  const reduced = useReducedMotion();
  const clipId = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const overlayRef = useRef<SVGRectElement>(null);
  const pathsRef = useRef<SVGGElement>(null);
  const revealRef = useRef<SVGRectElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGRectElement, unknown> | null>(null);
  const [domain, setDomain] = useState<Domain | null>(null);
  const [range, setRange] = useState(DEFAULT_RANGE[interval]);
  const [hover, setHover] = useState<{ i: number; y: number } | null>(null);

  const n = candles.length;
  const fc = forecast?.points ?? [];
  const total = n + fc.length;
  const times = useMemo(() => [...candles.map((c) => c[0]), ...fc.map((p) => p.time)], [candles, fc]);
  const innerW = Math.max(0, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const priceH = plotH * (1 - VOLUME_SHARE) - GAP;
  const volTop = priceH + GAP;
  const volH = plotH - volTop;

  // Base x scale over every bar; the zoom transform rescales it to the visible domain.
  const xFull = useMemo(() => d3.scaleLinear().domain([-0.5, total - 0.5]).range([0, innerW]), [total, innerW]);

  function domainFor(label: string): Domain {
    const days = RANGES[interval].find((r) => r.label === label)?.days ?? Infinity;
    const lastCandle = candles[n - 1]?.[0] ?? 0;
    const start = days === Infinity ? 0 : Math.max(0, d3.bisectLeft(candles.map((c) => c[0]), lastCandle - days * DAY));
    return [start - 0.5, total - 0.5];
  }

  function applyDomain(d: Domain) {
    const overlay = overlayRef.current;
    const zoom = zoomRef.current;
    if (!overlay || !zoom || innerW === 0) return setDomain(d);
    const k = total / (d[1] - d[0]);
    const t = d3.zoomIdentity.scale(k).translate(-xFull(d[0]), 0);
    d3.select(overlay).call(zoom.transform, t);
  }

  // Zoom (wheel / pinch) and pan (drag) along x.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || innerW === 0 || total === 0) return;
    const zoom = d3
      .zoom<SVGRectElement, unknown>()
      .scaleExtent([1, Math.max(1, total / 8)])
      .translateExtent([[0, 0], [innerW, plotH]])
      .extent([[0, 0], [innerW, plotH]])
      .on("zoom", (e: d3.D3ZoomEvent<SVGRectElement, unknown>) => {
        setDomain(e.transform.rescaleX(xFull).domain() as Domain);
        if (e.sourceEvent) setRange(""); // the user zoomed by hand: no range button is active
      });
    zoomRef.current = zoom;
    d3.select(overlay).call(zoom).on("dblclick.zoom", null);
    return () => {
      d3.select(overlay).on(".zoom", null);
    };
  }, [innerW, plotH, total, xFull]);

  // New data or interval: back to the default range. A new forecast keeps the start and reveals the forecast.
  useEffect(() => {
    setRange(DEFAULT_RANGE[interval]);
    applyDomain(domainFor(DEFAULT_RANGE[interval]));
  }, [candles, interval, innerW]);
  useEffect(() => {
    if (!forecast) return;
    applyDomain([Math.min(domain?.[0] ?? 0, n - 30), total - 0.5]);
  }, [forecast]);

  const d = domain ?? domainFor(DEFAULT_RANGE[interval]);
  const x = useMemo(() => d3.scaleLinear().domain(d).range([0, innerW]), [d, innerW]);
  const lo = Math.max(0, Math.floor(d[0]));
  const hi = Math.min(total - 1, Math.ceil(d[1]));
  const visible = candles.slice(lo, Math.min(hi + 1, n));
  const visibleFc = fc.filter((_, j) => n + j >= lo && n + j <= hi);

  const y = useMemo(() => {
    const lows = [...visible.map((c) => c[3]), ...visibleFc.map((p) => p.p10)];
    const highs = [...visible.map((c) => c[2]), ...visibleFc.map((p) => p.p90)];
    const [min, max] = [d3.min(lows) ?? 0, d3.max(highs) ?? 1];
    const pad = (max - min) * 0.06 || max * 0.01;
    return d3.scaleLinear().domain([min - pad, max + pad]).nice(6).range([priceH, 0]);
  }, [visible, visibleFc, priceH]);
  const yVol = useMemo(
    () => d3.scaleLinear().domain([0, d3.max(visible, (c) => c[5]) || 1]).range([volH, 0]),
    [visible, volH],
  );

  const band = innerW / Math.max(1, d[1] - d[0]);
  const bodyW = Math.max(1, Math.min(14, band * 0.68));
  const fmt = d3.format(`,.${decimals}f`);
  const last = candles[n - 1];

  // Each signal sits on the last candle of this chart that falls within the signal's own candle
  // (a weekly or monthly pattern lands on the last daily candle of that week / month).
  const marks = useMemo(() => {
    const times = candles.map((c) => c[0]);
    return signals
      .map((sig, k) => {
        const i = d3.bisectRight(times, sig.time_end + DAY - 1) - 1;
        if (i < 0) return null;
        const holdDays = sig.max_hold_bars * (sig.style === "swing" ? 1.45 : sig.style === "positional" ? 7 : 30.5);
        const endIdx = Math.max(i, d3.bisectRight(times, sig.time_end + holdDays * DAY) - 1);
        return { sig, k, i, endIdx };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [signals, candles]);
  const chosen = marks.find((m) => m.k === selected);

  // Bring a newly selected signal (and its holding period) into view.
  useEffect(() => {
    if (!chosen) return;
    const [d0, d1] = domain ?? [0, total];
    if (chosen.i < d0 || chosen.endIdx > d1) {
      setRange("");
      applyDomain([Math.max(-0.5, chosen.i - 60), Math.min(total - 0.5, chosen.endIdx + 10)]);
    }
  }, [selected]); // only when the selection changes, not on every zoom

  // Forecast geometry, anchored on the last real close.
  const anchor = last ? { i: n - 1, v: forecast?.summary.last_close ?? last[4] } : null;
  const fcSeries = anchor ? [{ i: anchor.i, med: anchor.v, p10: anchor.v, p25: anchor.v, p75: anchor.v, p90: anchor.v },
    ...fc.map((p, j) => ({ i: n + j, med: p.close, p10: p.p10, p25: p.p25, p75: p.p75, p90: p.p90 }))] : [];
  const area = (k0: "p10" | "p25", k1: "p75" | "p90") =>
    d3.area<(typeof fcSeries)[number]>().x((p) => x(p.i)).y0((p) => y(p[k0])).y1((p) => y(p[k1])).curve(d3.curveMonotoneX)(fcSeries) ?? "";
  const medianLine = d3.line<(typeof fcSeries)[number]>().x((p) => x(p.i)).y((p) => y(p.med)).curve(d3.curveMonotoneX)(fcSeries) ?? "";
  const pathLines = forecast && anchor
    ? forecast.paths.map((path) =>
        d3.line<[number, number]>().x((p) => x(p[0])).y((p) => y(p[1])).curve(d3.curveMonotoneX)(
          [[anchor.i, anchor.v], ...path.map((v, j) => [n + j, v] as [number, number])],
        ) ?? "")
    : [];

  // Animation: sampled paths draw in one by one, then fade back while the bands and median sweep in.
  useEffect(() => {
    if (!forecast || !pathsRef.current || !revealRef.current) return;
    const draw = duration(700, reduced);
    const stagger = duration(Math.min(45, 900 / Math.max(1, forecast.paths.length)), reduced);
    const lines = d3.select(pathsRef.current).selectAll<SVGPathElement, unknown>("path");
    lines.each(function () {
      const len = this.getTotalLength();
      d3.select(this).attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len).attr("opacity", 0.55);
    });
    const drawEnd = draw + stagger * forecast.paths.length;
    lines
      .transition("draw").delay((_, i) => i * stagger).duration(draw).ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0)
      .on("end", function () {
        d3.select(this).attr("stroke-dasharray", null).attr("stroke-dashoffset", null); // geometry changes on zoom
      })
      .transition().duration(duration(500, reduced))
      .attr("opacity", showPaths ? 0.18 : 0);
    d3.select(revealRef.current)
      .attr("width", 0)
      .transition("reveal").delay(reduced ? 0 : drawEnd * 0.55).duration(duration(900, reduced)).ease(d3.easeCubicInOut)
      .attr("width", innerW + M.right)
      .on("end", function () {
        d3.select(this).attr("width", 1e6);
      });
  }, [forecast, reduced]);

  // Toggling "show all sampled paths" after the animation.
  useEffect(() => {
    if (!pathsRef.current) return;
    d3.select(pathsRef.current).selectAll("path").transition("toggle").duration(duration(300, reduced)).attr("opacity", showPaths ? 0.18 : 0);
  }, [showPaths, reduced]);

  // x-axis ticks at evenly spaced visible bars.
  const ticks = useMemo(() => {
    const count = Math.max(2, Math.floor(innerW / 110));
    const step = Math.max(1, Math.ceil((hi - lo + 1) / count));
    const out: number[] = [];
    for (let i = Math.ceil(lo / step) * step; i <= hi; i += step) out.push(i);
    return out;
  }, [lo, hi, innerW]);

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const [mx, my] = d3.pointer(e);
    const i = Math.round(x.invert(mx));
    if (i < 0 || i >= total) return setHover(null);
    setHover({ i, y: my });
  }

  const hovered = hover && (hover.i < n ? { kind: "candle" as const, c: candles[hover.i] } : { kind: "forecast" as const, p: fc[hover.i - n] });
  const tipLeft = hover ? x(hover.i) + M.left : 0;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex gap-0.5 text-xs">
          {RANGES[interval].map((r) => (
            <button
              key={r.label}
              onClick={() => {
                setRange(r.label);
                applyDomain(domainFor(r.label));
              }}
              className={clsx("rounded-md px-2 py-1 font-medium transition-colors", range === r.label ? "bg-ink text-white" : "text-ink-2 hover:bg-wash")}
            >
              {r.label}
            </button>
          ))}
        </div>
        {forecast && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-2">
            <LegendSwatch kind="line" label="Forecast median" />
            <LegendSwatch kind="band" opacity={0.28} label="50% range" />
            <LegendSwatch kind="band" opacity={0.12} label="80% range" />
          </div>
        )}
      </div>

      <div ref={box} className="relative w-full select-none" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            ref={svgRef}
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Candlestick chart with volume${forecast ? " and an AI forecast for the next " + fc.length + " bars" : ""}`}
            style={{ fontFamily: FONT }}
          >
            <defs>
              <clipPath id={`plot-${clipId}`}>
                <rect x={0} y={-M.top} width={innerW} height={HEIGHT} />
              </clipPath>
              <clipPath id={`reveal-${clipId}`}>
                <rect ref={revealRef} x={anchor ? x(anchor.i) : 0} y={-M.top} height={HEIGHT} width={1e6} />
              </clipPath>
            </defs>
            <g transform={`translate(${M.left},${M.top})`}>
              {/* grid + right price axis */}
              {y.ticks(6).map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x2={innerW} stroke={COLORS.line} />
                  <text x={innerW + 8} dy="0.32em" fontSize={11} fill={COLORS.ink3} className="tabular">
                    {fmt(t)}
                  </text>
                </g>
              ))}
              <line y1={volTop + volH} y2={volTop + volH} x2={innerW} stroke={COLORS.line} />
              {ticks.map((i) => (
                <text key={i} x={x(i)} y={plotH + 17} textAnchor="middle" fontSize={11} fill={COLORS.ink3}>
                  {times[i] != null ? TIME_FORMAT[interval](new Date(times[i])) : ""}
                </text>
              ))}

              <g clipPath={`url(#plot-${clipId})`}>
                {/* volume */}
                {visible.map((c, k) => {
                  const i = lo + k;
                  return (
                    <rect key={`v${i}`} x={x(i) - bodyW / 2} width={bodyW} y={volTop + yVol(c[5])} height={volH - yVol(c[5])} fill={COLORS.volume} />
                  );
                })}
                {/* candles */}
                {visible.map((c, k) => {
                  const i = lo + k;
                  const [, o, h, l, close] = c;
                  const color = close >= o ? COLORS.up : COLORS.down;
                  return (
                    <g key={`c${i}`}>
                      <line x1={x(i)} x2={x(i)} y1={y(h)} y2={y(l)} stroke={color} strokeWidth={1} />
                      <rect
                        x={x(i) - bodyW / 2}
                        width={bodyW}
                        y={y(Math.max(o, close))}
                        height={Math.max(1, Math.abs(y(o) - y(close)))}
                        rx={bodyW > 6 ? 1.5 : 0}
                        fill={color}
                      />
                    </g>
                  );
                })}

                {/* forecast */}
                {forecast && anchor && (
                  <>
                    <line x1={x(anchor.i + 0.5)} x2={x(anchor.i + 0.5)} y1={0} y2={plotH} stroke={COLORS.forecast} strokeDasharray="2 3" />
                    <text x={x(anchor.i + 0.5) + 6} y={12} fontSize={11} fill={COLORS.ink2}>
                      Forecast →
                    </text>
                    <g ref={pathsRef}>
                      {pathLines.map((p, k) => (
                        <path key={k} d={p} fill="none" stroke={COLORS.forecast} strokeWidth={1} />
                      ))}
                    </g>
                    <g clipPath={`url(#reveal-${clipId})`}>
                      <path d={area("p10", "p90")} fill={COLORS.forecast} fillOpacity={0.12} />
                      <path d={area("p25", "p75")} fill={COLORS.forecast} fillOpacity={0.16} />
                      <path d={medianLine} fill="none" stroke={COLORS.forecast} strokeWidth={2} strokeDasharray="6 4" />
                    </g>
                  </>
                )}
              </g>

              {/* crosshair */}
              {hover && (
                <g pointerEvents="none">
                  <line x1={x(hover.i)} x2={x(hover.i)} y1={0} y2={plotH} stroke="#c9c9c4" strokeDasharray="3 3" />
                  {hover.y <= priceH && (
                    <>
                      <line x2={innerW} y1={hover.y} y2={hover.y} stroke="#c9c9c4" strokeDasharray="3 3" />
                      <rect x={innerW + 2} y={hover.y - 9} width={M.right - 4} height={18} rx={4} fill={COLORS.ink} />
                      <text x={innerW + 8} y={hover.y} dy="0.32em" fontSize={11} fill="#fff" className="tabular">
                        {fmt(y.invert(hover.y))}
                      </text>
                    </>
                  )}
                </g>
              )}

              <rect
                ref={overlayRef}
                width={innerW}
                height={plotH}
                fill="transparent"
                style={{ cursor: "crosshair" }}
                onMouseMove={onMove}
                onMouseLeave={() => setHover(null)}
              />

              {/* validated pattern markers (above the zoom / hover layer so they stay clickable): ▲ bullish, ▼ bearish */}
              <g clipPath={`url(#plot-${clipId})`}>
                {chosen && (
                  <g pointerEvents="none">
                    {([["entry", chosen.sig.entry, COLORS.ink], ["stop", chosen.sig.stop, COLORS.down], ["target", chosen.sig.target, COLORS.up]] as const).map(
                      ([label, v, color]) => (
                        <g key={label}>
                          <line x1={x(chosen.i)} x2={x(chosen.endIdx + 0.5)} y1={y(v)} y2={y(v)} stroke={color} strokeWidth={1.5}
                            strokeDasharray={label === "entry" ? "4 3" : undefined} />
                          <text x={x(chosen.endIdx + 0.5) + 4} y={y(v)} dy="0.32em" fontSize={10} fill={COLORS.ink2}>
                            {label} {fmt(v)}
                          </text>
                        </g>
                      ),
                    )}
                  </g>
                )}
                {marks.map(({ sig, k, i }) => {
                  if (i < lo - 1 || i > hi + 1) return null;
                  const c = candles[i];
                  const up = sig.direction > 0;
                  const cy = up ? y(c[3]) + 12 : y(c[2]) - 12;
                  const size = k === selected ? 8 : 6;
                  const path = up ? `M0,${-size} L${size},${size} L${-size},${size} Z` : `M0,${size} L${size},${-size} L${-size},${-size} Z`;
                  return (
                    <path
                      key={k}
                      d={path}
                      transform={`translate(${x(i)},${cy})`}
                      fill={up ? COLORS.up : COLORS.down}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      style={{ cursor: onSelect ? "pointer" : undefined }}
                      onClick={() => onSelect?.(k)}
                    >
                      <title>{`${sig.pattern} (${sig.style.replace("_", "-")}) · ${up ? "bullish" : "bearish"}`}</title>
                    </path>
                  );
                })}
              </g>
            </g>
          </svg>
        )}

        {hovered && hover && (
          <div
            className="pointer-events-none absolute top-3 z-10 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-sm"
            style={tipLeft > width / 2 ? { right: width - tipLeft + 14 } : { left: tipLeft + 14 }}
          >
            <p className="text-ink-3">
              {times[hover.i] != null ? d3.utcFormat(interval === "1h" ? "%a %d %b %Y, %H:%M" : "%a %d %b %Y")(new Date(times[hover.i])) : ""}
            </p>
            {hovered.kind === "candle" ? (
              <div className="tabular mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span className="text-ink-3">Open</span><span>{fmt(hovered.c[1])}</span>
                <span className="text-ink-3">High</span><span>{fmt(hovered.c[2])}</span>
                <span className="text-ink-3">Low</span><span>{fmt(hovered.c[3])}</span>
                <span className="text-ink-3">Close</span><span className="font-semibold">{fmt(hovered.c[4])}</span>
                <span className="text-ink-3">Volume</span><span>{d3.format(",.0f")(hovered.c[5])}</span>
              </div>
            ) : (
              <div className="tabular mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span className="text-ink-3">Median</span><span className="font-semibold">{fmt(hovered.p.close)}</span>
                <span className="text-ink-3">50% range</span><span>{fmt(hovered.p.p25)} – {fmt(hovered.p.p75)}</span>
                <span className="text-ink-3">80% range</span><span>{fmt(hovered.p.p10)} – {fmt(hovered.p.p90)}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="px-1 pt-1 text-[11px] text-ink-3">Scroll to zoom · drag to pan</p>
    </div>
  );
}

function LegendSwatch({ kind, opacity = 1, label }: { kind: "line" | "band"; opacity?: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="10" aria-hidden="true">
        {kind === "line" ? (
          <line x1="0" x2="18" y1="5" y2="5" stroke={COLORS.forecast} strokeWidth="2" strokeDasharray="5 3" />
        ) : (
          <rect width="18" height="10" rx="2" fill={COLORS.forecast} fillOpacity={opacity} />
        )}
      </svg>
      {label}
    </span>
  );
}
