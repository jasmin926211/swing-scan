// Client for the FastAPI backend; /api/* is proxied to it by next.config.js.

export type MarketId = "in" | "us";
export type Interval = "1h" | "1d" | "1wk";
export type ModelName = "kronos-mini" | "kronos-small" | "kronos-base";

export type Quote = {
  ticker: string;
  name: string | null;
  currency: string | null;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prev_close: number | null;
  volume: number | null;
  avg_volume: number | null;
  market_cap: number | null;
  pe: number | null;
  high_52w: number | null;
  low_52w: number | null;
  market_state: string | null;
  time: number | null;
};

export type Stock = Partial<Quote> & { symbol: string; name: string; sector: string };
export type IndexQuote = Partial<Quote> & { ticker: string; name: string };
export type MarketStocks = { market: MarketId; updated_at: number; indices: IndexQuote[]; stocks: Stock[] };
export type StockQuote = Quote & { symbol: string; sector?: string };

/** [time ms, open, high, low, close, volume] */
export type Candle = [number, number, number, number, number, number];

// lookback (bars of history fed to Kronos) is left to the backend default.
export type ForecastParams = { interval: Interval; model: ModelName; horizon: number; n_samples: number };

export type ForecastSummary = {
  last_close: number;
  predicted_close: number;
  expected_return: number;
  prob_up: number;
  close_p10: number;
  close_p90: number;
  predicted_high: number;
  predicted_low: number;
  outlook: "bullish" | "bearish" | "neutral";
};

export type ForecastPoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
};

export type Forecast = {
  as_of: number;
  bars_used: number;
  seconds: number;
  summary: ForecastSummary;
  points: ForecastPoint[];
  paths: number[][];
};

export type Check = {
  from_time: number;
  to_time: number;
  base: number;
  predicted: number;
  low: number;
  high: number;
  actual: number;
  direction_hit: boolean;
  error_pct: number;
  naive_error_pct: number;
};

export type Backtest = {
  checks: Check[];
  direction_accuracy: number;
  mean_error_pct: number;
  naive_error_pct: number;
  band_coverage: number;
  seconds: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = typeof err.detail === "string" ? err.detail : null;
    throw new Error(detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const stockPath = (m: MarketId, symbol: string) => `/api/markets/${m}/stocks/${encodeURIComponent(symbol)}`;

export const getMarketStocks = (m: MarketId) => request<MarketStocks>(`/api/markets/${m}/stocks`);
export const getQuote = (m: MarketId, symbol: string) => request<StockQuote>(stockPath(m, symbol));
export const getHistory = (m: MarketId, symbol: string, interval: Interval) =>
  request<{ interval: Interval; candles: Candle[] }>(`${stockPath(m, symbol)}/history?interval=${interval}`);
export const runForecast = (m: MarketId, symbol: string, p: ForecastParams) =>
  post<Forecast>(`${stockPath(m, symbol)}/forecast`, p);
export const runBacktest = (m: MarketId, symbol: string, p: ForecastParams & { n_checks: number }) =>
  post<Backtest>(`${stockPath(m, symbol)}/backtest`, p);
