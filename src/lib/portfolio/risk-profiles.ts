import type { RiskProfile, RiskProfileConfig } from '@/types/portfolio';

export const RISK_PROFILES: Record<RiskProfile, RiskProfileConfig> = {
  conservative: {
    label: 'Conservative',
    description: 'Only highest-reliability patterns with strong confluence',
    maxTier: 1,
    minConfluence: 4,
    maxStocks: 5,
    maxRiskPerTrade: 0.05,
    maxSectorAllocation: 0.40,
    minRiskReward: 2.0,
  },
  moderate: {
    label: 'Moderate',
    description: 'Balanced mix of reliability and opportunity',
    maxTier: 2,
    minConfluence: 3,
    maxStocks: 10,
    maxRiskPerTrade: 0.06,
    maxSectorAllocation: 0.45,
    minRiskReward: 1.5,
  },
  aggressive: {
    label: 'Aggressive',
    description: 'Maximum opportunity across all pattern tiers',
    maxTier: 3,
    minConfluence: 2,
    maxStocks: 15,
    maxRiskPerTrade: 0.08,
    maxSectorAllocation: 0.50,
    minRiskReward: 1.2,
  },
};

/** Win rates by tier for expected return calculations */
export const WIN_RATES: Record<number, number> = {
  1: 0.62,
  2: 0.56,
  3: 0.50,
};

/** Investment horizon presets */
export const HORIZON_OPTIONS = [
  { value: 5 as const, label: '5 Days', description: 'Short-term momentum' },
  { value: 15 as const, label: '15 Days', description: 'Swing trade' },
  { value: 30 as const, label: '30 Days', description: 'Position trade' },
  { value: 60 as const, label: '60 Days', description: 'Medium-term hold' },
];
