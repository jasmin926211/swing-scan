"use client";

import { useEffect, useRef, useState } from "react";
import type * as HighchartsNS from "highcharts";
import { COLORS, loadHighcharts, type Highcharts } from "@/lib/highcharts";

/** A plain (non-stock) Highcharts chart with the app's quiet light styling. */
export function Chart({ options, height = 260, label }: { options: (H: Highcharts) => HighchartsNS.Options; height?: number; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [H, setH] = useState<Highcharts | null>(null);

  useEffect(() => {
    loadHighcharts().then(setH);
  }, []);

  useEffect(() => {
    if (!H || !el.current) return;
    const o = options(H);
    const chart = H.chart(el.current, {
      ...o,
      chart: { backgroundColor: "#ffffff", style: { fontFamily: "inherit" }, spacing: [8, 4, 8, 4], ...o.chart },
      title: { text: undefined },
      credits: { enabled: false },
      accessibility: { description: label },
      legend: { align: "left", verticalAlign: "top", itemStyle: { color: COLORS.ink2, fontWeight: "400" }, ...o.legend },
      tooltip: { backgroundColor: "#ffffff", borderColor: COLORS.line, borderRadius: 8, shadow: false, ...o.tooltip },
      plotOptions: { series: { animation: false }, ...o.plotOptions },
    });
    return () => chart.destroy();
  }, [H, options, label]);

  return <div ref={el} style={{ height }} className="w-full" aria-label={label} />;
}
