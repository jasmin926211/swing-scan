'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
} from 'lightweight-charts';
import type { CandleDataPoint } from './utils';

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
  height?: number;
}

export default function CandlestickChart({
  candles,
  priceLevels = [],
  emaOverlays = [],
  height = 500,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#1c2333' },
        horzLines: { color: '#1c2333' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: '#252d3a',
      },
      timeScale: {
        borderColor: '#252d3a',
        timeVisible: false,
      },
      autoSize: true,
    });

    chartRef.current = chart;

    // Candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    candlestickSeries.setData(
      candles.map(({ time, open, high, low, close }) => ({
        time,
        open,
        high,
        low,
        close,
      }))
    );

    // Price level annotations (entry, SL, targets)
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
      lineSeries.setData(ema.data);
    });

    // Volume histogram
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time,
        value: c.volume,
        color:
          c.close >= c.open
            ? 'rgba(34, 197, 94, 0.3)'
            : 'rgba(239, 68, 68, 0.3)',
      }))
    );

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, priceLevels, emaOverlays]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full"
      style={{ height }}
    />
  );
}
