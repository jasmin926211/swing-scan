"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { needsUpstox, runIdeas, type Idea, type IdeasResult, type MarketId } from "@/lib/api";
import { fmtDate, money, pct, price } from "@/lib/format";
import { PayoffChart } from "./charts/PayoffChart";

/** Futures and defined-risk option ideas for one expiry, valued under the option market's own implied volatility. */
export function FnoIdeas({ market, symbol, expiry }: { market: MarketId; symbol: string; expiry: string }) {
  const [result, setResult] = useState<IdeasResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0); // idea shown in the payoff chart

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    runIdeas(market, symbol, { expiry })
      .then((r) => {
        if (!alive) return;
        setResult(r);
        setSelected(0);
      })
      .catch((e) => alive && setError(needsUpstox(e) ? "Connect Upstox above to load Indian option prices first." : (e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [market, symbol, expiry]);

  return (
    <section className="rounded-xl border border-line">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Trade ideas for {fmtDate(expiry)} expiry</h2>
        <p className="mt-0.5 text-xs text-ink-3">
          Futures and defined-risk option trades on {symbol}, with their payoffs, valued under the option market&apos;s own pricing.
        </p>
      </div>
      {error && <p className="px-4 py-3 text-sm text-down">{error}</p>}
      {loading && !result && <div className="m-4 h-48 animate-pulse rounded-lg bg-wash" />}

      {result && (
        <div className={clsx("space-y-5 p-4", loading && "opacity-50")}>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 text-sm">
              <Stat label={`Market's 80% range at expiry (${result.days} days)`}
                value={`${price(result.range80[0], market)} – ${price(result.range80[1], market)}`} sub={`spot ${price(result.spot, market)}`} />
              <Stat label="Implied volatility (at the money)" value={pct(result.market_iv)} />
            </div>
            <div className="lg:col-span-2">
              {result.ideas[selected] ? (
                <>
                  <p className="mb-2 text-xs text-ink-2">
                    Payoff of <span className="font-medium text-ink">{result.ideas[selected].name}</span> at expiry · pick another idea in the table
                  </p>
                  <PayoffChart idea={result.ideas[selected]} finalPrices={result.final_prices} spot={result.spot} lotSize={result.lot_size} market={market} />
                </>
              ) : (
                <p className="text-sm text-ink-2">No option prices to chart.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-wash px-3 py-2 text-xs leading-relaxed text-ink-2">
            Chance of profit and average P&amp;L are what the option market&apos;s own prices imply (its implied volatility), before
            costs. That is the market&apos;s pricing, not a forecast: it says nothing about direction, and on average no idea has an
            edge over another. Every idea is listed in a fixed order, none is recommended. Analysis only, not advice.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="px-2 py-2 font-normal">Idea (per lot of {result.lot_size})</th>
                  <th className="px-2 py-2 text-right font-normal">Premium</th>
                  <th className="px-2 py-2 text-right font-normal">Max profit</th>
                  <th className="px-2 py-2 text-right font-normal">Max loss</th>
                  <th className="px-2 py-2 text-right font-normal">Breakeven</th>
                  <th className="px-2 py-2 text-right font-normal">Chance of profit</th>
                  <th className="px-2 py-2 text-right font-normal">Avg P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {result.ideas.map((i, k) => (
                  <IdeaRow key={i.name} idea={i} market={market} selected={k === selected} onSelect={() => setSelected(k)} />
                ))}
              </tbody>
            </table>
            {result.ideas.length === 0 && <p className="py-4 text-sm text-ink-2">No option prices to build ideas from.</p>}
          </div>
          <p className="text-xs text-ink-3">
            Premium: + is credit received, − is debit paid. “Open” means no limit (e.g. a bought call’s profit or a sold future’s loss).
            {result.future_price == null && market === "in" && " No futures contract expires on this date, so futures ideas are left out."}
          </p>
        </div>
      )}
    </section>
  );
}

function IdeaRow({ idea, market, selected, onSelect }: { idea: Idea; market: MarketId; selected: boolean; onSelect: () => void }) {
  const legs = idea.legs.map((l) =>
    l.kind === "FUT" ? `${l.side} future @ ${price(l.strike, market)}` : `${l.side} ${price(l.strike, market)} ${l.kind} @ ${price(l.price, market)}`,
  );
  return (
    <tr
      onClick={onSelect}
      aria-selected={selected}
      className={clsx("tabular cursor-pointer border-t border-line align-top transition-colors", selected ? "bg-select" : "hover:bg-wash")}
    >
      <td className="px-2 py-2.5">
        <p className="flex items-center gap-1.5 font-medium">
          {idea.name}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{legs.join(" · ")}</p>
      </td>
      <td className="px-2 py-2.5 text-right">{idea.net_premium ? money(idea.net_premium, market) : "—"}</td>
      <td className="px-2 py-2.5 text-right">{idea.max_profit == null ? "Open" : money(idea.max_profit, market)}</td>
      <td className="px-2 py-2.5 text-right">{idea.max_loss == null ? "Open" : money(idea.max_loss, market)}</td>
      <td className="px-2 py-2.5 text-right text-xs">{idea.breakevens.map((b) => price(b, market)).join(" / ") || "—"}</td>
      <td className="px-2 py-2.5 text-right">{pct(idea.market_prob_profit, 0)}</td>
      <td className="px-2 py-2.5 text-right text-ink-2">{money(idea.market_expected_pnl, market)}</td>
    </tr>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="tabular font-medium">
        {value} {sub && <span className="text-xs font-normal text-ink-3">· {sub}</span>}
      </p>
    </div>
  );
}
