export interface CandleDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Compute EMA line data from candle data for chart overlay.
 * Returns array of { time, value } points starting after the seed period.
 */
export function computeEMAForChart(
  candles: CandleDataPoint[],
  period: number
): { time: string; value: number }[] {
  const closes = candles.map((c) => c.close);
  const multiplier = 2 / (period + 1);
  const result: { time: string; value: number }[] = [];

  if (closes.length < period) return result;

  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i];
  }

  let ema = sum / period;
  result.push({ time: candles[period - 1].time, value: ema });

  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
    result.push({ time: candles[i].time, value: ema });
  }

  return result;
}
