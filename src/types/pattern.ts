import { CandleData, IndicatorData } from './stock';

export type PatternDirection = 'bullish' | 'bearish' | 'neutral';
export type PatternCategory = 'chart' | 'candlestick' | 'crossover';
export type PatternTier = 1 | 2 | 3;

export interface PatternResult {
  detected: boolean;
  patternName: string;
  category: PatternCategory;
  direction: PatternDirection;
  signalStrength: number;  // 0.0 to 1.0
  confidence: number;      // 0.0 to 1.0
  tier?: PatternTier;      // 1 = high reliability, 2 = medium, 3 = low (filled by enrichResult)
  entryPrice: number | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  riskRewardRatio: number | null;
  confluenceScore?: number; // 0-5 checklist score (filled by enrichResult)
  confluenceDetails?: ConfluenceDetails; // (filled by enrichResult)
  patternData: Record<string, unknown>;
}

/** Fully enriched result after runAllPatterns processing */
export interface EnrichedPatternResult extends PatternResult {
  tier: PatternTier;
  confluenceScore: number;
  confluenceDetails: ConfluenceDetails;
}

export interface ConfluenceDetails {
  dailyPattern: boolean;          // Pattern on daily chart
  volumeConfirmed: boolean;       // Volume >= 1.5x average
  atKeyLevel: boolean;            // At support/resistance or Fibonacci level
  weeklyTrendAligned: boolean;    // Weekly trend agrees with direction
  rsiConfirmed: boolean;          // RSI confirms oversold/overbought
}

export interface PatternDetector {
  name: string;
  category: PatternCategory;
  tier?: PatternTier; // Optional — enrichResult fills from PATTERN_TIERS if missing
  detect(candles: CandleData[], indicators: IndicatorData): PatternResult;
}

export const PATTERN_NAMES = {
  // Tier 1 - Chart
  BULL_FLAG: 'bull_flag',
  BEAR_FLAG: 'bear_flag',
  ASCENDING_TRIANGLE: 'ascending_triangle',
  DESCENDING_TRIANGLE: 'descending_triangle',
  CUP_AND_HANDLE: 'cup_and_handle',
  // Tier 2 - Reversal
  DOUBLE_BOTTOM: 'double_bottom',
  DOUBLE_TOP: 'double_top',
  INVERSE_HEAD_SHOULDERS: 'inverse_head_and_shoulders',
  HEAD_SHOULDERS: 'head_and_shoulders',
  FALLING_WEDGE: 'falling_wedge',
  // Tier 3 - Continuation
  RISING_WEDGE: 'rising_wedge',
  RECTANGLE_BREAKOUT: 'rectangle_breakout',
  CHANNEL_BREAKOUT: 'channel_breakout',
  CHANNEL_BREAKDOWN: 'channel_breakdown',
  ROUNDING_BOTTOM: 'rounding_bottom',
  // Tier 1 - Candlestick (High Reliability)
  BULLISH_ENGULFING: 'bullish_engulfing',
  BEARISH_ENGULFING: 'bearish_engulfing',
  MORNING_STAR: 'morning_star',
  EVENING_STAR: 'evening_star',
  THREE_WHITE_SOLDIERS: 'three_white_soldiers',
  THREE_BLACK_CROWS: 'three_black_crows',
  HAMMER: 'hammer',
  SHOOTING_STAR: 'shooting_star',
  // Tier 2 - Candlestick (Medium Reliability)
  PIERCING_LINE: 'piercing_line',
  DARK_CLOUD_COVER: 'dark_cloud_cover',
  BULLISH_HARAMI: 'bullish_harami',
  BEARISH_HARAMI: 'bearish_harami',
  TWEEZER_BOTTOM: 'tweezer_bottom',
  TWEEZER_TOP: 'tweezer_top',
  INSIDE_BAR: 'inside_bar',
  // Tier 3 - Advanced
  SYMMETRICAL_TRIANGLE: 'symmetrical_triangle',
  BROADENING_WEDGE: 'broadening_wedge',
  GAP_BREAKOUT: 'gap_breakout',
  MEASURED_MOVE: 'measured_move',
  // Crossovers
  EMA_CROSSOVER_9_21: 'ema_crossover_9_21',
  EMA_CROSSOVER_20_50: 'ema_crossover_20_50',
  GOLDEN_CROSS: 'golden_cross',
  DEATH_CROSS: 'death_cross',
} as const;

export const PATTERN_DISPLAY_NAMES: Record<string, string> = {
  bull_flag: 'Bull Flag',
  bear_flag: 'Bear Flag',
  ascending_triangle: 'Ascending Triangle',
  descending_triangle: 'Descending Triangle',
  cup_and_handle: 'Cup & Handle',
  double_bottom: 'Double Bottom',
  double_top: 'Double Top',
  inverse_head_and_shoulders: 'Inverse Head & Shoulders',
  head_and_shoulders: 'Head & Shoulders',
  falling_wedge: 'Falling Wedge',
  rising_wedge: 'Rising Wedge',
  rectangle_breakout: 'Rectangle Breakout',
  channel_breakout: 'Channel Breakout',
  channel_breakdown: 'Channel Breakdown',
  rounding_bottom: 'Rounding Bottom',
  bullish_engulfing: 'Bullish Engulfing',
  bearish_engulfing: 'Bearish Engulfing',
  morning_star: 'Morning Star',
  evening_star: 'Evening Star',
  three_white_soldiers: 'Three White Soldiers',
  three_black_crows: 'Three Black Crows',
  hammer: 'Hammer',
  shooting_star: 'Shooting Star',
  piercing_line: 'Piercing Line',
  dark_cloud_cover: 'Dark Cloud Cover',
  bullish_harami: 'Bullish Harami',
  bearish_harami: 'Bearish Harami',
  tweezer_bottom: 'Tweezer Bottom',
  tweezer_top: 'Tweezer Top',
  inside_bar: 'Inside Bar',
  symmetrical_triangle: 'Symmetrical Triangle',
  broadening_wedge: 'Broadening Wedge',
  gap_breakout: 'Gap Breakout',
  measured_move: 'Measured Move',
  ema_crossover_9_21: 'EMA Crossover (9/21)',
  ema_crossover_20_50: 'EMA Crossover (20/50)',
  golden_cross: 'Golden Cross',
  death_cross: 'Death Cross',
};

