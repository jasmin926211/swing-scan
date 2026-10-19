"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import {
  getExpectedMove, getFnoOverview, getOptionChain, needsUpstox,
  type ExpectedMove, type FnoOverview, type MarketId, type OptionChain as Chain,
} from "@/lib/api";
import { MARKETS, compact, fmtDate, price } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { UpstoxConnect } from "@/components/UpstoxConnect";
import { OptionChain } from "@/components/OptionChain";
import { OiLevelsView, useStockOi } from "@/components/OiLevels";
import { FnoIdeas } from "@/components/FnoIdeas";
import { StockLogo } from "@/components/StockLogo";
import { AtAGlance } from "@/components/fno/AtAGlance";
import { Tabs, TabPanel, useHashTab } from "@/components/fno/Tabs";
import { Term } from "@/components/fno/Term";

const TABS = ["overview", "chain", "oi", "ideas"] as const;
type TabId = (typeof TABS)[number];

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
  const [tab, setTab] = useHashTab<TabId>(TABS, "overview");
  const oi = useStockOi(market, symbol);
  const [move, setMove] = useState<ExpectedMove | null>(null);
  const needsChain = tab === "chain" || tab === "oi";

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
        // Default to the next expiry after today: options expiring today say little about the coming days.
        const today = new Date().toLocaleDateString("en-CA");
        setExpiry(o.expiries.find((e) => e > today) ?? o.expiries[0] ?? null);
        setUpstoxNeeded(o.needs_upstox);
        // How far the stock usually moves (indices have no daily-range history here).
        if (o.kind === "EQUITY") getExpectedMove(market, symbol).then((m) => alive && setMove(m)).catch(() => {});
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [market, symbol]);

  // Option chain for the chosen expiry, loaded when a tab needs it; refreshed every 30s.
  useEffect(() => {
    if (!expiry || !needsChain) return;
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
  }, [market, symbol, expiry, needsChain]);

  return (
    <div className="space-y-6">
      <Link href="/fno" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {MARKETS[market].name} F&amp;O
      </Link>

      {error && <p className="text-sm text-down">{error}</p>}

      {overview && (
        <>
          <section className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-start gap-3">
              {overview.kind === "EQUITY" && <StockLogo market={market} symbol={overview.symbol} size={48} className="mt-0.5" />}
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
            </div>
            <div className="text-right">
              <p className="tabular text-3xl font-semibold tracking-tight">{price(overview.spot, market)}</p>
              <p className="text-xs text-ink-3">Lot size {overview.lot_size}</p>
            </div>
          </section>

          <AtAGlance market={market} oi={oi.data} move={move} spot={overview.spot} loading={!oi.error} />

          <div>
            <Tabs<TabId>
              label="F&O sections"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "overview", label: "Overview" },
                { id: "chain", label: "Option chain" },
                { id: "oi", label: "OI chart" },
                { id: "ideas", label: "AI trade ideas" },
              ]}
            />

            <TabPanel id="overview" active={tab === "overview"}>
              <OiLevelsView market={market} data={oi.data} error={oi.error} />
            {overview.futures && overview.futures.length > 0 && (
              <section className="rounded-xl border border-line">
                <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Futures contracts</h2>
                <div className="overflow-x-auto">
                  <table className="tabular w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-ink-3">
                        <th className="px-4 py-2 font-normal"><Term k="expiry">Contract</Term></th>
                        <th className="px-4 py-2 text-right font-normal">Price</th>
                        <th className="px-4 py-2 text-right font-normal">Change</th>
                        <th className="px-4 py-2 text-right font-normal"><Term k="premium">Premium to spot</Term></th>
                        <th className="px-4 py-2 text-right font-normal"><Term k="oi">OI</Term></th>
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
              <p className="text-xs text-ink-2">
                Next: see every strike in <TabLink to="chain" go={setTab}>Option chain</TabLink>, where the open interest sits in{" "}
                <TabLink to="oi" go={setTab}>OI chart</TabLink>, or defined-risk trades valued on the AI&apos;s paths in{" "}
                <TabLink to="ideas" go={setTab}>AI trade ideas</TabLink>.
              </p>
            </TabPanel>

            <TabPanel id="chain" active={tab === "chain"}>
              {market === "in" && upstoxNeeded && <UpstoxConnect />}
              <ExpiryPicker expiries={overview.expiries} value={expiry} onChange={setExpiry} />
              <ChainState chain={chain} error={chainError} upstoxNeeded={upstoxNeeded}>
                {chain && <OptionChain chain={chain} market={market} />}
              </ChainState>
            </TabPanel>

            <TabPanel id="oi" active={tab === "oi"}>
              {market === "in" && upstoxNeeded && <UpstoxConnect />}
              <ExpiryPicker expiries={overview.expiries} value={expiry} onChange={setExpiry} />
              <ChainState chain={chain} error={chainError} upstoxNeeded={upstoxNeeded}>
                {chain && <OptionChain chain={chain} market={market} view="chart" />}
              </ChainState>
            </TabPanel>

            <TabPanel id="ideas" active={tab === "ideas"}>
              {market === "in" && upstoxNeeded && <UpstoxConnect />}
              <ExpiryPicker expiries={overview.expiries} value={expiry} onChange={setExpiry} />
              {expiry && <FnoIdeas key={expiry} market={market} symbol={symbol} expiry={expiry} />}
            </TabPanel>
          </div>
        </>
      )}

      {!overview && !error && <div className="h-96 animate-pulse rounded-xl bg-wash" />}
    </div>
  );
}

function ExpiryPicker({ expiries, value, onChange }: { expiries: string[]; value: string | null; onChange: (e: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-3">
        <Term k="expiry">Expiry</Term>
      </span>
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 text-sm">
        {expiries.slice(0, 12).map((e) => (
          <button
            key={e}
            onClick={() => onChange(e)}
            aria-pressed={value === e}
            className={clsx("whitespace-nowrap rounded-md border px-2.5 py-1 transition-colors",
              value === e ? "border-ink bg-ink text-paper" : "border-line text-ink-2 hover:border-ink-3 hover:text-ink")}
          >
            {fmtDate(e)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChainState({ chain, error, upstoxNeeded, children }: { chain: Chain | null; error: string | null; upstoxNeeded: boolean; children: React.ReactNode }) {
  if (chain) return <section className="rounded-xl border border-line p-4">{children}</section>;
  if (error) return <p className="text-sm text-down">{error}</p>;
  if (upstoxNeeded) return <p className="text-sm text-ink-2">Live Indian option prices need the Upstox connection above.</p>;
  return <div className="h-64 animate-pulse rounded-xl bg-wash" />;
}

function TabLink({ to, go, children }: { to: TabId; go: (t: TabId) => void; children: React.ReactNode }) {
  return (
    <button onClick={() => go(to)} className="font-medium text-accent hover:underline">
      {children}
    </button>
  );
}
