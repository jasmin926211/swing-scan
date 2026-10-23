"use client";

import { useEffect, useState } from "react";
import { getExpectedMove, type ExpectedMove as Move, type MarketId } from "@/lib/api";
import { price } from "@/lib/format";

const LABEL: Record<number, string> = { 1: "Tomorrow", 5: "Next week", 10: "Next 2 weeks" };

const pctText = (v: number) => `${(Math.abs(v) * 100).toFixed(1)}%`;

/** How far the stock typically moves, and a stop-distance guide. (Position sizing is in the trade planner.) */
export function ExpectedMove({ market, symbol, livePrice }: { market: MarketId; symbol: string; livePrice?: number | null }) {
  const [data, setData] = useState<Move | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    getExpectedMove(market, symbol)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load"));
    return () => {
      alive = false;
    };
  }, [market, symbol]);

  const base = livePrice ?? data?.close ?? null;

  return (
    <section className="overflow-hidden rounded-xl border border-line">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Expected move</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
          How far {symbol} usually moves, from its daily high-low ranges over the last {data?.lookback ?? 20} sessions. Each range held
          8 in 10 moves when tested on {data?.tested ?? "past data"}. It says how much, not which way.
        </p>
      </div>
      {error && <p className="px-4 py-3 text-sm text-ink-2">{error}</p>}
      {!data && !error && <div className="m-4 h-24 animate-pulse rounded-lg bg-wash" />}
      {data && base != null && (
        <div>
          <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {data.horizons.map((h) => (
              <div key={h.days} className="px-4 py-3">
                <p className="text-xs text-ink-3">{LABEL[h.days] ?? `${h.days} days`}</p>
                <p className="tabular mt-1 text-xl font-semibold tracking-tight">±{pctText(h.likely.up)}</p>
                <p className="tabular mt-0.5 text-xs text-ink-2">
                  {price(base * (1 + h.likely.down), market)} – {price(base * (1 + h.likely.up), market)}
                </p>
                <p className="mt-1 text-[11px] text-ink-3">
                  Rare (1 in 20): beyond ±{pctText(h.rare.up)}
                </p>
              </div>
            ))}
          </div>
          <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-2">
            <span className="font-medium text-ink">Stop guide:</span> a stop less than {pctText(data.horizons[0].likely.down)} away
            ({price(base * (1 + data.horizons[0].likely.down), market)} for a buy) sits inside ordinary daily noise and gets hit about 1 day in 10
            with no real change in the trend. For a 2-week swing, normal movement reaches {pctText(data.horizons[2].likely.down)} on the downside.
          </p>
        </div>
      )}
    </section>
  );
}
