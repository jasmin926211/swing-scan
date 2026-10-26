import type { FundamentalsRow } from "@/lib/api";

/** The Fundamentals screen's rules. Each reads one number from a company's filings row, in the unit the rule is
 *  written in (percent, rupees, times), and passes when it's on the right side of the threshold. A missing number
 *  fails the rule: the screen only passes what the filings show. */
export type Op = ">" | ">=" | "<";
export type Rule = {
  id: string;
  group: "Valuation" | "Ownership" | "Profitability" | "Growth" | "Balance sheet" | "Cash flow" | "Quality checks";
  label: string;
  op: Op;
  unit: "%" | "₹" | "₹ Cr" | "×" | "pts" | "";
  get: (r: FundamentalsRow) => number | null;
  /** A fixed comparison (e.g. "this year's margin above last year's"): no threshold to edit. */
  fixed?: { value: number; text: string };
  /** How a value reads in a failure note, when the number alone wouldn't say. */
  describe?: (v: number) => string;
  hint?: string;
  suggested?: boolean;
};

const pc = (v: number | null) => (v == null ? null : v * 100);

export const RULES: Rule[] = [
  { id: "price", group: "Valuation", label: "Current price", op: "<", unit: "₹", get: (r) => r.price,
    hint: "Share price alone says nothing about value: a ₹4,000 share can be cheaper than a ₹40 one. Only useful as a budget limit." },
  { id: "pe", group: "Valuation", label: "Price to earnings", op: "<", unit: "×", get: (r) => r.pe,
    hint: "Price × shares ÷ last 12 months' net profit. Loss-making companies have no P/E and fail." },
  { id: "peg", group: "Valuation", label: "P/E ÷ profit growth (PEG)", op: "<", unit: "×", get: (r) => r.peg, suggested: true,
    hint: "P/E divided by 3-year profit growth (%). Under 1 is cheap for the growth, over 2 expensive (a rule of thumb, not tested)." },

  { id: "promoter", group: "Ownership", label: "Promoter holding", op: ">", unit: "%", get: (r) => r.promoter,
    hint: "SEBI caps promoters at 75% (25% must be public), so above 70 leaves a narrow band, mostly PSUs and subsidiaries of foreign companies." },
  { id: "promoter_change", group: "Ownership", label: "Change in promoter holding", op: ">=", unit: "pts",
    get: (r) => (r.promoter != null && r.promoter_prev != null ? r.promoter - r.promoter_prev : null),
    hint: "Latest quarter vs the one before. A share issue (QIP) lowers it even when promoters sold nothing." },
  { id: "encumbered", group: "Ownership", label: "Promoter shares pledged or encumbered", op: "<", unit: "%", get: (r) => pc(r.encumbered_pct),
    hint: "Pledges plus non-disposal undertakings and other encumbrances: lenders can force a sale of all three." },

  { id: "roe", group: "Profitability", label: "Return on equity", op: ">", unit: "%", get: (r) => pc(r.roe),
    hint: "Last financial year's net profit ÷ average equity." },
  { id: "opm", group: "Profitability", label: "Operating profit margin", op: ">", unit: "%", get: (r) => pc(r.opm_ttm),
    hint: "Last 12 months. Operating profit is before other income, interest, depreciation and tax." },
  { id: "opm_rising", group: "Profitability", label: "Margin above the year before", op: ">", unit: "pts",
    get: (r) => (r.opm_fy != null && r.opm_fy1 != null ? (r.opm_fy - r.opm_fy1) * 100 : null), fixed: { value: 0, text: "Last financial year vs the one before" } },
  { id: "profit_q", group: "Profitability", label: "Net profit, latest quarter", op: ">", unit: "₹ Cr",
    get: (r) => (r.profit_q == null ? null : r.profit_q / 1e7), fixed: { value: 0, text: "A profit, not a loss" } },

  { id: "sales_g3", group: "Growth", label: "Sales growth, 3 years", op: ">", unit: "%", get: (r) => pc(r.sales_g3),
    hint: "Yearly rate (CAGR), last financial year vs three years before." },
  { id: "profit_g3", group: "Growth", label: "Profit growth, 3 years", op: ">", unit: "%", get: (r) => pc(r.profit_g3),
    hint: "Yearly rate (CAGR). None when the starting year was a loss." },
  { id: "sales_g_q", group: "Growth", label: "Sales growth, latest quarter vs a year ago", op: ">", unit: "%", get: (r) => pc(r.sales_g_q) },
  { id: "profit_g_q", group: "Growth", label: "Profit growth, latest quarter vs a year ago", op: ">", unit: "%", get: (r) => pc(r.profit_g_q),
    hint: "None when the year-ago quarter was a loss." },

  { id: "de", group: "Balance sheet", label: "Debt to equity", op: "<", unit: "×", get: (r) => r.de,
    hint: "Borrowings ÷ equity at the latest half-yearly balance sheet (lease liabilities not counted)." },

  { id: "cfo", group: "Cash flow", label: "Cash from operations ÷ net profit, 3 years", op: ">=", unit: "%", get: (r) => pc(r.cfo_to_profit), suggested: true,
    hint: "Profit that doesn't turn into cash (unpaid bills piling up, stock building up, accounting gains) is the commonest trap in growth screens." },
  { id: "cfo_positive", group: "Cash flow", label: "Cash from operations positive", op: ">=", unit: "", get: (r) => r.cfo_positive_years, suggested: true,
    fixed: { value: 3, text: "In each of the last 3 years" }, describe: (v) => `in ${v} of 3 years` },
  { id: "fcf", group: "Cash flow", label: "Free cash flow, last 3 years together", op: ">", unit: "₹ Cr", get: (r) => (r.fcf_3y == null ? null : r.fcf_3y / 1e7), suggested: true,
    hint: "Cash from operations minus spending on plant and equipment. A fast-growing company building factories can be negative for a while; three years together smooths that." },
  { id: "fcf_yield", group: "Cash flow", label: "Free cash flow yield", op: ">", unit: "%", get: (r) => pc(r.fcf_yield),
    hint: "The last 3 years' average free cash flow ÷ market cap: the cash the business makes for each ₹100 you pay for it." },

  { id: "other_income", group: "Quality checks", label: "Other income share of pre-tax profit", op: "<", unit: "%", suggested: true,
    get: (r) => (r.other_income_ttm != null && r.pbt_ttm != null && r.pbt_ttm > 0 ? (r.other_income_ttm / r.pbt_ttm) * 100 : null),
    hint: "Interest, gains on investments, one-offs: growth that comes from these isn't the business growing." },
  { id: "mcap", group: "Quality checks", label: "Market cap", op: ">=", unit: "₹ Cr", get: (r) => (r.market_cap == null ? null : r.market_cap / 1e7), suggested: true,
    hint: "Very small companies are easier to manipulate and their filings less scrutinised." },
  { id: "turnover", group: "Quality checks", label: "Average daily value traded", op: ">=", unit: "₹ Cr", get: (r) => (r.turnover == null ? null : r.turnover / 1e7), suggested: true,
    hint: "Over 3 months. With 70%+ held by promoters, little stock trades: you may not be able to sell when you want." },
];