/** Pattern tier metadata: reliability rating and expected win rate range */
export const PATTERN_TIERS: Record<string, { tier: PatternTier; winRate: string; description: string }> = {
  // Tier 1 — High confidence, trade regularly (60-65% win rate with volume)
  bullish_engulfing: { tier: 1, winRate: '60-65%', description: 'Strong bullish reversal after downtrend' },
  bearish_engulfing: { tier: 1, winRate: '60-65%', description: 'Strong bearish reversal after uptrend' },
  morning_star: { tier: 1, winRate: '60-65%', description: 'Three-candle bullish reversal' },
  evening_star: { tier: 1, winRate: '60-65%', description: 'Three-candle bearish reversal' },
  hammer: { tier: 1, winRate: '60-65%', description: 'Single-candle bullish reversal at support' },
  shooting_star: { tier: 1, winRate: '60-65%', description: 'Single-candle bearish reversal at resistance' },
  three_white_soldiers: { tier: 1, winRate: '60-65%', description: 'Strong bullish continuation/reversal' },
  three_black_crows: { tier: 1, winRate: '60-65%', description: 'Strong bearish continuation/reversal' },
  bull_flag: { tier: 1, winRate: '63-68%', description: 'Bullish continuation after strong move' },
  bear_flag: { tier: 1, winRate: '63-68%', description: 'Bearish continuation after strong move' },
  // Tier 2 — Good with confluence
  piercing_line: { tier: 2, winRate: '52-58%', description: 'Bullish reversal, needs S/R confirmation' },
  dark_cloud_cover: { tier: 2, winRate: '52-58%', description: 'Bearish reversal, needs S/R confirmation' },
  bullish_harami: { tier: 2, winRate: '50-55%', description: 'Potential bullish reversal, weaker signal' },
  bearish_harami: { tier: 2, winRate: '50-55%', description: 'Potential bearish reversal, weaker signal' },
  tweezer_bottom: { tier: 2, winRate: '53-58%', description: 'Double bottom at same level' },
  tweezer_top: { tier: 2, winRate: '53-58%', description: 'Double top at same level' },
  inside_bar: { tier: 2, winRate: '55-60%', description: 'Consolidation breakout signal' },
  ascending_triangle: { tier: 2, winRate: '58-63%', description: 'Bullish continuation with flat resistance' },
  descending_triangle: { tier: 2, winRate: '58-63%', description: 'Bearish continuation with flat support' },
  cup_and_handle: { tier: 2, winRate: '58-63%', description: 'Bullish continuation after rounded bottom' },
  double_bottom: { tier: 2, winRate: '55-60%', description: 'Bullish reversal at equal lows' },
  double_top: { tier: 2, winRate: '55-60%', description: 'Bearish reversal at equal highs' },
  head_and_shoulders: { tier: 2, winRate: '55-60%', description: 'Bearish reversal with neckline break' },
  inverse_head_and_shoulders: { tier: 2, winRate: '55-60%', description: 'Bullish reversal with neckline break' },
  falling_wedge: { tier: 2, winRate: '55-60%', description: 'Bullish breakout from converging downtrend' },
  golden_cross: { tier: 2, winRate: '55-60%', description: 'Long-term bullish trend confirmation' },
  death_cross: { tier: 2, winRate: '55-60%', description: 'Long-term bearish trend confirmation' },
  // Tier 3 — Early warnings only
  rising_wedge: { tier: 3, winRate: '48-53%', description: 'Bearish breakdown, often false signals' },
  rectangle_breakout: { tier: 3, winRate: '50-55%', description: 'Range breakout, direction uncertain' },
  channel_breakout: { tier: 3, winRate: '50-55%', description: 'Channel break, needs confirmation' },
  channel_breakdown: { tier: 3, winRate: '50-55%', description: 'Channel break down, needs confirmation' },
  rounding_bottom: { tier: 3, winRate: '50-55%', description: 'Slow bullish reversal' },
  symmetrical_triangle: { tier: 3, winRate: '48-53%', description: 'Neutral, direction uncertain until break' },
  broadening_wedge: { tier: 3, winRate: '45-50%', description: 'Expanding volatility, unreliable' },
  gap_breakout: { tier: 3, winRate: '50-55%', description: 'Gap-based breakout' },
  measured_move: { tier: 3, winRate: '50-55%', description: 'Parallel price legs' },
  ema_crossover_9_21: { tier: 3, winRate: '48-53%', description: 'Short-term trend shift' },
  ema_crossover_20_50: { tier: 3, winRate: '50-55%', description: 'Medium-term trend shift' },
};
