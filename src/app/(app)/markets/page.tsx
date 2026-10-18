"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { getStocks, type CapCategory, type MarketId, type Stock, type StockFilters, type StockPage, type StockQuery } from "@/lib/api";
import { MARKETS, changeColor, compact, marketStateLabel, price, signedPct } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { IndexStrip } from "@/components/charts/IndexStrip";
import { MarketHeatmap } from "@/components/charts/MarketHeatmap";
import { FilterPanel } from "@/components/screener/FilterPanel";

type SortKey = NonNullable<StockQuery["sort"]>;
type Sort = { key: SortKey; desc: boolean };
type Screen = { id: string; label: string; filters: StockFilters; sort: Sort };

const PAGE = 50;
const DEFAULT_SORT: Sort = { key: "market_cap", desc: true };
const CAP_TABS: { id: CapCategory | ""; label: string }[] = [
  { id: "", label: "All" },
  { id: "large", label: "Large cap" },
  { id: "mid", label: "Mid cap" },
  { id: "small", label: "Small cap" },
  { id: "micro", label: "Micro cap" },
];
const CAP_RULE: Record<MarketId, string> = {
  in: "India, by market-cap rank (SEBI): large 1–100, mid 101–250, small 251–500, micro the rest.",
  us: "USA, by market cap: large $10B+, mid $2–10B, small $300M–2B, micro under $300M.",
};
// Movers only count stocks that traded at least this much today, so a tiny illiquid stock moving
// on a handful of shares doesn't top the list.
const LIQUID: Record<MarketId, number> = { in: 1e7, us: 1e7 };

const SCREENS = (m: MarketId): Screen[] => [
  { id: "gainers", label: "Top gainers", filters: { min_turnover: LIQUID[m] }, sort: { key: "change_pct", desc: true } },
  { id: "losers", label: "Top losers", filters: { min_turnover: LIQUID[m] }, sort: { key: "change_pct", desc: false } },
  { id: "active", label: "Most active", filters: {}, sort: { key: "turnover", desc: true } },
  { id: "unusual", label: "Unusual volume", filters: { min_rel_volume: 2, min_turnover: LIQUID[m] }, sort: { key: "rel_volume", desc: true } },
  { id: "near_high", label: "Near 52-week high", filters: { near_high: 5, min_turnover: LIQUID[m] }, sort: { key: "from_high", desc: true } },
  { id: "near_low", label: "Near 52-week low", filters: { near_low: 5, min_turnover: LIQUID[m] }, sort: { key: "from_high", desc: false } },
];

// Filters that count as "active" in the Filters button badge (search and cap have their own controls).
const PANEL_KEYS: (keyof StockFilters)[] = [
  "sector", "exchange", "fo", "min_price", "max_price", "min_change", "max_change", "min_volume",
  "min_turnover", "min_rel_volume", "near_high", "near_low", "min_pe", "max_pe",
];
const isSet = (v: unknown) => v !== undefined && v !== null && v !== "" && v !== false;

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Remember the screen per market for this browser tab, so opening a stock and coming back keeps it. */
function loadSaved(m: MarketId): { filters: StockFilters; sort: Sort; screen: string } | null {
  try {
    return JSON.parse(sessionStorage.getItem(`ct.screener.${m}`) || "null");
  } catch {
    return null;
  }
}

