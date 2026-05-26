/**
 * EMA (Exponential Moving Average) and SMA (Simple Moving Average) calculators.
 *
 * Pure mathematical implementations with no external dependencies.
 */

/**
 * Calculate the Simple Moving Average for an array of prices.
 *
 * @param prices - Array of numeric price values.
 * @param period - Look-back window size.
 * @returns Array of same length as input. Indices before the first full window are NaN.
 */
export function calculateSMA(prices: number[], period: number): number[] {
  const result: number[] = new Array(prices.length).fill(NaN);

  if (prices.length < period || period <= 0) {
    return result;
  }

  // Compute the first SMA value using a running sum.
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  result[period - 1] = sum / period;

  // Slide the window forward.
  for (let i = period; i < prices.length; i++) {
    sum += prices[i] - prices[i - period];
    result[i] = sum / period;
  }

  return result;
}

/**
 * Calculate the Exponential Moving Average for an array of prices.
 *
 * Uses the standard formula:
 *   multiplier = 2 / (period + 1)
 *   EMA_t = (price_t - EMA_{t-1}) * multiplier + EMA_{t-1}
 *
 * The first EMA value is seeded with the SMA of the first `period` prices.
 *
 * @param prices - Array of numeric price values.
 * @param period - Look-back window size.
 * @returns Array of same length as input. Indices before the seed value are NaN.
 */
export function calculateEMA(prices: number[], period: number): number[] {
  const result: number[] = new Array(prices.length).fill(NaN);

  if (prices.length < period || period <= 0) {
    return result;
  }

  const multiplier = 2 / (period + 1);

  // Seed with SMA of the first `period` prices.
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }

  let ema = sum / period;
  result[period - 1] = ema;

  // Apply the EMA formula for the remaining prices.
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
    result[i] = ema;
  }

  return result;
}
