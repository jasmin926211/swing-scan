"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Info, RotateCcw } from "lucide-react";
import { getFundamentals, type FundamentalsRow, type FundamentalsScreen } from "@/lib/api";
import { compact, price } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { AS_WRITTEN, RULES, SUGGESTED, active, failures, passes, sameThresholds, type Rule, type Thresholds } from "@/lib/screenRules";
import { useWidth } from "@/lib/charts/useWidth";
import { StockLogo } from "@/components/StockLogo";
import { StockValuation } from "@/components/fundamentals/StockValuation";

const RULES_KEY = "ct.fundamentals.rules";
const INPUT = "tabular w-16 rounded-lg border border-line bg-paper px-2 py-1 text-right text-sm text-ink outline-none focus:border-ink-3 disabled:opacity-40";
const CLOSEST_MAX_MISSES = 3;
const CLOSEST_ROWS = 60;
const GROUPS = ["Valuation", "Ownership", "Profitability", "Growth", "Balance sheet", "Quality checks"] as const;

const num = (v: number | null, d = 1) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));
const pctx = (v: number | null, d = 1) => (v == null ? "—" : `${num(v * 100, d)}%`);
const signedPctx = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${num(v * 100)}%`);
const quarter = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", month: "short", year: "2-digit" });

function withUnit(v: number, unit: Rule["unit"]) {
  const n = num(v, unit === "×" ? 2 : 1).replace(/\.0+$/, "");
  return unit === "₹" ? `₹${n}` : unit === "₹ Cr" ? `₹${n} Cr` : unit === "pts" ? `${n} pts` : `${n}${unit}`;
}

type Col = { key: string; label: string; title?: string; rule?: string; get: (r: FundamentalsRow) => number | null; fmt: (r: FundamentalsRow) => string; className?: string };
const COLS: Col[] = [
  { key: "price", label: "Price", rule: "price", get: (r) => r.price, fmt: (r) => price(r.price, "in") },
  { key: "pe", label: "P/E", rule: "pe", get: (r) => r.pe, fmt: (r) => num(r.pe) },
  { key: "peg", label: "PEG", rule: "peg", title: "P/E ÷ 3-year profit growth", get: (r) => r.peg, fmt: (r) => num(r.peg, 2), className: "hidden lg:table-cell" },
  { key: "roe", label: "ROE", rule: "roe", get: (r) => r.roe, fmt: (r) => pctx(r.roe) },
  { key: "opm", label: "OPM", rule: "opm", title: "Operating profit margin, last 12 months", get: (r) => r.opm_ttm, fmt: (r) => pctx(r.opm_ttm) },
  { key: "sales_g3", label: "Sales 3Y", rule: "sales_g3", title: "Sales growth a year, over 3 years", get: (r) => r.sales_g3, fmt: (r) => signedPctx(r.sales_g3) },
  { key: "profit_g3", label: "Profit 3Y", rule: "profit_g3", title: "Profit growth a year, over 3 years", get: (r) => r.profit_g3, fmt: (r) => signedPctx(r.profit_g3) },
  { key: "sales_g_q", label: "Sales qtr", rule: "sales_g_q", title: "Latest quarter's sales vs the same quarter a year ago", get: (r) => r.sales_g_q, fmt: (r) => signedPctx(r.sales_g_q) },
  { key: "profit_g_q", label: "Profit qtr", rule: "profit_g_q", title: "Latest quarter's profit vs the same quarter a year ago", get: (r) => r.profit_g_q, fmt: (r) => signedPctx(r.profit_g_q) },
  { key: "de", label: "D/E", rule: "de", title: "Debt to equity", get: (r) => r.de, fmt: (r) => num(r.de, 2) },
  { key: "promoter", label: "Promoter", rule: "promoter", get: (r) => r.promoter, fmt: (r) => (r.promoter == null ? "—" : `${num(r.promoter)}%`) },
  { key: "encumbered", label: "Pledged", rule: "encumbered", title: "Promoter shares pledged or otherwise encumbered", get: (r) => r.encumbered_pct, fmt: (r) => pctx(r.encumbered_pct), className: "hidden md:table-cell" },
  { key: "market_cap", label: "Mkt cap", rule: "mcap", get: (r) => r.market_cap, fmt: (r) => compact(r.market_cap, "in"), className: "hidden md:table-cell" },
];
type Sort = { key: string; desc: boolean };

function loadRules(): Thresholds {
  try {
    const saved = JSON.parse(localStorage.getItem(RULES_KEY) || "null");
    if (saved && typeof saved === "object") {
      const out = { ...AS_WRITTEN };
      for (const id of Object.keys(out)) {
        const v = saved[id];
        if (v && typeof v.on === "boolean") out[id] = { on: v.on, value: typeof v.value === "number" ? v.value : NaN };
      }
      return out;
    }
  } catch {}
  return AS_WRITTEN;
}

/** Fundamentals screen: NSE main-board companies filtered by their own filings' numbers, rules editable. */
export default function FundamentalsPage() {
  const { market } = useMarket();
  const [data, setData] = useState<FundamentalsScreen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [th, setTh] = useState<Thresholds>(AS_WRITTEN);
  const [showNear, setShowNear] = useState(true);
  const [sort, setSort] = useState<Sort>({ key: "market_cap", desc: true });
  const [open, setOpen] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [tableBox, tableWidth] = useWidth<HTMLDivElement>();

  useEffect(() => setTh(loadRules()), []);
  useEffect(() => {
    try {
      localStorage.setItem(RULES_KEY, JSON.stringify(th));
    } catch {}
  }, [th]);

  useEffect(() => {
    if (market !== "in") return;
    let alive = true;
    getFundamentals().then((d) => alive && setData(d)).catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [market]);

  const enabled = RULES.filter((r) => active(r, th));
  const evaluated = useMemo(() => (data?.rows ?? []).map((r) => ({ r, fails: failures(r, th) })), [data, th]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const rule of RULES) c[rule.id] = (data?.rows ?? []).filter((r) => passes(rule, rule.get(r), th[rule.id]?.value ?? 0)).length;
    return c;
  }, [data, th]);

  const sorter = (a: { r: FundamentalsRow }, b: { r: FundamentalsRow }) => {
    const col = COLS.find((c) => c.key === sort.key);
    const av = col ? col.get(a.r) : null;
    const bv = col ? col.get(b.r) : null;
    if (av == null && bv == null) return a.r.symbol.localeCompare(b.r.symbol);
    if (av == null) return 1;
    if (bv == null) return -1;
    return sort.desc ? bv - av : av - bv;
  };
  const pass = evaluated.filter((e) => e.fails.length === 0).sort(sorter);
  // Closest matches: fewest rules missed first (up to 3), then the chosen sort.
  const near = evaluated
    .filter((e) => e.fails.length > 0 && e.fails.length <= CLOSEST_MAX_MISSES)
    .sort((a, b) => a.fails.length - b.fails.length || sorter(a, b))
    .slice(0, CLOSEST_ROWS);
  const missOne = evaluated.filter((e) => e.fails.length === 1).length;
  const preset = sameThresholds(th, AS_WRITTEN) ? "written" : sameThresholds(th, SUGGESTED) ? "suggested" : "custom";
  const tightest = enabled.length ? enabled.reduce((a, b) => (counts[a.id] <= counts[b.id] ? a : b)) : null;

  if (market !== "in") {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Fundamentals screen</h1>
        <p className="max-w-2xl text-sm text-ink-2">
          This screen covers Indian companies (NSE main board) for now: it reads each company&apos;s own results and shareholding filings
          on NSE. Switch the country to India at the top to use it.
        </p>
      </div>
    );
  }

  const set = (id: string, patch: Partial<{ on: boolean; value: number }>) => setTh((t) => ({ ...t, [id]: { ...t[id], ...patch } }));
  const toggleSort = (key: string) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }));
  const covered = data?.rows.length ?? 0;

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Fundamentals screen</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-2">
          NSE main-board companies (no SME stocks) filtered by numbers from their own quarterly results and shareholding filings.
          A filter of facts, not a buy signal: we haven&apos;t tested whether stocks that pass it do better.
        </p>
        {data && (
          <p className="mt-1.5 text-xs text-ink-3">
            {covered.toLocaleString()} companies · filings checked {new Date(data.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ·
            prices live · {data.financial} banks, NBFCs and insurers left out (their accounts have no operating margin or debt-to-equity in the usual sense)
          </p>
        )}
      </section>

      {/* Rules: a query box above the results, so the table gets the full width */}
      <section className="rounded-xl border border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <button onClick={() => setRulesOpen(!rulesOpen)} className="flex items-center gap-2 text-left md:pointer-events-none" aria-expanded={rulesOpen}>
            <span className="text-sm font-semibold">Rules</span>
            <span className="text-xs text-ink-3">{enabled.length} on</span>
            <ChevronDown className={clsx("h-4 w-4 text-ink-3 transition-transform md:hidden", rulesOpen && "rotate-180")} />
          </button>
          <div className="flex flex-wrap items-center gap-1.5">
            <PresetButton active={preset === "written"} onClick={() => setTh(AS_WRITTEN)}>As you wrote it</PresetButton>
            <PresetButton active={preset === "suggested"} onClick={() => setTh(SUGGESTED)}>With suggested changes</PresetButton>
            {preset === "custom" && <span className="rounded-md bg-wash px-2 py-1 text-xs font-medium">Custom</span>}
          </div>
        </div>
        <div className={clsx("gap-x-8 px-4 md:grid md:grid-cols-2 xl:grid-cols-3", rulesOpen ? "grid" : "hidden")}>
          {GROUPS.map((g) => (
            <div key={g} className="border-b border-line py-3 last:border-b-0 md:border-b-0">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">{g}</p>
              <div className="space-y-2.5">
                {RULES.filter((r) => r.group === g).map((rule) => (
                  <RuleRow key={rule.id} rule={rule} t={th[rule.id]} count={counts[rule.id]} total={covered} loaded={!!data}
                    onToggle={(on) => set(rule.id, { on })} onValue={(value) => set(rule.id, { value })} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Results */}
      <section className="min-w-0 overflow-hidden rounded-xl border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-sm">
              {data ? (
                <>
                  <span className="font-semibold">{pass.length.toLocaleString()}</span> {pass.length === 1 ? "company passes" : "companies pass"} all {enabled.length} rules
                  {missOne > 0 && <span className="text-ink-3"> · {missOne} miss by one</span>}
                </>
              ) : error ? null : (
                <span className="text-ink-3">Loading filings data…</span>
              )}
            </p>
            {near.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-2">
                <input type="checkbox" checked={showNear} onChange={(e) => setShowNear(e.target.checked)} className="accent-[var(--color-ink)]" />
                Show closest matches
              </label>
            )}
          </div>

          {error && <p className="p-4 text-sm text-down">{error}</p>}

          {data && pass.length === 0 && tightest && (
            <p className="border-b border-line px-4 py-3 text-sm text-ink-2">
              No company passes every rule. The tightest is <span className="font-medium text-ink">{tightest.label}</span>: only{" "}
              {counts[tightest.id].toLocaleString()} of {covered.toLocaleString()} pass it on its own.
            </p>
          )}

          <div ref={tableBox} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="px-3 py-2.5 font-normal">Company</th>
                  {COLS.map((c) => (
                    <th key={c.key} className={clsx("px-2.5 py-2.5 text-right font-normal", c.className)} title={c.title}
                      aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : "none"}>
                      <button onClick={() => toggleSort(c.key)} className={clsx("inline-flex items-center gap-1 whitespace-nowrap hover:text-ink", sort.key === c.key && "text-ink")}>
                        {c.label}
                        {sort.key === c.key && (sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                      </button>
                    </th>
                  ))}
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {!data && !error &&
                  Array.from({ length: 8 }, (_, i) => (
                    <tr key={i} className="border-t border-line">
                      <td colSpan={COLS.length + 2} className="px-3 py-3">
                        <div className="h-5 animate-pulse rounded bg-wash" />
                      </td>
                    </tr>
                  ))}
                {pass.map(({ r }) => (
                  <ResultRow key={r.symbol} r={r} fails={[]} th={th} open={open === r.symbol} onOpen={() => setOpen(open === r.symbol ? null : r.symbol)} panelWidth={tableWidth} />
                ))}
                {showNear &&
                  near.map(({ r, fails }, i) => (
                    <Fragment key={r.symbol}>
                      {(i === 0 || near[i - 1].fails.length !== fails.length) && (
                        <tr className="border-t border-line bg-wash">
                          <td colSpan={COLS.length + 2} className="px-3 py-2 text-xs font-medium text-ink-2">
                            Miss {fails.length === 1 ? "one rule" : `${fails.length} rules`}
                            {i === 0 && <span className="font-normal text-ink-3"> · the failing numbers are marked</span>}
                          </td>
                        </tr>
                      )}
                      <ResultRow r={r} fails={fails} th={th} open={open === r.symbol} onOpen={() => setOpen(open === r.symbol ? null : r.symbol)} panelWidth={tableWidth} />
                    </Fragment>
                  ))}
              </tbody>
            </table>
          </div>
      </section>

      <Definitions />
    </div>
  );
}

function PresetButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={clsx("rounded-md px-2 py-1 text-xs transition-colors", active ? "bg-ink font-medium text-paper" : "bg-wash text-ink-2 hover:text-ink")}>
      {children}
    </button>
  );
}

function RuleRow({ rule, t, count, total, loaded, onToggle, onValue }: {
  rule: Rule; t: { on: boolean; value: number }; count: number; total: number; loaded: boolean;
  onToggle: (on: boolean) => void; onValue: (v: number) => void;
}) {
  const [why, setWhy] = useState(false);
  const op = rule.op === ">=" ? "≥" : rule.op;
  return (
    <div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={t.on} onChange={(e) => onToggle(e.target.checked)} aria-label={rule.label} className="h-3.5 w-3.5 shrink-0 accent-[var(--color-ink)]" />
        <span className={clsx("min-w-0 flex-1 text-sm leading-snug", t.on ? "text-ink" : "text-ink-3")}>
          {rule.label}
          {rule.suggested && <span className="ml-1.5 rounded bg-accent-wash px-1 text-[10px] text-accent">suggested</span>}
          {rule.hint && (
            <button onClick={() => setWhy(!why)} aria-label={`About ${rule.label}`} aria-expanded={why} className="ml-1 inline-flex align-middle text-ink-3 hover:text-ink">
              <Info className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
        {rule.fixed ? null : (
          <span className="flex shrink-0 items-center gap-1 text-xs text-ink-3">
            <span className="w-3 text-center">{op}</span>
            <input type="number" value={Number.isFinite(t.value) ? t.value : ""} disabled={!t.on} step={rule.unit === "×" ? 0.1 : 1}
              onChange={(e) => onValue(e.target.value === "" ? NaN : Number(e.target.value))} className={INPUT} aria-label={`${rule.label} threshold`} />
            <span className="w-7">{rule.unit}</span>
          </span>
        )}
      </div>
      <p className="ml-5.5 mt-0.5 text-[11px] text-ink-3">
        {rule.fixed && <span>{rule.fixed.text} · </span>}
        {loaded ? `${count.toLocaleString()} of ${total.toLocaleString()} pass on its own` : " "}
      </p>
      {why && rule.hint && <p className="ml-5.5 mt-1 text-xs leading-relaxed text-ink-2">{rule.hint}</p>}
    </div>
  );
}

function ResultRow({ r, fails, th, open, onOpen, panelWidth }: {
  r: FundamentalsRow; fails: string[]; th: Thresholds; open: boolean; onOpen: () => void; panelWidth: number;
}) {
  const failed = RULES.filter((x) => fails.includes(x.id));
  return (
    <Fragment>
      <tr onClick={onOpen} className={clsx("group cursor-pointer border-t border-line hover:bg-wash", open && "bg-select")} aria-expanded={open}>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:block">
              <StockLogo market="in" symbol={r.symbol} size={28} />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-medium">
                {r.symbol}
                <span className="rounded border border-line px-1 text-[10px] font-normal text-ink-3" title={`Latest results: quarter to ${r.quarter_end}`}>
                  {quarter(r.quarter_end)}
                </span>
              </p>
              <p className="max-w-[150px] truncate text-xs text-ink-3 sm:max-w-[220px]">{r.name}</p>
              {failed.map((x) => {
                const v = x.get(r);
                return (
                  <p key={x.id} className="mt-0.5 text-[11px] text-down">
                    ✕ {x.label}: {v == null ? "no data" : withUnit(v, x.unit)}
                    {!x.fixed && <span className="text-ink-3"> (rule {x.op === ">=" ? "≥" : x.op} {withUnit(th[x.id].value, x.unit)})</span>}
                  </p>
                );
              })}
            </div>
          </div>
        </td>
        {COLS.map((c) => {
          const bad = c.rule != null && fails.includes(c.rule);
          return (
            <td key={c.key} className={clsx("tabular whitespace-nowrap px-2.5 py-2.5 text-right", c.className, bad ? "bg-down-wash font-medium text-down" : "text-ink-2")}>
              {c.fmt(r)}
              {c.key === "promoter" && r.promoter != null && r.promoter_prev != null && r.promoter !== r.promoter_prev && (
                <span className={clsx("ml-1 text-[10px]", r.promoter > r.promoter_prev ? "text-up" : "text-down")}>
                  {r.promoter > r.promoter_prev ? "▲" : "▼"}
                  {Math.abs(r.promoter - r.promoter_prev).toFixed(2)}
                </span>
              )}
            </td>
          );
        })}
        <td className="pr-3 text-ink-3 group-hover:text-ink">
          <ChevronRight className={clsx("h-4 w-4 transition-transform", open && "rotate-90")} />
        </td>
      </tr>
      {open && (
        <tr className="border-t border-line">
          <td colSpan={COLS.length + 2} className="p-0">
            {/* Pinned to the visible width while the table scrolls sideways (phones) */}
            <div className="sticky left-0" style={{ width: panelWidth || undefined }}>
              <StockValuation row={r} />
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function Definitions() {
  return (
    <details className="rounded-xl border border-line px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium">Where the numbers come from</summary>
      <div className="mt-3 grid gap-x-8 gap-y-2 text-xs leading-relaxed text-ink-2 md:grid-cols-2">
        <p><span className="font-medium text-ink">Source.</span> Each company&apos;s quarterly results (XBRL) and shareholding pattern filed on NSE. Consolidated results when the company files them, otherwise standalone; the same basis for every period.</p>
        <p><span className="font-medium text-ink">Last 12 months.</span> The last financial year plus this year&apos;s results so far, minus last year&apos;s to the same quarter.</p>
        <p><span className="font-medium text-ink">Operating profit.</span> Sales minus expenses, before other income, interest, depreciation and tax. Margin = operating profit ÷ sales.</p>
        <p><span className="font-medium text-ink">Net profit.</span> The owners&apos; share (minority interests excluded). Growth from a loss year isn&apos;t defined and fails the rule.</p>
        <p><span className="font-medium text-ink">ROE.</span> Last financial year&apos;s net profit ÷ the average of its opening and closing equity.</p>
        <p><span className="font-medium text-ink">Debt to equity.</span> Short- and long-term borrowings ÷ equity, at the latest half-yearly balance sheet. Lease liabilities aren&apos;t counted.</p>
        <p><span className="font-medium text-ink">P/E.</span> Live price × shares ÷ last 12 months&apos; net profit. PEG divides it by the 3-year profit growth in %.</p>
        <p><span className="font-medium text-ink">Pledged.</span> Promoter shares pledged, under non-disposal undertakings, or otherwise encumbered, from the latest shareholding pattern.</p>
        <p><span className="font-medium text-ink">Missing numbers fail.</span> A company listed under three years ago has no 3-year growth, so it can&apos;t pass those rules.</p>
        <p><span className="font-medium text-ink">Mergers and demergers</span> change what a company is, so growth across one compares different businesses.</p>
      </div>
    </details>
  );
}
