// Client for the FastAPI backend; /api/* is proxied to it by next.config.js.

export type MarketId = "in" | "us";
export type Interval = "1h" | "1d" | "1wk";

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
  cap?: CapCategory | null;
  /** today's volume / 3-month average volume */
  rel_volume?: number | null;
  /** % from the 52-week high (0 or negative) and low (0 or positive) */
  from_high?: number | null;
  from_low?: number | null;
  /** active validated patterns from the nightly scan */
  signal?: { bullish: number; bearish: number; patterns: string[] } | null;
};
export type CapCategory = "large" | "mid" | "small" | "micro";
export type IndexQuote = Partial<Quote> & { ticker: string; name: string };
export type StockPage = {
  market: MarketId;
  updated_at: number;
  market_open: boolean;
  indices: IndexQuote[];
  total: number;
  cap_counts: Record<"all" | CapCategory, number>;
  listed: number;
  priced: number;
  offset: number;
  rows: Stock[];
  sectors: string[];
  exchanges: string[];
  /** when the nightly validated-pattern scan last ran (epoch ms), or null if it hasn't yet */
  patterns_scanned_at: number | null;
};
export type StockFilters = {
  q?: string;
  sector?: string;
  exchange?: string;
  fo?: boolean;
  cap?: CapCategory | "";
  min_price?: number | null;
  max_price?: number | null;
  min_change?: number | null;
  max_change?: number | null;
  min_volume?: number | null;
  min_turnover?: number | null;
  min_rel_volume?: number | null;
  /** within this % of the 52-week high / low */
  near_high?: number | null;
  near_low?: number | null;
  min_pe?: number | null;
  max_pe?: number | null;
  /** an active validated pattern (nightly scan) */
  pattern?: "" | "any" | "bull" | "bear";
  /** India F&O: the last trading day's futures build-up */
  buildup?: "" | Exclude<Buildup, "neutral">;
};
export type StockQuery = StockFilters & {
  sort?: "symbol" | "price" | "change_pct" | "volume" | "rel_volume" | "turnover" | "market_cap" | "from_high" | "pe";
  desc?: boolean;
  offset?: number;
  limit?: number;
};
export type StockQuote = Quote & { symbol: string; sector?: string; exchange?: string; has_fno: boolean };

/** [time ms, open, high, low, close, volume] */
export type Candle = [number, number, number, number, number, number];

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  // Signed out (or session expired) on a members-only call: go to sign-in and come back afterwards.
  if (res.status === 401 && !path.startsWith("/api/account/") && typeof window !== "undefined") {
    window.location.href = `/signin?expired=1&next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = typeof err.detail === "string" ? err.detail : null;
    throw new ApiError(detail ?? `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

/** 428 from the backend means Indian F&O prices need the daily Upstox login. */
export const needsUpstox = (e: unknown) => e instanceof ApiError && e.status === 428;

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const stockPath = (m: MarketId, symbol: string) => `/api/markets/${m}/stocks/${encodeURIComponent(symbol)}`;

export function getStocks(m: MarketId, query: StockQuery) {
  const params = new URLSearchParams();
  // Booleans are always sent: dropping `false` would turn desc=false (ascending) into the server's default.
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  return request<StockPage>(`/api/markets/${m}/stocks?${params}`);
}
export const getQuote = (m: MarketId, symbol: string) => request<StockQuote>(stockPath(m, symbol));
export const getHistory = (m: MarketId, symbol: string, interval: Interval) =>
  request<{ interval: Interval; candles: Candle[] }>(`${stockPath(m, symbol)}/history?interval=${interval}`);

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
  legs: { side: "BUY" | "SELL"; kind: "FUT" | "CE" | "PE"; strike: number; price: number }[];
  net_premium: number;
  max_profit: number | null;
  max_loss: number | null;
  breakevens: number[];
  /** Chance of profit and average P&L at expiry under the option market's own implied volatility (not a forecast). */
  market_prob_profit: number;
  market_expected_pnl: number;
};

export type IdeasResult = {
  expiry: string;
  days: number;
  spot: number;
  lot_size: number;
  future_price: number | null;
  market_iv: number;
  /** The option market's 80% range at expiry (10th-90th percentile of its implied prices). */
  range80: [number, number];
  /** A sample of the market-implied prices at expiry, for the payoff chart. */
  final_prices: number[];
  ideas: Idea[];
};

export type UpstoxStatus = { connected: boolean; expires_at: string | null; configured: boolean };

const fnoPath = (m: MarketId, symbol: string) => `/api/markets/${m}/fno/${encodeURIComponent(symbol)}`;

