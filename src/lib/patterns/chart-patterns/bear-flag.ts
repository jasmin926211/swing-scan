import type { CandleData, IndicatorData } from '@/types/stock';
import type { PatternResult, PatternDetector } from '@/types/pattern';
import { detectFlag } from './flag-core';

/**
 * **Bear Flag** — bearish continuation.
 * A sharp downward flagpole (on heavy volume) followed by a shallow upward/sideways
 * consolidation, then a CONFIRMED close below the flag's lower boundary.
 * See flag-core.ts for the shared, index-consistent implementation.
 */
export const bearFlagDetector: PatternDetector = {
  name: 'bear_flag',
  category: 'chart',
  detect(candles: CandleData[], indicators: IndicatorData): PatternResult {
    return detectFlag(candles, indicators, 'bearish');
  },
};
