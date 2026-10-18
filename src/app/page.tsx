"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronRight, Search } from "lucide-react";
import { getMarketStocks, type MarketStocks, type Stock } from "@/lib/api";
import { MARKETS, changeColor, compact, marketStateLabel, price, signedPct } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { RangeBar } from "@/components/RangeBar";

type SortKey = "symbol" | "price" | "change_pct" | "volume" | "market_cap";
type View = "all" | "gainers" | "losers" | "active";

const VIEWS: { id: View; label: string; sort: [SortKey, 1 | -1] }[] = [
  { id: "all", label: "All", sort: ["market_cap", -1] },
  { id: "gainers", label: "Top gainers", sort: ["change_pct", -1] },
  { id: "losers", label: "Top losers", sort: ["change_pct", 1] },
  { id: "active", label: "Most active", sort: ["volume", -1] },
];

export default function Dashboard() {
  const { market } = useMarket();
  const router = useRouter();
  const [data, setData] = useState<MarketStocks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [view, setView] = useState<View>("all");
  const [sort, setSort] = useState<[SortKey, 1 | -1]>(["market_cap", -1]);

  const marketOpen = data?.indices.some((i) => i.market_state === "REGULAR") ?? false;

  // Live quotes: poll every 15s while the market is open, every minute otherwise.
  // Background tabs skip polls and catch up as soon as they become visible again.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load(force = false) {
      clearTimeout(timer);
      if (force || document.visibilityState === "visible") {
        try {
          const next = await getMarketStocks(market);
          if (!alive) return;
          setData(next);
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
  }, [market, marketOpen]);

  // A new country starts from a clean slate.
  useEffect(() => {
    setData(null);
    setSector("");
    setQuery("");
  }, [market]);

  const sectors = useMemo(() => [...new Set(data?.stocks.map((s) => s.sector))].sort(), [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const [key, dir] = sort;
    return data.stocks
      .filter((s) => (!sector || s.sector === sector) && (!q || s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (key === "symbol") return dir * a.symbol.localeCompare(b.symbol);
        const av = a[key] ?? null;
        const bv = b[key] ?? null;
        if (av == null) return 1; // missing quotes always last
        if (bv == null) return -1;
        return dir * (av - bv);
      });
  }, [data, query, sector, sort]);

  function chooseView(v: (typeof VIEWS)[number]) {
    setView(v.id);
    setSort(v.sort);
  }

  function toggleSort(key: SortKey) {
    setView("all");
    setSort(([k, d]) => (k === key ? [key, d === 1 ? -1 : 1] : [key, key === "symbol" ? 1 : -1]));
  }

  const open = (symbol: string) => router.push(`/stock/${market}/${encodeURIComponent(symbol)}`);
  const typedTicker = query.trim().toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {MARKETS[market].name} · {MARKETS[market].universe}
          </h1>
          <p className="mt-0.5 text-sm text-ink-2">Pick a stock to run a Kronos forecast on it.</p>
        </div>
        {data && (
          <p className="flex items-center gap-2 text-xs text-ink-3">
            <span className={clsx("h-1.5 w-1.5 rounded-full", marketOpen ? "bg-up" : "bg-ink-3")} />
            {marketStateLabel(data.indices[0]?.market_state)} · updated{" "}
            {new Date(data.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(data?.indices ?? Array.from({ length: 4 }, () => null)).map((ix, i) => (
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
          <label className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol or company"
              className="w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm outline-none focus:border-ink-3"
            />
          </label>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="max-w-[220px] rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-2 outline-none focus:border-ink-3"
          >
            <option value="">All sectors</option>
            {sectors.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
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

        {error && !data && <p className="p-6 text-sm text-down">Could not load prices: {error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-3">
                <Th onClick={() => toggleSort("symbol")} sort={sort} k="symbol">Stock</Th>
                <th className="hidden px-3 py-2.5 font-normal lg:table-cell">Sector</th>
                <Th onClick={() => toggleSort("price")} sort={sort} k="price" right>Price</Th>
                <Th onClick={() => toggleSort("change_pct")} sort={sort} k="change_pct" right>Change</Th>
                <th className="hidden px-3 py-2.5 font-normal md:table-cell">Day range</th>
                <Th onClick={() => toggleSort("volume")} sort={sort} k="volume" right className="hidden sm:table-cell">Volume</Th>
                <Th onClick={() => toggleSort("market_cap")} sort={sort} k="market_cap" right className="hidden md:table-cell">Mkt cap</Th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {!data &&
                Array.from({ length: 12 }, (_, i) => (
                  <tr key={i} className="border-t border-line">
                    <td colSpan={8} className="px-3 py-3">
                      <div className="h-5 animate-pulse rounded bg-wash" />
                    </td>
                  </tr>
                ))}
              {rows.map((s) => (
                <Row key={s.symbol} s={s} market={market} onOpen={open} />
              ))}
            </tbody>
          </table>
        </div>

        {data && rows.length === 0 && (
          <div className="p-6 text-sm text-ink-2">
            No stock in the {MARKETS[market].universe} matches “{query}”.
            {/^[A-Z0-9.&^-]{1,20}$/.test(typedTicker) && (
              <button onClick={() => open(typedTicker)} className="ml-2 font-medium text-accent hover:underline">
                Open {typedTicker} anyway →
              </button>
            )}
          </div>
        )}
        {data && rows.length > 0 && (
          <p className="border-t border-line px-3 py-2.5 text-xs text-ink-3">
            {rows.length} of {data.stocks.length} stocks · prices from Yahoo Finance
          </p>
        )}
      </section>
    </div>
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
  sort: [SortKey, 1 | -1];
  k: SortKey;
  right?: boolean;
  className?: string;
}) {
  const active = sort[0] === k;
  const Icon = sort[1] === 1 ? ArrowUp : ArrowDown;
  return (
    <th className={clsx("px-3 py-2.5 font-normal", right && "text-right", className)} aria-sort={active ? (sort[1] === 1 ? "ascending" : "descending") : "none"}>
      <button onClick={onClick} className={clsx("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
        {children}
        {active && <Icon className="h-3 w-3" />}
      </button>
    </th>
  );
}

function Row({ s, market, onOpen }: { s: Stock; market: "in" | "us"; onOpen: (symbol: string) => void }) {
  return (
    <tr onClick={() => onOpen(s.symbol)} className="group cursor-pointer border-t border-line hover:bg-wash">
      <td className="px-3 py-2.5">
        <p className="font-medium">{s.symbol}</p>
        <p className="max-w-[220px] truncate text-xs text-ink-3">{s.name}</p>
      </td>
      <td className="hidden max-w-[180px] truncate px-3 py-2.5 text-xs text-ink-2 lg:table-cell">{s.sector}</td>
      <td className="tabular px-3 py-2.5 text-right font-medium">{price(s.price, market)}</td>
      <td className={clsx("tabular px-3 py-2.5 text-right", changeColor(s.change_pct))}>{signedPct(s.change_pct)}</td>
      <td className="hidden px-3 py-2.5 md:table-cell">
        <RangeBar low={s.low} high={s.high} value={s.price} market={market} />
      </td>
      <td className="tabular hidden px-3 py-2.5 text-right text-ink-2 sm:table-cell">{compact(s.volume, market)}</td>
      <td className="tabular hidden px-3 py-2.5 text-right text-ink-2 md:table-cell">{compact(s.market_cap, market)}</td>
      <td className="pr-3 text-ink-3 group-hover:text-ink">
        <ChevronRight className="h-4 w-4" />
      </td>
    </tr>
  );
}
