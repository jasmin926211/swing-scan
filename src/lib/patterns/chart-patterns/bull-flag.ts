import type { CandleData, IndicatorData } from '@/types/stock';
import type { PatternResult, PatternDetector } from '@/types/pattern';
import { detectFlag } from './flag-core';

/**
 * **Bull Flag** — bullish continuation.
 * A sharp upward flagpole (on heavy volume) followed by a shallow downward/sideways
 * consolidation, then a CONFIRMED close above the flag's upper boundary.
 * See flag-core.ts for the shared, index-consistent implementation.
 */
export const bullFlagDetector: PatternDetector = {
  name: 'bull_flag',
  category: 'chart',
  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    return detectFlag(candles, indicators, 'bullish');
  },
};
