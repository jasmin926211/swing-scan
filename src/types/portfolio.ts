// ---------------------------------------------------------------------------
// Portfolio Optimizer types
// ---------------------------------------------------------------------------

export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';

export type InvestmentHorizon = 5 | 15 | 30 | 60;

/** API request body */
export interface PortfolioOptimizeRequest {
  amount: number;
  days: InvestmentHorizon;
  riskProfile: RiskProfile;
}

/** Configuration for each risk profile */
export interface RiskProfileConfig {
  label: string;
  description: string;
  maxTier: 1 | 2 | 3;
  minConfluence: number;
  maxStocks: number;
  maxRiskPerTrade: number;
  maxSectorAllocation: number;
  minRiskReward: number;
}

/** A single stock in the optimized portfolio */
export interface StockAllocation {
  rank: number;
  tradingSymbol: string;
  companyName: string;
  sector: string;
  patternName: string;
  patternCategory: string;
  direction: string;
  tier: number;
  confluenceScore: number;

  compositeScore: number;
  signalStrength: number;

  allocationAmount: number;
  allocationPercent: number;
  sharesToBuy: number;
  investedAmount: number;

  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number | null;
  riskRewardRatio: number;

  riskAmount: number;
  riskPercent: number;

  expectedReturnAmount: number;
  expectedReturnPercent: number;
  winRate: number;
}

export interface SectorDistribution {
  sector: string;
  allocationAmount: number;
  allocationPercent: number;
  stockCount: number;
}

export interface PortfolioSummary {
  totalInvestment: number;
  actualInvested: number;
  cashRemaining: number;
  stockCount: number;

  expectedReturnBest: number;
  expectedReturnLikely: number;
  expectedReturnWorst: number;
  expectedReturnBestPercent: number;
  expectedReturnLikelyPercent: number;
  expectedReturnWorstPercent: number;

  totalRiskAmount: number;
  totalRiskPercent: number;
  maxSingleStockRisk: number;
  maxSingleStockRiskPercent: number;
  averageRiskReward: number;
  averageSignalStrength: number;
  averageConfluence: number;

  sectorDistribution: SectorDistribution[];
  tierDistribution: { tier: number; count: number; percent: number }[];
}

export interface OptimizedPortfolio {
  request: PortfolioOptimizeRequest;
  summary: PortfolioSummary;
  allocations: StockAllocation[];
  generatedAt: string;
  scanSessionId: string;
}
