import pLimit from 'p-limit';

// Maximum 20 concurrent API requests (safe with per-minute limit below)
const concurrencyLimit = pLimit(20);

// Track requests per minute (max 250 to stay safe under Upstox limits)
const MAX_REQUESTS_PER_MINUTE = 250;
const DELAY_BETWEEN_REQUESTS_MS = 50;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

let requestTimestamps: number[] = [];

function cleanOldTimestamps(): void {
  const oneMinuteAgo = Date.now() - 60_000;
  requestTimestamps = requestTimestamps.filter((ts) => ts > oneMinuteAgo);
}

function canMakeRequest(): boolean {
  cleanOldTimestamps();
  return requestTimestamps.length < MAX_REQUESTS_PER_MINUTE;
}

function recordRequest(): void {
  requestTimestamps.push(Date.now());
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Wait until we're under the per-minute rate limit
    while (!canMakeRequest()) {
      await delay(1000);
    }

    // Add delay between requests to avoid bursts
    await delay(DELAY_BETWEEN_REQUESTS_MS);

    recordRequest();

    // IMPORTANT: Disable Next.js fetch caching to always get fresh data from Upstox
    const response = await fetch(url, { ...options, cache: 'no-store' });

    if (response.status === 429) {
      if (attempt < retries) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(
          `Rate limited (429). Retrying in ${backoff}ms (attempt ${attempt + 1}/${retries})...`
        );
        await delay(backoff);
        continue;
      }
      throw new Error(
        `Rate limited after ${retries} retries. URL: ${url}`
      );
    }

    return response;
  }

  // This should never be reached due to the throw above, but TypeScript requires it
  throw new Error(`Failed to fetch after ${retries} retries. URL: ${url}`);
}

/**
 * Rate-limited fetch that wraps the native fetch with:
 * - Concurrency limiting (max 10 concurrent)
 * - Per-minute request tracking (max 250/min)
 * - Delay between requests (100ms)
 * - Retry with exponential backoff on 429 responses
 */
export async function rateLimitedFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  return concurrencyLimit(() => fetchWithRetry(url, options));
}

/**
 * Returns the current request count in the last minute (for monitoring).
 */
export function getCurrentRequestCount(): number {
  cleanOldTimestamps();
  return requestTimestamps.length;
}
