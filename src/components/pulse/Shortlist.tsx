"use client";

import Link from "next/link";
import clsx from "clsx";
import type { MarketId, Pulse } from "@/lib/api";
import { compact, price } from "@/lib/format";
import { StockLogo } from "@/components/StockLogo";

const pct = (v: number, d = 1) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;

/** From every listed stock to 30: the funnel, then the list. The method is momentum strategy C, tested on 10 years. */
export function Shortlist({ data, record, market }: { data: Pulse["shortlist"]; record: Pulse["records"]["shortlist"]; market: MarketId }) {
  const max = data.funnel[0]?.count || 1;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <ol className="space-y-2" aria-label="How the shortlist is narrowed down">
          {data.funnel.map((f, i) => {
            const last = i === data.funnel.length - 1;
            return (
              <li key={f.label}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className={clsx(last ? "font-semibold text-ink" : "text-ink-2")}>{f.label}</span>
                  <span className="tabular text-ink-3">{f.count.toLocaleString()}</span>
                </div>
                <div className="h-6 rounded-md bg-wash">
                  <div className={clsx("h-full rounded-md transition-[width] duration-700", last ? "bg-up" : "bg-accent/60")}
                    style={{ width: `${Math.max(1.5, Math.sqrt(f.count / max) * 100)}%` }} />
                </div>
              </li>
            );
          })}
          <p className="pt-1 text-[11px] text-ink-3">Bar length on a square-root scale, so the small steps stay visible.</p>
        </ol>
        <div className="rounded-xl bg-wash p-4 text-sm leading-relaxed text-ink-2">
          <p className="font-semibold text-ink">Why these 30</p>
          <p className="mt-1">
            The 30 strongest stocks by momentum rating, among the most traded. Held as a group and refreshed monthly, this made{" "}
            <b className="text-ink">{pct(record.annual_return)} a year</b> after costs in 10 years of testing (2017–2026; {pct(record.halves[0])} and{" "}
            {pct(record.halves[1])} in the two halves), against {pct(record.pool_annual)} for holding all the most-traded stocks equally.
          </p>
          <p className="mt-2 text-xs text-ink-3">
            A group result for 1-month holds, not a signal on any one stock: many single names in it still fell, and the group itself
            dropped as much as {pct(record.max_drop, 0)} along the way. The test used only today&apos;s listed stocks, which flatters it.
            Low volatility and the 52-week high were tested as extra filters and didn&apos;t help.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-ink-3">
              <th className="w-8 pb-2 font-normal">#</th>
              <th className="pb-2 font-normal">Stock</th>
              <th className="pb-2 text-right font-normal">Momentum</th>
              <th className="pb-2 text-right font-normal">From 52-week high</th>
              <th className="pb-2 text-right font-normal">Traded / day</th>
              <th className="pb-2 text-right font-normal">Price</th>
              <th className="pb-2 text-right font-normal">Today</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.stocks.map((s, i) => (
              <tr key={s.symbol} className="hover:bg-wash">
                <td className="tabular py-2 text-xs text-ink-3">{i + 1}</td>
                <td className="py-2">
                  <Link href={`/stock/${market}/${encodeURIComponent(s.symbol)}`} className="flex items-center gap-2">
                    <StockLogo market={market} symbol={s.symbol} size={20} />
                    <span className="min-w-0">
                      <span className="block font-medium hover:underline">{s.symbol}</span>
                      {s.sector && <span className="block truncate text-[11px] text-ink-3">{s.sector}</span>}
                    </span>
                  </Link>
                </td>
                <td className="py-2 text-right">
                  <span className="tabular rounded bg-up-wash px-1.5 text-[11px] font-medium text-up">{s.rating}</span>
                </td>
                <td className="tabular py-2 text-right text-xs text-ink-2">
                  {s.from_high == null ? "—" : s.from_high > -0.005 ? "at high" : pct(s.from_high)}
                </td>
                <td className="tabular py-2 text-right text-xs text-ink-2">{compact(s.turnover20, market)}</td>
                <td className="tabular py-2 text-right">{price(s.price, market)}</td>
                <td className={clsx("tabular py-2 text-right text-xs", (s.change_pct ?? 0) >= 0 ? "text-up" : "text-down")}>
                  {s.change_pct == null ? "—" : `${s.change_pct >= 0 ? "+" : ""}${s.change_pct.toFixed(2)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
