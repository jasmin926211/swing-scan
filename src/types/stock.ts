export interface CandleData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OHLCV {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number; // Unix timestamp
}

export interface StockInfo {
  instrumentKey: string;
  tradingSymbol: string;
  companyName: string;
  isin: string;
  exchange: string;
  sector?: string;
}

export interface IndicatorData {
  ema9: number[];
  ema21: number[];
  ema50: number[];
  ema200: number[];
  rsi: number[];
  atr: number[];
  avgVolume: number;
  volumeRatios: number[];
  closes: number[];
  supportLevels: number[];
  resistanceLevels: number[];
  fibonacciLevels: FibonacciLevel[];
  weeklyTrend: WeeklyTrend;
}

export interface FibonacciLevel {
  ratio: number;     // 0.236, 0.382, 0.5, 0.618, 0.786
  price: number;
  label: string;     // "23.6%", "38.2%", etc.
}

export type WeeklyTrend = 'bullish' | 'bearish' | 'neutral';
