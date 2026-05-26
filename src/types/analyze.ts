import type { PatternResult } from './pattern';
import type { FibonacciLevel, WeeklyTrend } from './stock';

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

export type RecommendationAction =
  | 'Strong Buy'
  | 'Buy'
  | 'Buy (with caution)'
  | 'Weak Buy'
  | 'Strong Sell'
  | 'Sell'
  | 'Sell (with caution)'
  | 'Weak Sell'
  | 'Hold';

export interface Recommendation {
  action: RecommendationAction;
  summary: string;
  suggestedTimeframe: string;
  bestPattern: PatternResult | null;
}

// ---------------------------------------------------------------------------
// Technical Indicator Summary (last-candle snapshot)
// ---------------------------------------------------------------------------

export interface IndicatorSnapshot {
  rsi: number;
  rsiZone: 'oversold' | 'neutral' | 'overbought';
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  emaAlignment: 'bullish' | 'bearish' | 'mixed';
  volumeRatio: number;
  atr: number;
  weeklyTrend: WeeklyTrend;
  supportLevels: number[];
  resistanceLevels: number[];
  fibonacciLevels: FibonacciLevel[];
  currentPrice: number;
}

// ---------------------------------------------------------------------------
// Full Analysis Response
// ---------------------------------------------------------------------------

export interface StockAnalysis {
  tradingSymbol: string;
  companyName: string;
  sector: string;
  currentPrice: number;
  recommendation: Recommendation;
  patterns: PatternResult[];
  indicators: IndicatorSnapshot;
  analyzedAt: string;
}