export const getFnoUnderlyings = (m: MarketId) => request<FnoUnderlying[]>(`/api/markets/${m}/fno`);
export const getFnoOverview = (m: MarketId, symbol: string) => request<FnoOverview>(fnoPath(m, symbol));
export const getOptionChain = (m: MarketId, symbol: string, expiry: string) =>
  request<OptionChain>(`${fnoPath(m, symbol)}/chain?expiry=${expiry}`);
export const runIdeas = (m: MarketId, symbol: string, body: { expiry: string }) =>
  post<IdeasResult>(`${fnoPath(m, symbol)}/ideas`, body);
export const getUpstoxStatus = () => request<UpstoxStatus>("/api/fno/status");
// The admin key travels in the POST body so it never lands in URLs or logs.
export const upstoxLoginUrl = (key: string) => post<{ url: string }>("/api/auth/login", { key });

// --- accounts & public data ---

export type User = { id: number; email: string; name: string };

export const getMe = () => request<User>("/api/account/me");
export const signIn = (email: string, password: string) => post<User>("/api/account/signin", { email, password });
export const signUp = (name: string, email: string, password: string) => post<User>("/api/account/signup", { name, email, password });
export const signOut = () => post<{ ok: boolean }>("/api/account/signout", {});

export type PublicStock = Pick<Stock, "symbol" | "name" | "sector" | "exchange" | "price" | "change" | "change_pct" | "market_cap">;
export type PublicOverview = {
  market: MarketId;
  updated_at: number;
  market_open: boolean;
  indices: IndexQuote[];
  largest: PublicStock[];
  gainers: PublicStock[];
  losers: PublicStock[];
  listed: number;
};

/** Signed-out view of a market: indices, the largest stocks and today's biggest movers. */
export const getPublicOverview = (m: MarketId) => request<PublicOverview>(`/api/public/markets/${m}/overview`);

export const CONTACT_TOPICS = ["General question", "Bug report", "Feature request", "Account", "Partnership"] as const;
export type ContactMessage = { name: string; email: string; topic: (typeof CONTACT_TOPICS)[number]; message: string; website: string };
export const sendContact = (m: ContactMessage) => post<{ ok: boolean }>("/api/contact", m);

// --- chart data ---

export type Sparkline = { ticker: string; name: string; prev_close: number | null; points: [number, number][] };
export type HeatmapStock = { symbol: string; name: string; sector: string; price: number; change_pct: number; market_cap: number };

/** Today's 5-minute line for each headline index (public). */
export const getSparklines = (m: MarketId) => request<Sparkline[]>(`/api/public/markets/${m}/sparklines`);
/** The largest stocks with sector and today's change, for the market heatmap. */
export const getHeatmap = (m: MarketId) => request<{ updated_at: number; market_open: boolean; stocks: HeatmapStock[] }>(`/api/markets/${m}/heatmap`);

// --- validated patterns ---

export type PatternStyle = "swing" | "positional" | "long_term";
export type PatternStatus = "new" | "awaiting_confirmation" | "open" | "target_hit" | "stopped" | "expired";

export type PatternSignal = {
  style: PatternStyle;
  pattern: string;
  direction: 1 | -1;
  /** start of the candle the pattern completed on, and the last day it covers (epoch ms) */
  time: number;
  time_end: number;
  filters: string[];
  reward_risk: number;
  entry: number;
  stop: number;
  target: number;
  status: PatternStatus;
  outcome_r: number | null;
  max_hold_bars: number;
  /** the setup's measured track record across all stocks */
  record: { trades: number; hit_rate: number; avg_r: number; edge_r: number; held_bars: number };
};

/** Validated pattern signals on completed candles for one stock, newest first. */
export const getPatterns = (m: MarketId, symbol: string) =>
  request<{ signals: PatternSignal[]; liquid: boolean }>(`${stockPath(m, symbol)}/patterns`);

export type NewsItem = {
  title: string;
  source: string;
  url: string;
  published: number; // epoch ms
  also: string[]; // other outlets that ran the same story
};
export type NewsFeed = { items: NewsItem[] };
export type StockNews = { symbol: string; days: number; company: NewsFeed & { query: string }; market: NewsFeed };

export const getNews = (m: MarketId, symbol: string) => request<StockNews>(`${stockPath(m, symbol)}/news`);

export type Filing = {
  exchange: "NSE" | "BSE";
  published: number; // epoch ms
  type: string; // the exchange's own category
  text: string;
  url: string; // the filing's PDF
  tag: string; // our plain-language type: Results, Dividend, Order win, ...
  routine: boolean;
};
export type StockFilings = { source: "NSE" | "BSE"; days: number; items: Filing[]; routine: number };
export const getFilings = (m: MarketId, symbol: string) => request<StockFilings>(`${stockPath(m, symbol)}/filings`);

