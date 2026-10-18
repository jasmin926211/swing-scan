"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { getFnoOverview, getOptionChain, needsUpstox, type FnoOverview, type MarketId, type OptionChain as Chain } from "@/lib/api";
import { MARKETS, compact, fmtDate, price } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { UpstoxConnect } from "@/components/UpstoxConnect";
import { OptionChain } from "@/components/OptionChain";
import { FnoIdeas } from "@/components/FnoIdeas";

export default function FnoPage() {
  const params = useParams<{ market: string; symbol: string }>();
  const market: MarketId = params.market === "us" ? "us" : "in";
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const { setMarket } = useMarket();

  const [overview, setOverview] = useState<FnoOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<string | null>(null);
  const [chain, setChain] = useState<Chain | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const [upstoxNeeded, setUpstoxNeeded] = useState(false);

  // Opening a contract link selects its country in the header (only on route change).
  useEffect(() => {
    setMarket(market);
  }, [market, setMarket]);

  useEffect(() => {
    let alive = true;
    setOverview(null);
    setError(null);
    getFnoOverview(market, symbol)
      .then((o) => {
        if (!alive) return;
        setOverview(o);
        setExpiry(o.expiries[0] ?? null);
        setUpstoxNeeded(o.needs_upstox);
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [market, symbol]);

  // Option chain for the chosen expiry; refreshed every 30s.
  useEffect(() => {
    if (!expiry) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    setChain(null);
    setChainError(null);
    async function load() {
      try {
        const c = await getOptionChain(market, symbol, expiry!);
        if (alive) {
          setChain(c);
          setChainError(null);
        }
      } catch (e) {
        if (!alive) return;
        if (needsUpstox(e)) setUpstoxNeeded(true);
        else setChainError((e as Error).message);
        return; // no retry loop until the user fixes it
      }
      if (alive) timer = setTimeout(load, 30_000);
    }
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [market, symbol, expiry]);

  return (
    <div className="space-y-6">
      <Link href="/fno" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {MARKETS[market].name} F&amp;O
      </Link>

      {error && <p className="text-sm text-down">{error}</p>}

      {overview && (
        <>
          <section className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                {overview.symbol}
                <span className="rounded border border-line px-1.5 text-xs font-normal text-ink-3">{overview.kind === "INDEX" ? "INDEX" : "STOCK"}</span>
              </h1>
              <p className="mt-0.5 text-sm text-ink-2">{overview.name}</p>
              {overview.kind === "EQUITY" && (
                <Link href={`/stock/${market}/${encodeURIComponent(symbol)}`} className="mt-2 inline-flex text-sm font-medium text-accent hover:underline">
                  Price chart &amp; forecast →
                </Link>
              )}
            </div>
            <div className="text-right">
              <p className="tabular text-3xl font-semibold tracking-tight">{price(overview.spot, market)}</p>
              <p className="text-xs text-ink-3">Lot size {overview.lot_size}</p>
            </div>
          </section>

          {market === "in" && upstoxNeeded && <UpstoxConnect />}

          {overview.futures && overview.futures.length > 0 && (
            <section className="rounded-xl border border-line">
              <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Futures</h2>
              <div className="overflow-x-auto">
                <table className="tabular w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-3">
                      <th className="px-4 py-2 font-normal">Contract</th>
                      <th className="px-4 py-2 text-right font-normal">Price</th>
                      <th className="px-4 py-2 text-right font-normal">Change</th>
                      <th className="px-4 py-2 text-right font-normal">Premium to spot</th>
                      <th className="px-4 py-2 text-right font-normal">OI</th>
                      <th className="px-4 py-2 text-right font-normal">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.futures.map((f) => (
                      <tr key={f.expiry} className="border-t border-line">
                        <td className="px-4 py-2">{f.trading_symbol}</td>
                        <td className="px-4 py-2 text-right font-medium">{price(f.price, market)}</td>
                        <td className={clsx("px-4 py-2 text-right", (f.change ?? 0) >= 0 ? "text-up" : "text-down")}>
                          {f.change != null ? `${f.change > 0 ? "+" : ""}${price(f.change, market)}` : "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-ink-2">
                          {f.price != null && overview.spot ? price(f.price - overview.spot, market) : "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-ink-2">{compact(f.oi, market)}</td>
                        <td className="px-4 py-2 text-right text-ink-2">{compact(f.volume, market)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-line">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">Option chain</h2>
              <div className="-mx-1 flex gap-1 overflow-x-auto px-1 text-sm">
                {overview.expiries.slice(0, 12).map((e) => (
                  <button
                    key={e}
                    onClick={() => setExpiry(e)}
                    className={clsx(
                      "whitespace-nowrap rounded-md px-2.5 py-1 transition-colors",
                      expiry === e ? "bg-ink text-white" : "text-ink-2 hover:bg-wash",
                    )}
                  >
                    {fmtDate(e)}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              {chain ? (
                <OptionChain chain={chain} market={market} />
              ) : chainError ? (
                <p className="text-sm text-down">{chainError}</p>
              ) : upstoxNeeded ? (
                <p className="text-sm text-ink-2">Connect Upstox above to see the live option chain.</p>
              ) : (
                <div className="h-64 animate-pulse rounded-lg bg-wash" />
              )}
            </div>
          </section>

          {expiry && <FnoIdeas key={expiry} market={market} symbol={symbol} expiry={expiry} />}
        </>
      )}

      {!overview && !error && <div className="h-96 animate-pulse rounded-xl bg-wash" />}
    </div>
  );
}