export default function Markets() {
  const { market } = useMarket();
  const router = useRouter();
  const [page, setPage] = useState<StockPage | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 250);
  const [filters, setFilters] = useState<StockFilters>({});
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [screen, setScreen] = useState("");
  const [offset, setOffset] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [display, setDisplay] = useState<"list" | "heatmap">("list");
  const [restored, setRestored] = useState<MarketId | null>(null);

  // Restore (or reset) the screen whenever the country changes.
  useEffect(() => {
    const saved = loadSaved(market);
    setPage(null);
    setFilters(saved?.filters ?? {});
    setSort(saved?.sort ?? DEFAULT_SORT);
    setScreen(saved?.screen ?? "");
    setSearch(saved?.filters.q ?? "");
    setOffset(0);
    setRestored(market);
  }, [market]);

  const active: StockFilters = useMemo(() => ({ ...filters, q }), [filters, q]);
  useEffect(() => {
    if (restored !== market) return;
    try {
      sessionStorage.setItem(`ct.screener.${market}`, JSON.stringify({ filters: active, sort, screen }));
    } catch {
      // storage unavailable: the screen just isn't remembered
    }
  }, [active, sort, screen, market, restored]);

  const query: StockQuery = { ...active, sort: sort.key, desc: sort.desc, offset, limit: PAGE };
  const queryKey = `${market}|${JSON.stringify(query)}`;
  const marketOpen = page?.market_open ?? false;

  // Any change to the screen goes back to the first page.
  const screenKey = JSON.stringify([active, sort]);
  useEffect(() => setOffset(0), [screenKey]);

  // Live quotes: re-poll every 15s while the market is open, every minute otherwise.
  // Background tabs skip polls and catch up as soon as they become visible again.
  useEffect(() => {
    if (restored !== market) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const [m, json] = [queryKey.slice(0, 2) as MarketId, queryKey.slice(3)];
    const params: StockQuery = JSON.parse(json);
    async function load(force = false) {
      clearTimeout(timer);
      if (force || document.visibilityState === "visible") {
        try {
          const next = await getStocks(m, params);
          if (!alive) return;
          setPage(next);
          setLoadedKey(queryKey);
          setError(null);
        } catch (e) {
          if (alive) setError((e as Error).message);
        }
      }
      if (alive) timer = setTimeout(load, marketOpen ? 15_000 : 60_000);
    }
    const onVisible = () => document.visibilityState === "visible" && load();
    load(true);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryKey, marketOpen, restored, market]);

  function patchFilters(patch: Partial<StockFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setScreen("");
  }

  function applyScreen(s: Screen) {
    if (screen === s.id) return resetAll(); // clicking the active screen turns it off
    setFilters({ cap: filters.cap, ...s.filters });
    setSort(s.sort);
    setScreen(s.id);
  }

  function resetAll() {
    setFilters({ cap: filters.cap });
    setSort(DEFAULT_SORT);
    setScreen("");
    setSearch("");
  }

  function toggleSort(key: SortKey) {
    setScreen("");
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "symbol" }));
  }

  const open = (symbol: string) => router.push(`/stock/${market}/${encodeURIComponent(symbol)}`);
  const typedTicker = search.trim().toUpperCase();
  const stale = page !== null && loadedKey !== queryKey;
  const activeCount = PANEL_KEYS.filter((k) => isSet(filters[k])).length;
  const counts = page?.cap_counts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {MARKETS[market].name} · {MARKETS[market].universe}
          </h1>
          <p className="mt-0.5 text-sm text-ink-2">
            {page ? `${page.priced.toLocaleString()} stocks with live prices. ` : ""}Screen them down, then run an AI forecast on your picks.
          </p>
        </div>
        {page && (
          <p className="flex items-center gap-2 text-xs text-ink-3">
            <span className={clsx("h-1.5 w-1.5 rounded-full", marketOpen ? "bg-up" : "bg-ink-3")} />
            {marketStateLabel(page.indices[0]?.market_state)} · updated{" "}
            {new Date(page.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        )}
      </div>

      <IndexStrip market={market} indices={page?.indices ?? null} open={marketOpen} />

      <div role="tablist" aria-label="Market view" className="flex w-fit rounded-lg border border-line p-0.5 text-sm">
        {(["list", "heatmap"] as const).map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={display === d}
            onClick={() => setDisplay(d)}
            className={clsx("rounded-md px-3.5 py-1 transition-colors", display === d ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}
          >
            {d === "list" ? "Screener" : "Heatmap"}
          </button>
        ))}
      </div>

      {display === "heatmap" && <MarketHeatmap market={market} open={marketOpen} />}

      {display === "list" && (
        <section className="rounded-xl border border-line">
          {/* Cap categories */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 pt-3">
            <div role="tablist" aria-label="Market cap" className="-mb-px flex gap-1 overflow-x-auto text-sm">
              {CAP_TABS.map((t) => {
                const selected = (filters.cap ?? "") === t.id;
                const n = counts ? counts[t.id || "all"] : null;
                return (
                  <button
                    key={t.id || "all"}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setFilters((f) => ({ ...f, cap: t.id }))}
                    className={clsx(
                      "whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 transition-colors",
                      selected ? "border-ink font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink",
                    )}
                  >
                    {t.label}
                    {n != null && <span className="tabular ml-1.5 text-xs text-ink-3">{n.toLocaleString()}</span>}
                  </button>
                );
              })}
            </div>
            <p className="hidden pb-2.5 text-xs text-ink-3 lg:block" title={CAP_RULE[market]}>
              How caps are defined ⓘ
            </p>
          </div>

          {/* Search, quick screens, filters */}
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
            <label className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search symbol or company"
                className="w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm outline-none focus:border-ink-3"
              />
            </label>
            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              className={clsx(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                showFilters || activeCount ? "border-ink text-ink" : "border-line text-ink-2 hover:text-ink",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" /> Filters
              {activeCount > 0 && <span className="rounded-full bg-ink px-1.5 text-xs text-white">{activeCount}</span>}
            </button>
            {(activeCount > 0 || screen || search || sort.key !== DEFAULT_SORT.key || !sort.desc) && (
              <button onClick={resetAll} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
                <X className="h-3.5 w-3.5" /> Reset
              </button>
            )}
            <div className="flex w-full gap-1.5 overflow-x-auto pb-0.5 text-sm">
              <span className="self-center whitespace-nowrap pr-1 text-xs text-ink-3">Quick screens</span>
              {SCREENS(market).map((s) => (
                <button
                  key={s.id}
                  onClick={() => applyScreen(s)}
                  aria-pressed={screen === s.id}
                  className={clsx(
                    "whitespace-nowrap rounded-full border px-3 py-1 transition-colors",
                    screen === s.id ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:border-ink-3 hover:text-ink",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {showFilters && (
            <FilterPanel market={market} filters={filters} onChange={patchFilters} sectors={page?.sectors ?? []} exchanges={page?.exchanges ?? []} />
          )}

          {error && !page && <p className="p-6 text-sm text-down">Could not load prices: {error}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <Th onClick={() => toggleSort("symbol")} sort={sort} k="symbol">Stock</Th>
                  <Th onClick={() => toggleSort("price")} sort={sort} k="price" right>Price</Th>
                  <Th onClick={() => toggleSort("change_pct")} sort={sort} k="change_pct" right>Change</Th>
                  <Th onClick={() => toggleSort("volume")} sort={sort} k="volume" right className="hidden sm:table-cell">Volume</Th>
                  <Th onClick={() => toggleSort("rel_volume")} sort={sort} k="rel_volume" right className="hidden md:table-cell" title="Today's volume vs its 3-month average">Rel. vol</Th>
                  <Th onClick={() => toggleSort("turnover")} sort={sort} k="turnover" right className="hidden lg:table-cell">Value traded</Th>
                  <Th onClick={() => toggleSort("market_cap")} sort={sort} k="market_cap" right className="hidden md:table-cell">Mkt cap</Th>
                  <Th onClick={() => toggleSort("from_high")} sort={sort} k="from_high" right className="hidden lg:table-cell" title="Distance from the 52-week high">From 52W high</Th>
                  <Th onClick={() => toggleSort("pe")} sort={sort} k="pe" right className="hidden xl:table-cell">P/E</Th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className={clsx("transition-opacity", stale && "opacity-50")}>
                {!page &&
                  Array.from({ length: 12 }, (_, i) => (
                    <tr key={i} className="border-t border-line">
                      <td colSpan={10} className="px-3 py-3">
                        <div className="h-5 animate-pulse rounded bg-wash" />
                      </td>
                    </tr>
                  ))}
                {page?.rows.map((s) => <Row key={s.symbol} s={s} market={market} onOpen={open} />)}
              </tbody>
            </table>
          </div>

          {page && page.total === 0 && (
            <div className="p-6 text-sm text-ink-2">
              No stock matches this screen.{" "}
              <button onClick={resetAll} className="font-medium text-accent hover:underline">
                Reset filters
              </button>
              {/^[A-Z0-9.&^-]{1,20}$/.test(typedTicker) && (
                <button onClick={() => open(typedTicker)} className="ml-3 font-medium text-accent hover:underline">
                  Open {typedTicker} anyway →
                </button>
              )}
            </div>
          )}
          {page && page.total > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5 text-xs text-ink-3">
              <span>
                {(page.offset + 1).toLocaleString()}–{Math.min(page.offset + PAGE, page.total).toLocaleString()} of {page.total.toLocaleString()} stocks
                · prices from Yahoo Finance
              </span>
              <span className="flex gap-1">
                <PageButton disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} label="Previous page">
                  <ChevronLeft className="h-4 w-4" />
                </PageButton>
                <PageButton disabled={offset + PAGE >= page.total} onClick={() => setOffset(offset + PAGE)} label="Next page">
                  <ChevronRight className="h-4 w-4" />
                </PageButton>
              </span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function PageButton({ children, disabled, onClick, label }: { children: React.ReactNode; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-line p-1 text-ink-2 transition-colors hover:bg-wash disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Th({ children, onClick, sort, k, right, className, title }: {
  children: React.ReactNode; onClick: () => void; sort: Sort; k: SortKey; right?: boolean; className?: string; title?: string;
}) {
  const active = sort.key === k;
  const Icon = sort.desc ? ArrowDown : ArrowUp;
  return (
    <th className={clsx("px-3 py-2.5 font-normal", right && "text-right", className)} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"} title={title}>
      <button onClick={onClick} className={clsx("inline-flex items-center gap-1 whitespace-nowrap hover:text-ink", active && "text-ink")}>
        {children}
        {active && <Icon className="h-3 w-3" />}
      </button>
    </th>
  );
}

const CAP_LABEL: Record<CapCategory, string> = { large: "Large", mid: "Mid", small: "Small", micro: "Micro" };

function Row({ s, market, onOpen }: { s: Stock; market: MarketId; onOpen: (symbol: string) => void }) {
  const rel = s.rel_volume;
  return (
    <tr onClick={() => onOpen(s.symbol)} className="group cursor-pointer border-t border-line hover:bg-wash">
      <td className="px-3 py-2.5">
        <p className="flex items-center gap-1.5 font-medium">
          {s.symbol}
          <span className="rounded border border-line px-1 text-[10px] font-normal text-ink-3">{s.exchange}</span>
          {s.cap && <span className="hidden rounded bg-wash px-1 text-[10px] font-normal text-ink-2 sm:inline">{CAP_LABEL[s.cap]}</span>}
          {s.fo && <span className="rounded bg-wash px-1 text-[10px] font-normal text-ink-2">F&amp;O</span>}
        </p>
        <p className="max-w-[140px] truncate text-xs text-ink-3 sm:max-w-[240px]">{s.name}</p>
      </td>
      <td className="tabular px-3 py-2.5 text-right font-medium">{price(s.price, market)}</td>
      <td className={clsx("tabular px-3 py-2.5 text-right", changeColor(s.change_pct))}>{signedPct(s.change_pct)}</td>
      <td className="tabular hidden px-3 py-2.5 text-right text-ink-2 sm:table-cell">{compact(s.volume, market)}</td>
      <td className={clsx("tabular hidden px-3 py-2.5 text-right md:table-cell", rel != null && rel >= 2 ? "font-medium text-ink" : "text-ink-2")}>
        {rel == null ? "—" : `${rel.toFixed(1)}×`}
      </td>
      <td className="tabular hidden px-3 py-2.5 text-right text-ink-2 lg:table-cell">{compact(s.turnover, market)}</td>
      <td className="tabular hidden px-3 py-2.5 text-right text-ink-2 md:table-cell">{compact(s.market_cap, market)}</td>
      <td className="tabular hidden px-3 py-2.5 text-right text-ink-2 lg:table-cell">{s.from_high == null ? "—" : `${s.from_high.toFixed(1)}%`}</td>
      <td className="tabular hidden px-3 py-2.5 text-right text-ink-2 xl:table-cell">{s.pe == null ? "—" : s.pe.toFixed(1)}</td>
      <td className="pr-3 text-ink-3 group-hover:text-ink">
        <ChevronRight className="h-4 w-4" />
      </td>
    </tr>
  );
}
