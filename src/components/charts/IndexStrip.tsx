"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { getSparklines, type IndexQuote, type MarketId, type Sparkline as SparklineData } from "@/lib/api";
import { changeColor, price, signedPct } from "@/lib/format";
import { AnimatedNumber } from "./AnimatedNumber";
import { Sparkline } from "./Sparkline";

/** Headline index cards: live price that counts to each update, today's change and an intraday sparkline. */
export function IndexStrip({ market, indices, open }: { market: MarketId; indices: IndexQuote[] | null; open: boolean }) {
  const [lines, setLines] = useState<Record<string, SparklineData>>({});

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    setLines({});
    async function load() {
      try {
        const data = await getSparklines(market);
        if (alive) setLines(Object.fromEntries(data.map((d) => [d.ticker, d])));
      } catch {
        // sparklines are decoration: keep the cards without them
      }
      if (alive) timer = setTimeout(load, open ? 60_000 : 300_000);
    }
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [market, open]);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {(indices ?? Array.from({ length: 4 }, () => null)).map((ix, i) => {
        const line = ix ? lines[ix.ticker] : undefined;
        return (
          <div key={ix?.ticker ?? i} className="flex items-end justify-between gap-2 rounded-xl border border-line p-4">
            {ix ? (
              <>
                <div className="min-w-0">
                  <p className="text-xs text-ink-2">{ix.name}</p>
                  <AnimatedNumber value={ix.price} format={(v) => price(v, market)} className="mt-1 block text-lg font-semibold" />
                  <p className={clsx("tabular text-xs", changeColor(ix.change))}>
                    {ix.change != null && (ix.change > 0 ? "+" : "") + price(ix.change, market)} ({signedPct(ix.change_pct)})
                  </p>
                </div>
                <div className="hidden shrink-0 sm:block">
                  {line && <Sparkline points={line.points} prevClose={line.prev_close} width={110} height={44} />}
                </div>
              </>
            ) : (
              <div className="h-[60px] w-full animate-pulse rounded bg-wash" />
            )}
          </div>
        );
      })}
    </div>
  );
}
