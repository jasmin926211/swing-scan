"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useChartColors, FONT } from "@/lib/charts/theme";
import { duration, useReducedMotion } from "@/lib/charts/motion";

export const moodLabel = (m: number) => (m >= 0.65 ? "Strong" : m >= 0.45 ? "Mixed" : m >= 0.3 ? "Weak" : "Cautious");

/** A half-circle gauge whose needle swings to the market's mood (0 = weak, 1 = strong). */
export function MoodGauge({ value }: { value: number | null }) {
  const COLORS = useChartColors();
  const reduced = useReducedMotion();
  const needle = useRef<SVGGElement>(null);
  const prev = useRef(0.5);
  const W = 300, H = 160, R = 110; // wide enough for the 0 / 50 / 100 labels outside the arc
  const angle = (v: number) => -90 + v * 180;
  const arc = d3.arc<{ a0: number; a1: number }>().innerRadius(R - 18).outerRadius(R).cornerRadius(3)
    .startAngle((d) => (angle(d.a0) * Math.PI) / 180).endAngle((d) => (angle(d.a1) * Math.PI) / 180);
  const zones = [
    { a0: 0, a1: 0.3, c: COLORS.down },
    { a0: 0.3, a1: 0.45, c: COLORS.ema9 },
    { a0: 0.45, a1: 0.65, c: COLORS.ink3 },
    { a0: 0.65, a1: 1, c: COLORS.up },
  ];

  useEffect(() => {
    if (!needle.current || value == null) return;
    const from = prev.current;
    d3.select(needle.current)
      .transition().duration(duration(1200, reduced)).ease(d3.easeElasticOut.amplitude(1).period(0.5))
      .attrTween("transform", () => (t) => `rotate(${angle(from + (value - from) * t)})`);
    prev.current = value;
  }, [value, reduced]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full max-w-[320px]" role="img"
      aria-label={value == null ? "Market mood unavailable" : `Market mood ${Math.round(value * 100)} out of 100: ${moodLabel(value)}`}
      style={{ fontFamily: FONT }}>
      <g transform={`translate(${W / 2},${R + 22})`}>
        {zones.map((z) => <path key={z.a0} d={arc(z) ?? ""} fill={z.c} fillOpacity={0.85} />)}
        {[0, 0.5, 1].map((v) => (
          <text key={v} x={(R + 10) * Math.cos(((angle(v) - 90) * Math.PI) / 180)} y={(R + 10) * Math.sin(((angle(v) - 90) * Math.PI) / 180) + 4}
            fontSize={10} fill={COLORS.ink3} textAnchor={v === 0 ? "end" : v === 1 ? "start" : "middle"}>{v * 100}</text>
        ))}
        <g ref={needle} transform={`rotate(${angle(prev.current)})`}>
          <path d={`M -4 0 L 0 ${-(R - 26)} L 4 0 Z`} fill={COLORS.ink} />
        </g>
        <circle r={7} fill={COLORS.ink} />
        <circle r={3} fill={COLORS.paper} />
      </g>
    </svg>
  );
}