export type Thresholds = Record<string, { on: boolean; value: number }>;

/** The screen exactly as written: Screener-style rules (not SME is built in: NSE main board only). */
export const AS_WRITTEN: Thresholds = {
  price: { on: true, value: 500 },
  pe: { on: true, value: 30 },
  peg: { on: false, value: 1.5 },
  promoter: { on: true, value: 70 },
  promoter_change: { on: true, value: 0 },
  encumbered: { on: true, value: 1 },
  roe: { on: true, value: 15 },
  opm: { on: true, value: 15 },
  opm_rising: { on: true, value: 0 },
  profit_q: { on: true, value: 0 },
  sales_g3: { on: true, value: 18 },
  profit_g3: { on: true, value: 18 },
  sales_g_q: { on: true, value: 18 },
  profit_g_q: { on: true, value: 18 },
  de: { on: true, value: 0.5 },
  cfo: { on: false, value: 80 },
  cfo_positive: { on: false, value: 3 },
  fcf: { on: false, value: 0 },
  fcf_yield: { on: false, value: 2 },
  other_income: { on: false, value: 25 },
  mcap: { on: false, value: 500 },
  turnover: { on: false, value: 1 },
};

/** As written, plus the cash flow and quality checks (free cash flow yield stays optional: it penalises companies
 *  investing heavily in growth), without the price cap (it isn't a fundamental) and with promoters above
 *  50% (above 70 leaves almost only PSUs and multinational subsidiaries). */
export const SUGGESTED: Thresholds = {
  ...AS_WRITTEN,
  price: { on: false, value: 500 },
  promoter: { on: true, value: 50 },
  cfo: { on: true, value: 80 },
  cfo_positive: { on: true, value: 3 },
  fcf: { on: true, value: 0 },
  other_income: { on: true, value: 25 },
  mcap: { on: true, value: 500 },
  turnover: { on: true, value: 1 },
};

export function passes(rule: Rule, v: number | null, value: number): boolean {
  if (v == null || !Number.isFinite(v)) return false;
  const t = rule.fixed ? rule.fixed.value : value;
  return rule.op === ">" ? v > t : rule.op === ">=" ? v >= t : v < t;
}

/** A rule counts when it's switched on and has a threshold (an emptied box leaves it out until refilled). */
export const active = (rule: Rule, th: Thresholds) => !!th[rule.id]?.on && (!!rule.fixed || Number.isFinite(th[rule.id].value));

/** The active rules a company fails (missing data counts as a fail). */
export function failures(r: FundamentalsRow, th: Thresholds): string[] {
  return RULES.filter((rule) => active(rule, th) && !passes(rule, rule.get(r), th[rule.id].value)).map((rule) => rule.id);
}

export const sameThresholds = (a: Thresholds, b: Thresholds) =>
  RULES.every((r) => a[r.id]?.on === b[r.id]?.on && (!a[r.id]?.on || r.fixed != null || a[r.id].value === b[r.id].value));
