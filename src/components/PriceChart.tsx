"use client";

import { useEffect, useRef, useState } from "react";
import type * as HighchartsNS from "highcharts";
import type { Candle, Forecast, Interval } from "@/lib/api";
import { loadHighcharts, type Highcharts } from "@/lib/highcharts";

// Validated reference palette (light surface): up = aqua, down = red, Kronos = blue.
const UP = "#1baf7a";
const DOWN = "#e34948";
const KRONOS = "#2a78d6";
const INK_2 = "#52514e";
const INK_3 = "#8a8983";
const LINE = "#ebebe8";

const DAY = 24 * 3600 * 1000;
const VISIBLE: Record<Interval, number> = { "1h": 30 * DAY, "1d": 182 * DAY, "1wk": 3 * 365 * DAY };
const RANGES: Record<Interval, HighchartsNS.RangeSelectorButtonsOptions[]> = {
  "1h": [
    { type: "day", count: 5, text: "5D" },
    { type: "month", count: 1, text: "1M" },
    { type: "month", count: 3, text: "3M" },
    { type: "all", text: "All" },
  ],
  "1d": [
    { type: "month", count: 1, text: "1M" },
    { type: "month", count: 3, text: "3M" },
    { type: "month", count: 6, text: "6M" },
    { type: "year", count: 1, text: "1Y" },
    { type: "year", count: 3, text: "3Y" },
    { type: "all", text: "All" },
  ],
  "1wk": [
    { type: "year", count: 1, text: "1Y" },
    { type: "year", count: 3, text: "3Y" },
    { type: "year", count: 5, text: "5Y" },
    { type: "all", text: "All" },
  ],
};

