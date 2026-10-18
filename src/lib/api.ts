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

export type Stock = Partial<Quote> & {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  ticker: string;
  fo?: boolean;
  turnover?: number | null;
};
export type IndexQuote = Partial<Quote> & { ticker: string; name: string };
export type StockPage = {
  market: MarketId;
  updated_at: number;
  market_open: boolean;
  indices: IndexQuote[];
  total: number;
  listed: number;
  priced: number;
  offset: number;
  rows: Stock[];
  sectors: string[];
  exchanges: string[];
};
export type StockQuery = {
  q?: string;
  sector?: string;
  exchange?: string;
  fo?: boolean;
  min_turnover?: number;
  sort?: "symbol" | "price" | "change_pct" | "volume" | "market_cap" | "turnover";
  desc?: boolean;
  offset?: number;
  limit?: number;
};
export type StockQuote = Quote & { symbol: string; sector?: string; exchange?: string; has_fno: boolean };

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

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = typeof err.detail === "string" ? err.detail : null;
    throw new ApiError(detail ?? `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

/** 401 from the backend means Indian F&O prices need the daily Upstox login. */
export const needsUpstox = (e: unknown) => e instanceof ApiError && e.status === 401;

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const stockPath = (m: MarketId, symbol: string) => `/api/markets/${m}/stocks/${encodeURIComponent(symbol)}`;

export function getStocks(m: MarketId, query: StockQuery) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "" && v !== false) params.set(k, String(v));
  return request<StockPage>(`/api/markets/${m}/stocks?${params}`);
}
export const getQuote = (m: MarketId, symbol: string) => request<StockQuote>(stockPath(m, symbol));
export const getHistory = (m: MarketId, symbol: string, interval: Interval) =>
  request<{ interval: Interval; candles: Candle[] }>(`${stockPath(m, symbol)}/history?interval=${interval}`);
export const runForecast = (m: MarketId, symbol: string, p: ForecastParams) =>
  post<Forecast>(`${stockPath(m, symbol)}/forecast`, p);
export const runBacktest = (m: MarketId, symbol: string, p: ForecastParams & { n_checks: number }) =>
  post<Backtest>(`${stockPath(m, symbol)}/backtest`, p);

// --- futures & options (analysis only) ---

export type FnoUnderlying = {
  symbol: string;
  name: string;
  kind: "INDEX" | "EQUITY";
  lot_size: number;
  next_expiry?: string | null;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  market_cap: number | null;
};

export type Future = {
  expiry: string;
  trading_symbol: string;
  lot_size: number;
  price: number | null;
  change: number | null;
  oi: number | null;
  volume: number | null;
};

export type FnoOverview = {
  symbol: string;
  name: string | null;
  kind: "INDEX" | "EQUITY";
  lot_size: number;
  expiries: string[];
  spot: number | null;
  futures: Future[] | null;
  needs_upstox: boolean;
};

export type OptionSide = {
  price: number | null;
  bid: number | null;
  ask: number | null;
  oi: number | null;
  oi_change: number | null;
  volume: number | null;
  iv: number | null;
  delta: number | null;
};

export type OptionChain = {
  expiry: string;
  spot: number | null;
  lot_size: number;
  source: string;
  atm_strike: number | null;
  pcr: number | null;
  max_pain: number | null;
  rows: { strike: number; call: OptionSide | null; put: OptionSide | null }[];
};

export type Idea = {
  name: string;
  direction: "bullish" | "bearish" | "neutral";
  matches_outlook: boolean;
  legs: { side: "BUY" | "SELL"; kind: "FUT" | "CE" | "PE"; strike: number; price: number }[];
  net_premium: number;
  max_profit: number | null;
  max_loss: number | null;
  breakevens: number[];
  expected_pnl: number;
  prob_profit: number;
  market_prob_profit: number | null;
  market_expected_pnl: number | null;
};

export type IdeasResult = {
  expiry: string;
  horizon: number;
  spot: number;
  lot_size: number;
  future_price: number | null;
  market_iv: number | null;
  forecast: Forecast;
  final_prices: number[];
  ideas: Idea[];
};

export type UpstoxStatus = { connected: boolean; expires_at: string | null; configured: boolean };

const fnoPath = (m: MarketId, symbol: string) => `/api/markets/${m}/fno/${encodeURIComponent(symbol)}`;

export const getFnoUnderlyings = (m: MarketId) => request<FnoUnderlying[]>(`/api/markets/${m}/fno`);
export const getFnoOverview = (m: MarketId, symbol: string) => request<FnoOverview>(fnoPath(m, symbol));
export const getOptionChain = (m: MarketId, symbol: string, expiry: string) =>
  request<OptionChain>(`${fnoPath(m, symbol)}/chain?expiry=${expiry}`);
export const runIdeas = (m: MarketId, symbol: string, body: { expiry: string; model: ModelName; n_samples: number }) =>
  post<IdeasResult>(`${fnoPath(m, symbol)}/ideas`, body);
export const getUpstoxStatus = () => request<UpstoxStatus>("/api/fno/status");
// The admin key travels in the POST body so it never lands in URLs or logs.
export const upstoxLoginUrl = (key: string) => post<{ url: string }>("/api/auth/login", { key });
