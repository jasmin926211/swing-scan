import type {
  PortfolioOptimizeRequest,
  OptimizedPortfolio,
  StockAllocation,
  InvestmentHorizon,
} from '@/types/portfolio';
import { getLatestScanResults } from '@/lib/scanner/engine';
import { RISK_PROFILES } from './risk-profiles';
import { calculateStockReturns, computePortfolioSummary } from './returns';

// ---------------------------------------------------------------------------
// Types for internal processing
// ---------------------------------------------------------------------------

interface ScanStock {
  tradingSymbol: string;
  companyName: string;
  sector: string;
  patternName: string;
  patternCategory: string;
  direction: string;
  tier: number;
  confluenceScore: number;
  signalStrength: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number | null;
  riskRewardRatio: number;
  currentPrice: number;
}

interface ScoredStock extends ScanStock {
  compositeScore: number;
  stopLossDistancePct: number;
}

// ---------------------------------------------------------------------------
// Phase 1: Filter eligible stocks
// ---------------------------------------------------------------------------

function filterEligible(
  results: ScanStock[],
  request: PortfolioOptimizeRequest,
): ScanStock[] {
  const profile = RISK_PROFILES[request.riskProfile];

  return results.filter((s) => {
    if (s.direction !== 'bullish') return false;
    if (s.tier > profile.maxTier) return false;
    if (s.confluenceScore < profile.minConfluence) return false;
    if (s.riskRewardRatio < profile.minRiskReward) return false;
    if (s.entryPrice <= 0 || s.stopLoss <= 0 || s.target1 <= 0) return false;
    if (s.stopLoss >= s.entryPrice) return false; // invalid setup
    return true;
  });
}

// ---------------------------------------------------------------------------
// Phase 2: Composite score (0-100)
// ---------------------------------------------------------------------------

function horizonAlignment(
  category: string,
  days: InvestmentHorizon,
): number {
  if (days <= 5) {
    if (category === 'candlestick') return 15;
    if (category === 'crossover') return 10;
    return 5;
  }
  if (days <= 15) {
    if (category === 'candlestick') return 12;
    if (category === 'crossover') return 12;
    return 10;
  }
  if (days <= 30) {
    if (category === 'chart') return 15;
    if (category === 'crossover') return 12;
    return 8;
  }
  // 60 days
  if (category === 'chart') return 15;
  if (category === 'crossover') return 13;
  return 5;
}

const TIER_SCORE: Record<number, number> = { 1: 20, 2: 13, 3: 7 };

function computeCompositeScore(stock: ScanStock, days: InvestmentHorizon): number {
  const signalScore = (stock.signalStrength / 0.95) * 30;
  const tierScore = TIER_SCORE[stock.tier] ?? 7;
  const confluenceScorePart = (stock.confluenceScore / 5) * 20;
  const rrScore = Math.min(stock.riskRewardRatio / 4, 1) * 15;
  const horizonScore = horizonAlignment(stock.patternCategory, days);

  return Math.round(
    (signalScore + tierScore + confluenceScorePart + rrScore + horizonScore) * 100,
  ) / 100;
}

// ---------------------------------------------------------------------------
// Phase 3: Deduplicate & rank
// ---------------------------------------------------------------------------

function deduplicateAndRank(
  stocks: ScoredStock[],
  maxStocks: number,
): ScoredStock[] {
  const bestPerSymbol = new Map<string, ScoredStock>();

  for (const stock of stocks) {
    const existing = bestPerSymbol.get(stock.tradingSymbol);
    if (!existing || stock.compositeScore > existing.compositeScore) {
      bestPerSymbol.set(stock.tradingSymbol, stock);
    }
  }

  return Array.from(bestPerSymbol.values())
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, maxStocks);
}

// ---------------------------------------------------------------------------
// Phase 4: Volatility-weighted allocation with constraints
// ---------------------------------------------------------------------------

