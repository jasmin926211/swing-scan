/**
 * RSI (Relative Strength Index) calculator.
 *
 * Uses Wilder's smoothing method (exponential moving average with alpha = 1/period).
 * Pure mathematical implementation with no external dependencies.
 */

/**
 * Calculate the Relative Strength Index for an array of prices.
 *
 * Wilder's RSI algorithm:
 *   1. Compute price changes (deltas).
 *   2. Separate gains (positive deltas) and losses (absolute negative deltas).
 *   3. Seed the first average gain/loss as the SMA over the initial `period` changes.
 *   4. Smooth subsequent averages:  avg = (prevAvg * (period - 1) + current) / period
 *   5. RS = avgGain / avgLoss
 *   6. RSI = 100 - (100 / (1 + RS))
 *
 * @param prices - Array of closing prices.
 * @param period - Look-back period (default 14).
 * @returns Array of same length as input. The first `period` values are NaN because
 *          we need `period` price changes (i.e. `period + 1` prices) before the
 *          first RSI can be produced, but we keep index alignment by filling the
 *          first `period` slots with NaN.
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
  const result: number[] = new Array(prices.length).fill(NaN);

  // We need at least period + 1 prices to compute the first RSI value.
  if (prices.length < period + 1 || period <= 0) {
    return result;
  }

  // Step 1 — compute deltas.
  const deltas: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    deltas.push(prices[i] - prices[i - 1]);
  }

  // Step 2 — separate gains and losses.
  const gains: number[] = deltas.map((d) => (d > 0 ? d : 0));
  const losses: number[] = deltas.map((d) => (d < 0 ? -d : 0));

  // Step 3 — seed averages with SMA of first `period` changes.
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI value corresponds to prices[period] (index `period` in the output).
  if (avgLoss === 0) {
    result[period] = 100;
  } else {
    const rs = avgGain / avgLoss;
    result[period] = 100 - 100 / (1 + rs);
  }

  // Step 4-6 — smooth and compute RSI for remaining values.
  for (let i = period; i < deltas.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    if (avgLoss === 0) {
      result[i + 1] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i + 1] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}