/** Moves are fractions of the price: -0.021 = -2.1%. "likely" holds ~80% of past moves, "rare" ~95%. */
export type MoveRange = { down: number; up: number };
export type ExpectedMove = {
  daily_vol: number;
  close: number;
  as_of: number;
  lookback: number;
  horizons: { days: number; likely: MoveRange; rare: MoveRange }[];
  tested: string;
};
export const getExpectedMove = (m: MarketId, symbol: string) => request<ExpectedMove>(`${stockPath(m, symbol)}/expected-move`);

export type StopMethod = "history" | "scaled" | "formula" | null;
/** Past moves (log, entry to the lowest low for buys / highest high for shorts) for the trade planner's stop check. */
export type StopSamples = { buy: number[]; short: number[] };
export type StopCheck = {
  swing: { vol: number; gap: { down: number; up: number }; holds: ({ days: number; method: StopMethod } & StopSamples)[] };
  intraday: { method: StopMethod; vol: number; sessions: number; entries: ({ time: string; remain: number } & StopSamples)[] } | null;
};
export const getStopCheck = (m: MarketId, symbol: string) => request<StopCheck>(`${stockPath(m, symbol)}/stop-check`);

export type SummarySide = "bull" | "bear" | "check";
export type SummaryPoint = { side: SummarySide; text: string; tested: boolean; detail: string };
export type StockSummary = {
  symbol: string;
  price: number;
  rating: number | null;
  points: SummaryPoint[];
  counts: Record<SummarySide, { tested: number; facts: number }>;
};
export const getSummary = (m: MarketId, symbol: string) => request<StockSummary>(`${stockPath(m, symbol)}/summary`);

/** Before you trade: facts about the stock, with "caution" only for practical risks (no verdict, no trade plan). */
export type FactStatus = "info" | "caution";
export type Checklist = {
  symbol: string;
  name: string | null;
  price: number | null;
  items: { title: string; status: FactStatus; summary: string; detail: string }[];
  cautions: string[];
};
export const getChecklist = (m: MarketId, symbol: string) => request<Checklist>(`${stockPath(m, symbol)}/checklist`);

export type Buildup = "long_buildup" | "short_buildup" | "short_covering" | "long_unwinding" | "neutral";
export type BuildupRow = {
  symbol: string;
  kind: "stock" | "index";
  price: number; // nearest futures contract
  price_chg_pct: number; // fraction: 0.012 = +1.2%
  oi: number; // all expiries
  oi_chg_pct: number;
  buildup: Buildup;
};
export type OiStrike = { strike: number; oi: number; oi_change: number | null };
export type StockOi = {
  symbol: string;
  as_of: string | null; // India: the trading day of NSE's end-of-day file; US: live
  source: string;
  buildup: BuildupRow | null;
  expiry: string;
  pcr: number | null;
  max_pain: number | null;
  spot: number | null;
  resistance: number | null; // strike with the most call OI
  support: number | null; // strike with the most put OI
  prev_resistance: number | null; // the day before (India)
  prev_support: number | null;
  top_calls: OiStrike[];
  top_puts: OiStrike[];
};
export const getOiBuildup = (m: MarketId) => request<{ date: string; rows: BuildupRow[] }>(`/api/markets/${m}/oi/buildup`);
export const getStockOi = (m: MarketId, symbol: string) => request<StockOi>(`${stockPath(m, symbol)}/oi`);

export type PulseLeader = {
  symbol: string;
  sector: string | null;
  rating: number;
  from_high: number; // fraction below the 52-week high (negative)
  above_200dma: boolean;
  turnover: number;
  change_pct: number | null;
};
/** A stock behind one of Pulse's breadth counts (advances / declines, new highs / lows). */
export type PulseStock = { symbol: string; name: string | null; sector: string | null; price: number; change_pct: number | null; turnover?: number };