function allocatePortfolio(
  ranked: ScoredStock[],
  totalAmount: number,
  request: PortfolioOptimizeRequest,
): StockAllocation[] {
  const profile = RISK_PROFILES[request.riskProfile];

  if (ranked.length === 0) return [];

  // Step 1: Volatility weights (inverse of stop-loss distance %)
  const totalVolWeight = ranked.reduce(
    (s, st) => s + 1 / st.stopLossDistancePct,
    0,
  );

  const maxRiskAmount = profile.maxRiskPerTrade * totalAmount;
  const sectorTotals = new Map<string, number>();

  // Step 2: Compute raw allocations with risk + sector caps
  const allocations: StockAllocation[] = ranked.map((stock, idx) => {
    const volWeight = 1 / stock.stopLossDistancePct;
    const normalizedWeight = volWeight / totalVolWeight;

    let allocation = normalizedWeight * totalAmount;

    // Risk-per-trade cap
    const maxAllocationByRisk = maxRiskAmount / stock.stopLossDistancePct;
    allocation = Math.min(allocation, maxAllocationByRisk);

    // Sector cap
    const sector = stock.sector || 'Other';
    const sectorCap = profile.maxSectorAllocation * totalAmount;
    const currentSectorTotal = sectorTotals.get(sector) ?? 0;
    const remainingSectorBudget = Math.max(0, sectorCap - currentSectorTotal);
    allocation = Math.min(allocation, remainingSectorBudget);

    // Shares (whole number, floor)
    const sharesToBuy = Math.floor(allocation / stock.entryPrice);
    const investedAmount = sharesToBuy * stock.entryPrice;
    const riskAmount = sharesToBuy * (stock.entryPrice - stock.stopLoss);

    sectorTotals.set(sector, currentSectorTotal + investedAmount);

    // Expected returns
    const returns = calculateStockReturns({
      tier: stock.tier,
      entryPrice: stock.entryPrice,
      stopLoss: stock.stopLoss,
      target1: stock.target1,
      sharesToBuy,
      investedAmount,
    });

    return {
      rank: idx + 1,
      tradingSymbol: stock.tradingSymbol,
      companyName: stock.companyName,
      sector,
      patternName: stock.patternName,
      patternCategory: stock.patternCategory,
      direction: stock.direction,
      tier: stock.tier,
      confluenceScore: stock.confluenceScore,
      compositeScore: stock.compositeScore,
      signalStrength: stock.signalStrength,
      allocationAmount: Math.round(allocation * 100) / 100,
      allocationPercent: totalAmount > 0 ? allocation / totalAmount : 0,
      sharesToBuy,
      investedAmount: Math.round(investedAmount * 100) / 100,
      entryPrice: stock.entryPrice,
      stopLoss: stock.stopLoss,
      target1: stock.target1,
      target2: stock.target2,
      riskRewardRatio: stock.riskRewardRatio,
      riskAmount: Math.round(riskAmount * 100) / 100,
      riskPercent: totalAmount > 0 ? riskAmount / totalAmount : 0,
      expectedReturnAmount: returns.expectedReturnAmount,
      expectedReturnPercent: returns.expectedReturnPercent,
      winRate: returns.winRate,
    };
  });

  // Remove stocks with 0 shares (stock too expensive for allocation)
  const validAllocations = allocations.filter((a) => a.sharesToBuy > 0);

  // Step 3: Redistribute ALL leftover cash to top-ranked stocks.
  // Loop repeatedly until no more shares can be added.
  let cashUsed = validAllocations.reduce((s, a) => s + a.investedAmount, 0);
  let cashRemaining = totalAmount - cashUsed;

  // Reset sector totals from valid allocations
  sectorTotals.clear();
  for (const a of validAllocations) {
    sectorTotals.set(
      a.sector,
      (sectorTotals.get(a.sector) ?? 0) + a.investedAmount,
    );
  }

  // Find the cheapest stock price to know when to stop looping
  const cheapestPrice = Math.min(...validAllocations.map((a) => a.entryPrice));

  while (cashRemaining >= cheapestPrice) {
    let addedAny = false;

    for (const alloc of validAllocations) {
      if (cashRemaining < alloc.entryPrice) continue;

      const additionalRisk = alloc.entryPrice - alloc.stopLoss;
      const newTotalRisk = alloc.riskAmount + additionalRisk;
      if (newTotalRisk / totalAmount > profile.maxRiskPerTrade) continue;

      const sectorCap = profile.maxSectorAllocation * totalAmount;
      const currentSector = sectorTotals.get(alloc.sector) ?? 0;
      if (currentSector + alloc.entryPrice > sectorCap) continue;

      // Add one more share
      alloc.sharesToBuy += 1;
      alloc.investedAmount += alloc.entryPrice;
      alloc.investedAmount = Math.round(alloc.investedAmount * 100) / 100;
      alloc.riskAmount += additionalRisk;
      alloc.riskAmount = Math.round(alloc.riskAmount * 100) / 100;
      alloc.riskPercent = totalAmount > 0 ? alloc.riskAmount / totalAmount : 0;

      sectorTotals.set(alloc.sector, currentSector + alloc.entryPrice);
      cashRemaining -= alloc.entryPrice;
      cashUsed += alloc.entryPrice;
      addedAny = true;
    }

    // No stock could accept another share — stop
    if (!addedAny) break;
  }

  // Step 4: If significant cash remains (>10%), do a second pass that
  // relaxes the per-trade risk cap (keeps sector cap). This ensures the
  // full investment amount is utilized rather than sitting idle.
  cashRemaining = totalAmount - validAllocations.reduce((s, a) => s + a.investedAmount, 0);

  if (cashRemaining > totalAmount * 0.10 && validAllocations.length > 0) {
    while (cashRemaining >= cheapestPrice) {
      let addedAny = false;

      for (const alloc of validAllocations) {
        if (cashRemaining < alloc.entryPrice) continue;

        // Only respect sector cap in this relaxed pass
        const sectorCap = profile.maxSectorAllocation * totalAmount;
        const currentSector = sectorTotals.get(alloc.sector) ?? 0;
        if (currentSector + alloc.entryPrice > sectorCap) continue;

        alloc.sharesToBuy += 1;
        alloc.investedAmount += alloc.entryPrice;
        alloc.investedAmount = Math.round(alloc.investedAmount * 100) / 100;
        const additionalRisk = alloc.entryPrice - alloc.stopLoss;
        alloc.riskAmount += additionalRisk;
        alloc.riskAmount = Math.round(alloc.riskAmount * 100) / 100;
        alloc.riskPercent = totalAmount > 0 ? alloc.riskAmount / totalAmount : 0;

        sectorTotals.set(alloc.sector, currentSector + alloc.entryPrice);
        cashRemaining -= alloc.entryPrice;
        addedAny = true;
      }

      if (!addedAny) break;
    }
  }

  // Recalculate expected returns for all stocks after redistribution
  for (const alloc of validAllocations) {
    const returns = calculateStockReturns({
      tier: alloc.tier,
      entryPrice: alloc.entryPrice,
      stopLoss: alloc.stopLoss,
      target1: alloc.target1,
      sharesToBuy: alloc.sharesToBuy,
      investedAmount: alloc.investedAmount,
    });
    alloc.expectedReturnAmount = returns.expectedReturnAmount;
    alloc.expectedReturnPercent = returns.expectedReturnPercent;
  }

  // Recompute allocation percentages
  for (const a of validAllocations) {
    a.allocationPercent = totalAmount > 0 ? a.investedAmount / totalAmount : 0;
  }

  return validAllocations;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function optimizePortfolio(
  request: PortfolioOptimizeRequest,
): Promise<OptimizedPortfolio> {
  // Fetch all results from the latest completed scan
  const scanData = await getLatestScanResults(500);

  if (!scanData || scanData.results.length === 0) {
    throw new Error('No scan results available. Please run a scan first.');
  }

  // Map scan results to internal format
  const allStocks: ScanStock[] = scanData.results
    .filter(
      (r) =>
        r.entryPrice !== null &&
        r.stopLoss !== null &&
        r.target1 !== null &&
        r.riskRewardRatio !== null,
    )
    .map((r) => ({
      tradingSymbol: r.tradingSymbol,
      companyName: r.companyName,
      sector: r.sector || 'Other',
      patternName: r.patternName,
      patternCategory: r.patternCategory,
      direction: r.direction,
      tier: r.tier as number,
      confluenceScore: r.confluenceScore as number,
      signalStrength: r.signalStrength,
      entryPrice: r.entryPrice!,
      stopLoss: r.stopLoss!,
      target1: r.target1!,
      target2: r.target2 ?? null,
      riskRewardRatio: r.riskRewardRatio!,
      currentPrice: r.currentPrice,
    }));

  // Phase 1: Filter
  const eligible = filterEligible(allStocks, request);

  if (eligible.length === 0) {
    throw new Error(
      'No eligible stocks found for your risk profile. Try a less restrictive profile or run a fresh scan.',
    );
  }

  // Phase 2: Score
  const scored: ScoredStock[] = eligible.map((stock) => ({
    ...stock,
    compositeScore: computeCompositeScore(stock, request.days),
    stopLossDistancePct: (stock.entryPrice - stock.stopLoss) / stock.entryPrice,
  }));

  // Phase 3: Deduplicate & rank
  const profile = RISK_PROFILES[request.riskProfile];
  const ranked = deduplicateAndRank(scored, profile.maxStocks);

  // Phase 4: Allocate
  const allocations = allocatePortfolio(ranked, request.amount, request);

  if (allocations.length === 0) {
    throw new Error(
      'Investment amount is too low to buy shares of any qualifying stock. Try increasing the amount.',
    );
  }

  // Phase 5: Summary
  const summary = computePortfolioSummary(allocations, request.amount);

  return {
    request,
    summary,
    allocations,
    generatedAt: new Date().toISOString(),
    scanSessionId: scanData.session.id,
  };
}
