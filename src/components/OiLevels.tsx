"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import { getStockOi, type Buildup, type MarketId, type OiStrike, type StockOi } from "@/lib/api";
import { compact, fmtDate, price } from "@/lib/format";

export const BUILDUP: Record<Buildup, { label: string; meaning: string; cls: string }> = {
  long_buildup: { label: "Long build-up", meaning: "price up and open interest up: new buyers entering", cls: "bg-up-wash text-up" },
  short_buildup: { label: "Short build-up", meaning: "price down and open interest up: new sellers entering", cls: "bg-down-wash text-down" },
  short_covering: { label: "Short covering", meaning: "price up and open interest down: sellers closing positions", cls: "bg-accent-wash text-accent" },
  long_unwinding: { label: "Long unwinding", meaning: "price down and open interest down: buyers closing positions", cls: "bg-warn-wash text-warn" },
  neutral: { label: "No clear build-up", meaning: "price or open interest barely changed", cls: "bg-wash text-ink-2" },
};

const pct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

/** Open-interest levels for an F&O stock: option walls (support / resistance), PCR, max pain and the futures build-up. */
export function OiLevels({ market, symbol }: { market: MarketId; symbol: string }) {
  const [data, setData] = useState<StockOi | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    getStockOi(market, symbol)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Open interest is unavailable"));
    return () => {
      alive = false;
    };
  }, [market, symbol]);

  return (
    <section className="overflow-hidden rounded-xl border border-line">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Open interest</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            Where option sellers are positioned, and who is adding futures positions.{" "}
            {data && (data.as_of ? `End of day ${fmtDate(data.as_of)}, ${data.source}.` : `Live, ${data.source}.`)}
            {data && ` Nearest expiry ${fmtDate(data.expiry)}.`}
          </p>
        </div>
        {data?.buildup && (
          <span className={clsx("rounded-full px-2.5 py-1 text-xs font-medium", BUILDUP[data.buildup.buildup].cls)}
            title={BUILDUP[data.buildup.buildup].meaning}>
            {BUILDUP[data.buildup.buildup].label}
          </span>
        )}
      </div>

      {error && <p className="px-4 py-3 text-sm text-ink-2">{error}</p>}
      {!data && !error && <div className="m-4 h-24 animate-pulse rounded-lg bg-wash" />}
      {data && (
        <>
          <div className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
            <Level label="Resistance (most call OI)" value={data.resistance} prev={data.prev_resistance} market={market} />
            <Level label="Support (most put OI)" value={data.support} prev={data.prev_support} market={market} />
            <div className="px-4 py-3">
              <p className="text-xs text-ink-3">Put-call ratio</p>
              <p className="tabular mt-1 text-lg font-semibold">{data.pcr != null ? data.pcr.toFixed(2) : "—"}</p>
              <p className="text-[11px] text-ink-3">{data.pcr == null ? "" : data.pcr >= 1.2 ? "more puts written" : data.pcr <= 0.7 ? "more calls written" : "balanced"}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-ink-3">Max pain</p>
              <p className="tabular mt-1 text-lg font-semibold">{data.max_pain != null ? price(data.max_pain, market) : "—"}</p>
              <p className="text-[11px] text-ink-3">where option buyers lose most at expiry</p>
            </div>
          </div>

          {data.buildup && (
            <p className="border-t border-line px-4 py-2.5 text-xs text-ink-2">
              <span className="font-medium text-ink">Futures:</span> price {pct(data.buildup.price_chg_pct)}, open interest{" "}
              {pct(data.buildup.oi_chg_pct)} (now {compact(data.buildup.oi, market)} shares across all expiries): {BUILDUP[data.buildup.buildup].meaning}.
            </p>
          )}

          <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
            <Walls title="Biggest call OI (resistance)" rows={data.top_calls} market={market} spot={data.spot} />
            <Walls title="Biggest put OI (support)" rows={data.top_puts} market={market} spot={data.spot} />
          </div>

          <p className="border-t border-line px-4 py-2.5 text-[11px] leading-relaxed text-ink-3">
            Common readings, not tested predictions: option sellers tend to defend the strikes where they hold the most
            open interest, and these walls do get broken, especially on news or near expiry. Use them as levels, like support and
            resistance on the chart.
          </p>
        </>
      )}
    </section>
  );
}

function Level({ label, value, prev, market }: { label: string; value: number | null; prev: number | null; market: MarketId }) {
  const moved = value != null && prev != null && value !== prev;
  return (
    <div className="px-4 py-3">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold">{value != null ? price(value, market) : "—"}</p>
      {moved ? (
        <p className={clsx("flex items-center gap-1 text-[11px]", value! > prev! ? "text-up" : "text-down")}>
          {value! > prev! ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />} moved from {price(prev, market)}
        </p>
      ) : (
        prev != null && <p className="text-[11px] text-ink-3">unchanged since the day before</p>
      )}
    </div>
  );
}

function Walls({ title, rows, market, spot }: { title: string; rows: OiStrike[]; market: MarketId; spot: number | null }) {
  return (
    <div className="bg-paper px-4 py-3">
      <p className="text-xs text-ink-3">{title}</p>
      <table className="tabular mt-1.5 w-full text-xs">
        <tbody>
          {rows.map((r) => (
            <tr key={r.strike}>
              <td className="py-0.5 text-ink">
                {price(r.strike, market)}
                {spot != null && <span className="ml-1.5 text-ink-3">({pct(r.strike / spot - 1)} from price)</span>}
              </td>
              <td className="py-0.5 text-right text-ink-2">{compact(r.oi, market)}</td>
              <td className={clsx("w-16 py-0.5 text-right", r.oi_change == null ? "text-ink-3" : r.oi_change >= 0 ? "text-up" : "text-down")}>
                {r.oi_change == null ? "" : `${r.oi_change >= 0 ? "+" : ""}${compact(r.oi_change, market)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