export type Pulse = {
  market: MarketId;
  updated_at: number;
  market_open: boolean;
  indicators_at: number | null;
  stocks: number;
  mood: number | null; // 0..1
  breadth: { above_ema20: number | null; above_50dma: number | null; above_200dma: number | null };
  advance_decline: { advances: number; declines: number; unchanged: number; top_up?: PulseStock[]; top_down?: PulseStock[] };
  highs_lows: { highs: number; lows: number; high_list?: PulseStock[]; low_list?: PulseStock[] };
  history: { t: number; above_ema20: number | null; ad: number | null }[];
  index: { name: string; price: number | null; change_pct: number | null };
  vix: { name: string; value: number | null; change_pct: number | null };
  /** week / month: the sector's median move over the last 5 / 20 trading days; turnover: value traded today. */
  sectors: { sector: string; stocks: number; change_pct: number; above_ema20: number | null; turnover: number; week: number | null; month: number | null }[];
  /** How many stocks moved by each band today (% edges; null = open-ended), with the band's most traded stocks. */
  histogram: { from: number | null; to: number | null; count: number; stocks: PulseStock[] }[];
  /** Momentum strategy C: top 30 by momentum among the most traded stocks, with the funnel that gets there. */
  shortlist: { funnel: { label: string; count: number }[]; stocks: PulseShortlistStock[] };
  bubbles: { symbol: string; sector: string | null; change_pct: number; rvol: number; turnover: number }[];
  buildup: { date: string; counts: Partial<Record<Buildup, number>> } | null;
  leaders: PulseLeader[];
  leaders_zone: { rating: number; from_high: number; count: number };
  records: {
    momentum: { month: number; quarter: number };
    shortlist: { annual_return: number; halves: [number, number]; max_drop: number; pool_annual: number };
  };
};
export type PulseShortlistStock = {
  symbol: string; name: string | null; sector: string | null; price: number; change_pct: number | null;
  rating: number; from_high: number | null; turnover20: number;
  /** % change of each of the last 5 completed sessions, oldest first (null until the nightly scan has them). */
  last5: number[] | null;
};
export const getPulse = (m: MarketId) => request<Pulse>(`/api/markets/${m}/pulse`);
/** How far stocks moved over the last 1-7 sessions (live price vs the close that many sessions back). */
export type PulseMoves = { days: number; updated_at: number; bins: Pulse["histogram"] };
export const getMoves = (m: MarketId, days: number) => request<PulseMoves>(`/api/markets/${m}/pulse/moves?days=${days}`);

export type FlowStock = {
  symbol: string; name: string | null; sector: string | null; price: number; day_change: number | null;
  volume_x: number; buyers: number; move: number; value: number;
};
export type FlowWindow = { buying: FlowStock[]; selling: FlowStock[]; buying_count: number; selling_count: number };
export type Flow = {
  updated_at: number; as_of: string | null; market_open: boolean; scanned: number; universe: number;
  heavy: number; dominant: number; windows: Record<"5" | "15" | "30", FlowWindow>;
};
export const getFlow = (m: MarketId) => request<Flow>(`/api/markets/${m}/flow`);

/** One NSE main-board company's numbers from its own filings (backend app.fundamentals). Ratios are fractions,
 *  promoter holding is in percent (as filed), amounts in rupees; null = not available from the filings. */
export type FundamentalsRow = {
  symbol: string;
  name: string | null;
  sector: string | null;
  basis: "consolidated" | "standalone";
  quarter_end: string;
  filed: string | null;
  fy_end: string | null;
  price: number | null;
  market_cap: number | null;
  pe: number | null;
  peg: number | null;
  turnover: number | null;
  sales_ttm: number | null;
  profit_ttm: number | null;
  opm_ttm: number | null;
  opm_fy: number | null;
  opm_fy1: number | null;
  other_income_ttm: number | null;
  pbt_ttm: number | null;
  sales_q: number | null;
  sales_q_prev: number | null;
  profit_q: number | null;
  profit_q_prev: number | null;
  sales_g_q: number | null;
  profit_g_q: number | null;
  sales_g3: number | null;
  profit_g3: number | null;
  roe: number | null;
  de: number | null;
  debt: number | null;
  equity: number | null;
  bs_date: string | null;
  cfo_to_profit: number | null;
  cfo_positive_years: number | null;
  fcf_3y: number | null;
  fcf_yield: number | null;
  shares: number | null;
  eps_ttm: number | null;
  promoter: number | null;
  promoter_prev: number | null;
  promoter_date: string | null;
  promoter_prev_date: string | null;
  encumbered_pct: number | null;
  pledged_pct: number | null;
};
export type FundamentalsScreen = { generated_at: number; rows: FundamentalsRow[]; financial: number };
export type PeYear = { end: string; eps: number | null; price: number | null; pe: number | null };
export type FundamentalsYear = { end: string; sales: number | null; profit: number | null; eps: number | null; cfo: number | null; fcf: number | null };
export type StockFundamentals = FundamentalsRow & { history?: FundamentalsYear[]; pe_history?: PeYear[] | null };

export const getFundamentals = () => request<FundamentalsScreen>("/api/markets/in/fundamentals");
export const getStockFundamentals = (symbol: string) => request<StockFundamentals>(`${stockPath("in", symbol)}/fundamentals`);
