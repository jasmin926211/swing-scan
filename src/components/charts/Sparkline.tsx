"use client";

import { useEffect, useId, useRef } from "react";
import * as d3 from "d3";
import { COLORS } from "@/lib/charts/theme";
import { duration, useReducedMotion } from "@/lib/charts/motion";

/** Small intraday line against the previous close (dashed). Green above it, red below; draws in on first load. */
export function Sparkline({ points, prevClose, width = 132, height = 40 }: {
  points: [number, number][]; prevClose: number | null; width?: number; height?: number;
}) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const lineRef = useRef<SVGPathElement>(null);
  const drawn = useRef(false);

  const values = points.map((p) => p[1]);
  const base = prevClose ?? values[0];
  const x = d3.scaleLinear().domain(d3.extent(points, (p) => p[0]) as [number, number]).range([1, width - 1]);
  const [lo, hi] = d3.extent([...values, base]) as [number, number];
  const y = d3.scaleLinear().domain([lo, hi === lo ? lo + 1 : hi]).range([height - 2, 2]);
  const up = (values[values.length - 1] ?? base) >= base;
  const color = up ? COLORS.up : COLORS.down;
  const line = d3.line<[number, number]>().x((p) => x(p[0])).y((p) => y(p[1])).curve(d3.curveMonotoneX)(points) ?? "";
  const area = d3.area<[number, number]>().x((p) => x(p[0])).y0(y(base)).y1((p) => y(p[1])).curve(d3.curveMonotoneX)(points) ?? "";

  useEffect(() => {
    if (!lineRef.current || drawn.current || points.length < 2) return;
    drawn.current = true; // only the first appearance animates; refreshes just update
    const len = lineRef.current.getTotalLength();
    d3.select(lineRef.current)
      .attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len)
      .transition().duration(duration(1100, reduced)).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0)
      .on("end", function () {
        d3.select(this).attr("stroke-dasharray", null);
      });
  }, [points, reduced]);

  if (points.length < 2) return <div style={{ width, height }} />;
  return (
    <svg width={width} height={height} aria-hidden="true">
      <defs>
        <linearGradient id={`g-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={up ? 0.22 : 0} />
          <stop offset="100%" stopColor={color} stopOpacity={up ? 0 : 0.22} />
        </linearGradient>
      </defs>
      <line x1={0} x2={width} y1={y(base)} y2={y(base)} stroke={COLORS.ink3} strokeDasharray="2 3" strokeWidth={1} />
      <path d={area} fill={`url(#g-${uid})`} />
      <path ref={lineRef} d={line} fill="none" stroke={color} strokeWidth={1.6} />
    </svg>
  );
}
