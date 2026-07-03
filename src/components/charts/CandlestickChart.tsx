'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type Time,
  type SeriesMarker,
} from 'lightweight-charts';
import type { CandleDataPoint } from './utils';
import type { PatternOverlay } from '@/lib/patterns/overlay';

interface PriceLevel {
  price: number;
  color: string;
  label: string;
}

interface EMAOverlay {
  period: number;
  color: string;
  data: { time: string; value: number }[];
}

interface CandlestickChartProps {
  candles: CandleDataPoint[];
  priceLevels?: PriceLevel[];
  emaOverlays?: EMAOverlay[];
  /** Pattern shapes to draw as "proof" — lines, markers, and hover criteria. */
  patternOverlays?: PatternOverlay[];
  height?: number;
}

// Theme (matches the app's dark indigo palette).
const THEME = {
  bg: '#1B193D',
  grid: '#262350',
  text: '#8B89B8',
  border: '#312F62',
  up: '#4CFA9D',
  down: '#E3507A',
  upWick: '#3AD888',
  downWick: '#E3507A',
};

export default function CandlestickChart({
  candles,
  priceLevels = [],
  emaOverlays = [],
  patternOverlays = [],
  height = 500,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: THEME.bg },
        textColor: THEME.text,
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      },
      grid: {
        vertLines: { color: THEME.grid },
        horzLines: { color: THEME.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: THEME.border },
      timeScale: { borderColor: THEME.border, timeVisible: false },
      autoSize: true,
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: THEME.up,
      downColor: THEME.down,
      borderUpColor: THEME.up,
      borderDownColor: THEME.down,
      wickUpColor: THEME.upWick,
      wickDownColor: THEME.downWick,
    });

    candlestickSeries.setData(
      candles.map(({ time, open, high, low, close }) => ({ time: time as Time, open, high, low, close }))
    );

    // Trade-level price lines (entry, SL, targets)
    priceLevels.forEach((level) => {
      candlestickSeries.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: level.label,
      });
    });

    // EMA overlays
    emaOverlays.forEach((ema) => {
      const lineSeries = chart.addLineSeries({
        color: ema.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      lineSeries.setData(ema.data.map((d) => ({ time: d.time as Time, value: d.value })));
    });

    // ---- Pattern overlays: draw shape lines + pivot markers ("proof") ----
    const markers: SeriesMarker<Time>[] = [];
    patternOverlays.forEach((ov) => {
      ov.lines.forEach((line) => {
        if (line.points.length < 2) return;
        const series = chart.addLineSeries({
          color: line.color,
          lineWidth: (line.width ?? 2) as 1 | 2 | 3 | 4,
          lineStyle: line.dashed ? LineStyle.Dashed : LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        // De-dupe/ascending by time (lightweight-charts requires strictly ascending)
        const seen = new Set<string>();
        const data = line.points
          .filter((p) => (seen.has(p.time) ? false : (seen.add(p.time), true)))
          .sort((a, b) => (a.time < b.time ? -1 : 1))
          .map((p) => ({ time: p.time as Time, value: p.price }));
        series.setData(data);
      });
      ov.markers.forEach((m) => {
        markers.push({ time: m.time as Time, position: m.position, color: m.color, shape: m.shape, text: m.text });
      });
    });
    if (markers.length > 0) {
      markers.sort((a, b) => ((a.time as string) < (b.time as string) ? -1 : 1));
      candlestickSeries.setMarkers(markers);
    }

    // ---- Hover tooltip: show the pattern name + criteria when over its span ----
    const tooltip = tooltipRef.current;
    if (tooltip && patternOverlays.length > 0) {
      chart.subscribeCrosshairMove((param) => {
        const time = param.time as string | undefined;
        if (!time || !param.point || param.point.x < 0 || param.point.y < 0) {
          tooltip.style.display = 'none';
          return;
        }
        const hit = patternOverlays.find(
          (ov) => (!ov.fromTime || time >= ov.fromTime) && (!ov.toTime || time <= ov.toTime)
        );
        if (!hit) {
          tooltip.style.display = 'none';
          return;
        }
        const dirColor = hit.direction === 'bearish' ? THEME.down : hit.direction === 'bullish' ? THEME.up : '#53B9EA';
        const rows = hit.criteria
          .map(
            (c) =>
              `<div style="display:flex;gap:6px;align-items:center;font-size:11px;line-height:1.5">
                 <span style="color:${c.passed ? THEME.up : THEME.down};width:11px">${c.passed ? '✓' : '✗'}</span>
                 <span style="color:${c.passed ? '#CFCEEA' : '#8B89B8'}">${c.label}</span>
               </div>`
          )
          .join('');
        tooltip.innerHTML = `
          <div style="font-weight:700;color:${dirColor};font-size:13px;margin-bottom:2px">${hit.displayName}</div>
          <div style="font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#8B89B8;margin-bottom:8px">${hit.direction} signal</div>
          ${rows}`;
        tooltip.style.display = 'block';
        const c = chartContainerRef.current!;
        let left = param.point.x + 16;
        if (left > c.clientWidth - 200) left = param.point.x - 200;
        tooltip.style.left = `${Math.max(8, left)}px`;
        tooltip.style.top = `12px`;
      });
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, priceLevels, emaOverlays, patternOverlays]);

  return (
    <div ref={chartContainerRef} className="relative w-full" style={{ height }}>
      <div
        ref={tooltipRef}
        style={{
          display: 'none',
          position: 'absolute',
          zIndex: 20,
          maxWidth: 240,
          pointerEvents: 'none',
          background: 'rgba(15,13,40,0.94)',
          border: '1px solid #312F62',
          borderRadius: 10,
          padding: '10px 12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
}
