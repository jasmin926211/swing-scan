"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { getPublicOverview, type MarketId, type PublicOverview, type PublicStock } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MARKETS, changeColor, compact, marketStateLabel, price, signedPct } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { IndexStrip } from "@/components/charts/IndexStrip";
import { StockLogo } from "@/components/StockLogo";

/** Public market view on the home page: indices, the largest stocks and today's movers. */
export function MarketSnapshot() {
  const { market, setMarket } = useMarket();
  const { user } = useAuth();
  const [data, setData] = useState<PublicOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    setData(null);
    async function load() {
      try {
        const d = await getPublicOverview(market);
        if (alive) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
      if (alive) timer = setTimeout(load, 30_000);
    }
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [market]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Market" className="flex rounded-lg border border-line p-0.5 text-sm">
          {(Object.keys(MARKETS) as MarketId[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={market === m}
              onClick={() => setMarket(m)}
              className={clsx("rounded-md px-3.5 py-1 transition-colors", market === m ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}
            >
              <span className="mr-1.5">{MARKETS[m].flag}</span>
              {MARKETS[m].name}
            </button>
          ))}
        </div>
        {data && (
          <p className="flex items-center gap-2 text-xs text-ink-3">
            <span className={clsx("h-1.5 w-1.5 rounded-full", data.market_open ? "bg-up" : "bg-ink-3")} />
            {marketStateLabel(data.indices[0]?.market_state)} · updated{" "}
            {new Date(data.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

      {error && !data && <p className="text-sm text-down">Live prices are unavailable right now: {error}</p>}

      <IndexStrip market={market} indices={data?.indices ?? null} open={data?.market_open ?? false} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={`Largest ${MARKETS[market].name === "India" ? "Indian" : "US"} stocks`} className="lg:col-span-2">
          <StockRows rows={data?.largest} market={market} showCap />
        </Panel>
        <div className="space-y-4">
          <Panel title="Top gainers today">
            <StockRows rows={data?.gainers} market={market} />
          </Panel>
          <Panel title="Top losers today">
            <StockRows rows={data?.losers} market={market} />
          </Panel>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-wash px-4 py-3 text-sm">
        <span className="text-ink-2">
          {user
            ? "You’re signed in: open the full market with every stock, charts and tested signals."
            : `Showing a preview. Sign in to browse all ${data ? data.listed.toLocaleString() : ""} ${MARKETS[market].name === "India" ? "Indian" : "US"} stocks, open charts and see the tested signals.`}
        </span>
        <Link href={user ? "/markets" : "/signup"} className="inline-flex items-center gap-1.5 font-medium text-ink hover:underline">
          {user ? "Open markets" : "Create a free account"} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function Panel({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={clsx("min-w-0 overflow-hidden rounded-xl border border-line", className)}>
      <h3 className="border-b border-line px-4 py-2.5 text-xs font-medium text-ink-2">{title}</h3>
      {children}
    </section>
  );
}

function StockRows({ rows, market, showCap }: { rows?: PublicStock[]; market: MarketId; showCap?: boolean }) {
  if (!rows) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: showCap ? 6 : 3 }, (_, i) => (
          <div key={i} className="h-5 animate-pulse rounded bg-wash" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) return <p className="px-4 py-3 text-sm text-ink-3">No data yet.</p>;
  return (
    // Fixed layout: price and change get set widths and the name column takes what's left, so a long company name
    // is cut off with "…" instead of widening the table past its card (the gainers / losers cards are narrow).
    <table className="w-full table-fixed text-sm">
      <tbody>
        {rows.map((s) => (
          <tr key={s.symbol} className="border-t border-line first:border-t-0">
            <td className="py-2 pl-4 pr-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <StockLogo market={market} symbol={s.symbol} size={28} />
                <div className="min-w-0">
                  {/* Members-only page: signed-out visitors are sent to sign in and brought back here. */}
                  <Link href={`/stock/${market}/${encodeURIComponent(s.symbol)}`} className="block truncate font-medium hover:underline">
                    {s.symbol}
                  </Link>
                  <p className="truncate text-xs text-ink-3" title={s.name ?? undefined}>{s.name}</p>
                </div>
              </div>
            </td>
            <td className="tabular w-28 px-2 py-2 text-right font-medium">{price(s.price, market)}</td>
            <td className={clsx("tabular w-20 py-2 pl-2 pr-4 text-right", changeColor(s.change_pct))}>{signedPct(s.change_pct)}</td>
            {showCap && <td className="tabular hidden w-28 py-2 pl-2 pr-4 text-right text-ink-2 sm:table-cell">{compact(s.market_cap, market)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
