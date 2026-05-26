import type {
  StockAllocation,
  PortfolioSummary,
  SectorDistribution,
} from '@/types/portfolio';
import { WIN_RATES } from './risk-profiles';

/**
 * Calculate expected returns for a single stock allocation.
 */
export function calculateStockReturns(stock: {
  tier: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  sharesToBuy: number;
  investedAmount: number;
}): { expectedReturnAmount: number; expectedReturnPercent: number; winRate: number } {
  const winRate = WIN_RATES[stock.tier] ?? 0.50;
  const gainPerShare = stock.target1 - stock.entryPrice;
  const lossPerShare = stock.entryPrice - stock.stopLoss;

  const expectedReturn =
    winRate * gainPerShare * stock.sharesToBuy -
    (1 - winRate) * lossPerShare * stock.sharesToBuy;

  return {
    expectedReturnAmount: Math.round(expectedReturn * 100) / 100,
    expectedReturnPercent:
      stock.investedAmount > 0 ? expectedReturn / stock.investedAmount : 0,
    winRate,
  };
}

/**
 * Compute sector distribution from allocations.
 */
export function computeSectorDistribution(
  allocations: StockAllocation[],
  totalInvestment: number,
): SectorDistribution[] {
  const map = new Map<string, { amount: number; count: number }>();

  for (const a of allocations) {
    const sector = a.sector || 'Other';
    const entry = map.get(sector) ?? { amount: 0, count: 0 };
    entry.amount += a.investedAmount;
    entry.count += 1;
    map.set(sector, entry);
  }

  return Array.from(map.entries())
    .map(([sector, { amount, count }]) => ({
      sector,
      allocationAmount: Math.round(amount * 100) / 100,
      allocationPercent: totalInvestment > 0 ? amount / totalInvestment : 0,
      stockCount: count,
    }))
    .sort((a, b) => b.allocationAmount - a.allocationAmount);
}

/**
 * Build the full PortfolioSummary from computed allocations.
 */
export function computePortfolioSummary(
  allocations: StockAllocation[],
  totalInvestment: number,
): PortfolioSummary {
  const actualInvested = allocations.reduce((s, a) => s + a.investedAmount, 0);
  const cashRemaining = totalInvestment - actualInvested;

  // Return projections
  const expectedReturnBest = allocations.reduce(
    (s, a) => s + a.sharesToBuy * (a.target1 - a.entryPrice),
    0,
  );
  const expectedReturnWorst = -allocations.reduce(
    (s, a) => s + a.sharesToBuy * (a.entryPrice - a.stopLoss),
    0,
  );
  const expectedReturnLikely = allocations.reduce(
    (s, a) => s + a.expectedReturnAmount,
    0,
  );

  // Risk metrics
  const totalRiskAmount = allocations.reduce((s, a) => s + a.riskAmount, 0);
  const maxSingleStockRisk = allocations.length > 0
    ? Math.max(...allocations.map((a) => a.riskAmount))
    : 0;

  const totalWeight = allocations.reduce((s, a) => s + a.investedAmount, 0) || 1;
  const averageRiskReward =
    allocations.reduce((s, a) => s + a.riskRewardRatio * a.investedAmount, 0) /
    totalWeight;
  const averageSignalStrength =
    allocations.reduce((s, a) => s + a.signalStrength * a.investedAmount, 0) /
    totalWeight;
  const averageConfluence =
    allocations.reduce((s, a) => s + a.confluenceScore * a.investedAmount, 0) /
    totalWeight;

  // Distributions
  const sectorDistribution = computeSectorDistribution(allocations, totalInvestment);

  const tierCounts = new Map<number, number>();
  for (const a of allocations) {
    tierCounts.set(a.tier, (tierCounts.get(a.tier) ?? 0) + 1);
  }
  const tierDistribution = Array.from(tierCounts.entries())
    .map(([tier, count]) => ({
      tier,
      count,
      percent: allocations.length > 0 ? count / allocations.length : 0,
    }))
    .sort((a, b) => a.tier - b.tier);

  return {
    totalInvestment,
    actualInvested: Math.round(actualInvested * 100) / 100,
    cashRemaining: Math.round(cashRemaining * 100) / 100,
    stockCount: allocations.length,

    expectedReturnBest: Math.round(expectedReturnBest * 100) / 100,
    expectedReturnLikely: Math.round(expectedReturnLikely * 100) / 100,
    expectedReturnWorst: Math.round(expectedReturnWorst * 100) / 100,
    expectedReturnBestPercent: actualInvested > 0 ? expectedReturnBest / actualInvested : 0,
    expectedReturnLikelyPercent: actualInvested > 0 ? expectedReturnLikely / actualInvested : 0,
    expectedReturnWorstPercent: actualInvested > 0 ? expectedReturnWorst / actualInvested : 0,

    totalRiskAmount: Math.round(totalRiskAmount * 100) / 100,
    totalRiskPercent: totalInvestment > 0 ? totalRiskAmount / totalInvestment : 0,
    maxSingleStockRisk: Math.round(maxSingleStockRisk * 100) / 100,
    maxSingleStockRiskPercent: totalInvestment > 0 ? maxSingleStockRisk / totalInvestment : 0,
    averageRiskReward: Math.round(averageRiskReward * 100) / 100,
    averageSignalStrength: Math.round(averageSignalStrength * 1000) / 1000,
    averageConfluence: Math.round(averageConfluence * 10) / 10,

    sectorDistribution,
    tierDistribution,
  };
}