export function PriceChart({
  candles,
  interval,
  forecast,
  showPaths,
  decimals,
}: {
  candles: Candle[];
  interval: Interval;
  forecast: Forecast | null;
  showPaths: boolean;
  decimals: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [H, setH] = useState<Highcharts | null>(null);

  useEffect(() => {
    loadHighcharts().then(setH);
  }, []);

  useEffect(() => {
    if (!H || !el.current || candles.length === 0) return;

    const ohlc = candles.map(([t, o, h, l, c]) => [t, o, h, l, c]);
    const volume = candles.map(([t, , , , , v]) => [t, v]);
    const series: HighchartsNS.SeriesOptionsType[] = [
      {
        type: "candlestick",
        id: "price",
        name: "Price",
        data: ohlc,
        color: DOWN,
        lineColor: DOWN,
        upColor: UP,
        upLineColor: UP,
        dataGrouping: { enabled: false },
      },
      {
        type: "column",
        name: "Volume",
        data: volume,
        yAxis: 1,
        color: "#d9d9d5",
        borderWidth: 0,
        dataGrouping: { enabled: false },
      },
    ];

    if (forecast) {
      // Start every forecast series at the last real close so it visibly continues the price.
      const last = forecast.summary.last_close;
      const anchor = forecast.as_of;
      const pts = forecast.points;
      if (showPaths) {
        forecast.paths.forEach((path, i) =>
          series.push({
            type: "line",
            name: `Path ${i + 1}`,
            data: [[anchor, last], ...path.map((c, j) => [pts[j].time, c])],
            color: KRONOS,
            opacity: 0.18,
            lineWidth: 1,
            enableMouseTracking: false,
            showInLegend: false,
            dataGrouping: { enabled: false },
          }),
        );
      }
      series.push(
        {
          type: "arearange",
          name: "Kronos 80% range",
          data: [[anchor, last, last], ...pts.map((p) => [p.time, p.p10, p.p90])],
          color: KRONOS,
          fillOpacity: 0.12,
          lineWidth: 0,
          marker: { enabled: false },
          dataGrouping: { enabled: false },
        },
        {
          type: "arearange",
          name: "Kronos 50% range",
          data: [[anchor, last, last], ...pts.map((p) => [p.time, p.p25, p.p75])],
          color: KRONOS,
          fillOpacity: 0.2,
          lineWidth: 0,
          marker: { enabled: false },
          dataGrouping: { enabled: false },
        },
        {
          type: "line",
          name: "Kronos median",
          data: [[anchor, last], ...pts.map((p) => [p.time, p.close])],
          color: KRONOS,
          lineWidth: 2,
          dashStyle: "ShortDash",
          marker: { enabled: false, radius: 4 },
          dataGrouping: { enabled: false },
        },
      );
    }

    const fmt = (v: number) => H.numberFormat(v, decimals);
    const intraday = interval === "1h";

    const chart = H.stockChart(el.current, {
      chart: { backgroundColor: "#ffffff", style: { fontFamily: "inherit" }, spacing: [8, 4, 8, 4] },
      credits: { enabled: false },
      time: { timezone: "UTC" }, // backend sends exchange-local wall time as UTC
      accessibility: { description: "Candlestick price chart with volume and Kronos forecast" },
      rangeSelector: {
        buttons: RANGES[interval],
        inputEnabled: false,
        buttonTheme: {
          fill: "none",
          stroke: "none",
          r: 6,
          style: { color: INK_2, fontWeight: "500" },
          states: { hover: { fill: "#f7f7f5" }, select: { fill: "#0b0b0b", style: { color: "#ffffff" } } },
        },
        labelStyle: { display: "none" },
      },
      navigator: {
        height: 32,
        outlineColor: LINE,
        maskFill: "rgba(42,120,214,0.06)",
        series: { type: "line", color: INK_3, lineWidth: 1, fillOpacity: 0 },
        xAxis: { gridLineColor: LINE, labels: { style: { color: INK_3, textOutline: "none", opacity: 1 } } },
      },
      scrollbar: { enabled: false },
      legend: {
        enabled: !!forecast,
        align: "left",
        verticalAlign: "top",
        itemStyle: { color: INK_2, fontWeight: "400" },
      },
      xAxis: {
        lineColor: LINE,
        tickColor: LINE,
        labels: { style: { color: INK_3 } },
        crosshair: { color: "#c9c9c4", dashStyle: "Dash" },
        plotLines: forecast
          ? [{ value: forecast.as_of, color: KRONOS, width: 1, dashStyle: "Dot", label: { text: "Forecast →", style: { color: KRONOS }, y: 14, x: 4, rotation: 0 } }]
          : [],
      },
      yAxis: [
        {
          height: "76%",
          gridLineColor: LINE,
          labels: { align: "left", x: 6, style: { color: INK_3 } },
          crosshair: { color: "#c9c9c4", dashStyle: "Dash", label: { enabled: true, backgroundColor: "#0b0b0b", format: `{value:.${decimals}f}` } },
        },
        {
          top: "80%",
          height: "20%",
          offset: 0,
          gridLineWidth: 0,
          labels: { align: "left", x: 6, style: { color: INK_3 } },
          title: { text: "Volume", style: { color: INK_3, fontWeight: "400" } },
        },
      ],
      tooltip: {
        split: false,
        shared: true,
        backgroundColor: "#ffffff",
        borderColor: LINE,
        borderRadius: 8,
        shadow: false,
        useHTML: true,
        formatter: function () {
          const ctx = this as unknown as { x: number; points?: Array<{ series: { name: string; type: string }; point: HighchartsNS.Point & { open?: number; high?: number; low?: number; close?: number } }> };
          const when = H.dateFormat(intraday ? "%a %e %b %Y, %H:%M" : "%a %e %b %Y", ctx.x);
          const rows = (ctx.points ?? []).map(({ series: s, point: p }) => {
            if (s.type === "candlestick")
              return `O ${fmt(p.open!)} · H ${fmt(p.high!)} · L ${fmt(p.low!)} · <b>C ${fmt(p.close!)}</b>`;
            if (s.type === "arearange") return `${s.name}: ${fmt(p.low!)} – ${fmt(p.high!)}`;
            if (s.name === "Volume") return `Volume ${H.numberFormat(p.y!, 0)}`;
            return `<b>${s.name}: ${fmt(p.y!)}</b>`;
          });
          return `<div style="font-size:12px;line-height:1.6"><div style="color:${INK_3}">${when}</div>${rows.join("<br/>")}</div>`;
        },
      },
      plotOptions: { series: { animation: false, states: { inactive: { enabled: false } } } },
      series,
    });

    const lastReal = candles[candles.length - 1][0];
    const end = forecast ? forecast.points[forecast.points.length - 1].time : lastReal;
    chart.xAxis[0].setExtremes(Math.max(candles[0][0], lastReal - VISIBLE[interval]), end, true, false);

    return () => chart.destroy();
  }, [H, candles, interval, forecast, showPaths, decimals]);

  return <div ref={el} className="h-[520px] w-full" aria-label="Price chart" />;
}
