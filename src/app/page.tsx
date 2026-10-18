"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getStocks, type MarketId, type Stock, type StockPage, type StockQuery } from "@/lib/api";
import { MARKETS, changeColor, compact, marketStateLabel, price, signedPct } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { RangeBar } from "@/components/RangeBar";

type SortKey = NonNullable<StockQuery["sort"]>;
type View = "all" | "gainers" | "losers" | "active";

const PAGE = 50;
// Gainers / losers only count stocks that traded at least this much today (₹1 Cr or $10M),
// so a tiny illiquid stock moving on a handful of shares doesn't top the list.
const MIN_TURNOVER: Record<MarketId, number> = { in: 1e7, us: 1e7 };

const VIEWS: { id: View; label: string; sort: SortKey; desc: boolean; liquid?: boolean }[] = [
  { id: "all", label: "All", sort: "market_cap", desc: true },
  { id: "gainers", label: "Top gainers", sort: "change_pct", desc: true, liquid: true },
  { id: "losers", label: "Top losers", sort: "change_pct", desc: false, liquid: true },
  { id: "active", label: "Most active", sort: "turnover", desc: true },
];

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Dashboard() {
  const { market } = useMarket();
  const router = useRouter();
  const [page, setPage] = useState<StockPage | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 250);
  const [sector, setSector] = useState("");
  const [exchange, setExchange] = useState("");
  const [foOnly, setFoOnly] = useState(false);
  const [view, setView] = useState<View>("all");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "market_cap", desc: true });
  const [offset, setOffset] = useState(0);

  const liquid = VIEWS.find((v) => v.id === view)?.liquid;
  const query: StockQuery = {
    q,
    sector,
    exchange,
    fo: foOnly,
    min_turnover: liquid ? MIN_TURNOVER[market] : undefined,
    sort: sort.key,
    desc: sort.desc,
    offset,
    limit: PAGE,
  };
  const queryKey = `${market}|${JSON.stringify(query)}`;
  const marketOpen = page?.market_open ?? false;

  // A new country starts from a clean slate.
  useEffect(() => {
    setPage(null);
    setSearch("");
    setSector("");
    setExchange("");
    setFoOnly(false);
    setOffset(0);
  }, [market]);

  // Any filter change goes back to the first page.
  useEffect(() => setOffset(0), [q, sector, exchange, foOnly, view, sort.key, sort.desc]);

  // Live quotes: re-poll every 15s while the market is open, every minute otherwise.
  // Background tabs skip polls and catch up as soon as they become visible again.
  useEffect(() => {
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
  }, [queryKey, marketOpen]);

  function chooseView(v: (typeof VIEWS)[number]) {
    setView(v.id);
    setSort({ key: v.sort, desc: v.desc });
  }

  function toggleSort(key: SortKey) {
    setView("all");
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "symbol" }));
  }

  const open = (symbol: string) => router.push(`/stock/${market}/${encodeURIComponent(symbol)}`);
  const typedTicker = search.trim().toUpperCase();
  const stale = page !== null && loadedKey !== queryKey;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {MARKETS[market].name} · {MARKETS[market].universe}
          </h1>
          <p className="mt-0.5 text-sm text-ink-2">
            {page ? `${page.priced.toLocaleString()} stocks with live prices. ` : ""}Pick one to run a Kronos forecast on it.
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

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(page?.indices ?? Array.from({ length: 4 }, () => null)).map((ix, i) => (
          <div key={ix?.ticker ?? i} className="rounded-xl border border-line p-4">
            {ix ? (
              <>
                <p className="text-xs text-ink-2">{ix.name}</p>
                <p className="tabular mt-1 text-lg font-semibold">{price(ix.price, market)}</p>
                <p className={clsx("tabular text-xs", changeColor(ix.change))}>
                  {ix.change != null && (ix.change > 0 ? "+" : "") + price(ix.change, market)} ({signedPct(ix.change_pct)})
                </p>
              </>
            ) : (
              <div className="h-[60px] animate-pulse rounded bg-wash" />
            )}
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-line">
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
          <Select value={exchange} onChange={setExchange} all="All exchanges" options={page?.exchanges ?? []} />
          <Select value={sector} onChange={setSector} all="All sectors" options={page?.sectors ?? []} />
          {market === "in" && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" checked={foOnly} onChange={(e) => setFoOnly(e.target.checked)} className="accent-[#0b0b0b]" />
              F&amp;O stocks
            </label>
          )}
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 text-sm">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => chooseView(v)}
                className={clsx(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors",
                  view === v.id ? "bg-wash font-medium text-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {error && !page && <p className="p-6 text-sm text-down">Could not load prices: {error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <Th onClick={() => toggleSort("symbol")} sort={sort} k="symbol">Stock</Th>
                <th className="hidden px-3 py-2.5 font-normal lg:table-cell">Sector</th>
                <Th onClick={() => toggleSort("price")} sort={sort} k="price" right>Price</Th>
                <Th onClick={() => toggleSort("change_pct")} sort={sort} k="change_pct" right>Change</Th>
                <th className="hidden px-3 py-2.5 font-normal md:table-cell">Day range</th>
                <Th onClick={() => toggleSort("turnover")} sort={sort} k="turnover" right className="hidden sm:table-cell">Value traded</Th>
                <Th onClick={() => toggleSort("market_cap")} sort={sort} k="market_cap" right className="hidden md:table-cell">Mkt cap</Th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className={clsx("transition-opacity", stale && "opacity-50")}>
              {!page &&
                Array.from({ length: 12 }, (_, i) => (
                  <tr key={i} className="border-t border-line">
                    <td colSpan={8} className="px-3 py-3">
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
            No stock matches.
            {/^[A-Z0-9.&^-]{1,20}$/.test(typedTicker) && (
              <button onClick={() => open(typedTicker)} className="ml-2 font-medium text-accent hover:underline">
                Open {typedTicker} anyway →
              </button>
            )}
          </div>
        )}
        {page && page.total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5 text-xs text-ink-3">
            <span>
              {(page.offset + 1).toLocaleString()}–{Math.min(page.offset + PAGE, page.total).toLocaleString()} of{" "}
              {page.total.toLocaleString()}
              {liquid && ` (value traded ≥ ${compact(MIN_TURNOVER[market], market)})`} · prices from Yahoo Finance
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
    </div>
  );
}

function Select({ value, onChange, all, options }: { value: string; onChange: (v: string) => void; all: string; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-[200px] rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-2 outline-none focus:border-ink-3"
    >
      <option value="">{all}</option>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
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

function Th({
  children,
  onClick,
  sort,
  k,
  right,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  sort: { key: SortKey; desc: boolean };
  k: SortKey;
  right?: boolean;
  className?: string;
}) {
  const active = sort.key === k;
  const Icon = sort.desc ? ArrowDown : ArrowUp;
  return (
    <th className={clsx("px-3 py-2.5 font-normal", right && "text-right", className)} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button onClick={onClick} className={clsx("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
        {children}
        {active && <Icon className="h-3 w-3" />}
      </button>
    </th>
  );
}

function Row({ s, market, onOpen }: { s: Stock; market: MarketId; onOpen: (symbol: string) => void }) {
  return (
    <tr onClick={() => onOpen(s.symbol)} className="group cursor-pointer border-t border-line hover:bg-wash">
      <td className="px-3 py-2.5">
        <p className="flex items-center gap-1.5 font-medium">
          {s.symbol}
          <span className="rounded border border-line px-1 text-[10px] font-normal text-ink-3">{s.exchange}</span>
          {s.fo && <span className="rounded bg-wash px-1 text-[10px] font-normal text-ink-2">F&amp;O</span>}
        </p>
        <p className="max-w-[140px] truncate text-xs text-ink-3 sm:max-w-[240px]">{s.name}</p>
      </td>
      <td className="hidden max-w-[180px] truncate px-3 py-2.5 text-xs text-ink-2 lg:table-cell">{s.sector || "—"}</td>
      <td className="tabular px-3 py-2.5 text-right font-medium">{price(s.price, market)}</td>
      <td className={clsx("tabular px-3 py-2.5 text-right", changeColor(s.change_pct))}>{signedPct(s.change_pct)}</td>
      <td className="hidden px-3 py-2.5 md:table-cell">
        <RangeBar low={s.low} high={s.high} value={s.price} market={market} />
      </td>
      <td className="tabular hidden px-3 py-2.5 text-right text-ink-2 sm:table-cell">{compact(s.turnover, market)}</td>
      <td className="tabular hidden px-3 py-2.5 text-right text-ink-2 md:table-cell">{compact(s.market_cap, market)}</td>
      <td className="pr-3 text-ink-3 group-hover:text-ink">
        <ChevronRight className="h-4 w-4" />
      </td>
    </tr>
  );
}
