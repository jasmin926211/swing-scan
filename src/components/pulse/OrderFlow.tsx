"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { getFlow, type Flow, type FlowStock } from "@/lib/api";
import { price } from "@/lib/format";
import { StockLogo } from "@/components/StockLogo";

const WINDOWS = ["5", "15", "30"] as const;
type Window = (typeof WINDOWS)[number];
const REFRESH_MS = 30_000;

/** India: stocks with heavy volume where buyers or sellers clearly dominate, over the last 5 / 15 / 30 minutes. */
export function OrderFlow() {
  const [data, setData] = useState<Flow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [win, setWin] = useState<Window>("15");

  const load = useCallback(async () => {
    try {
      setData(await getFlow("in"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Flow is unavailable");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const w = data?.windows[win];
  return (
    <section className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Buying & selling pressure now</h2>
          <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-ink-3">
            Liquid stocks trading at least {data?.heavy ?? 3}× their normal volume for this time of day, with buyers (or sellers) taking
            at least {Math.round((data?.dominant ?? 0.65) * 100)}% of it, over the last {win} minutes. What is happening now, not a signal:
            in testing, buying after heavy buying volume didn&apos;t pay, intraday or the next day.
          </p>
        </div>
        <div className="flex rounded-lg border border-line p-0.5 text-xs">
          {WINDOWS.map((x) => (
            <button key={x} onClick={() => setWin(x)}
              className={clsx("rounded-md px-2.5 py-1", win === x ? "bg-wash font-medium text-ink" : "text-ink-2 hover:text-ink")}>
              {x} min
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-ink-2">{error}</p>}
      {!data && !error && <div className="mt-3 h-40 animate-pulse rounded-lg bg-wash" />}
      {data && w && (
        <>
          <p className="mt-2 text-[11px] text-ink-3">
            {data.as_of
              ? `${data.market_open ? "Up to" : "Last session, up to"} ${data.as_of} IST · ${data.scanned} of ${data.universe} stocks scanned`
              : "Starts at 09:15 IST"}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <FlowList title={`Heavy buying · ${w.buying_count}`} list={w.buying} side="buy" />
            <FlowList title={`Heavy selling · ${w.selling_count}`} list={w.selling} side="sell" />
          </div>
        </>
      )}
    </section>
  );
}

function FlowList({ title, list, side }: { title: string; list: FlowStock[]; side: "buy" | "sell" }) {
  const up = side === "buy";
  return (
    <div className="min-w-0 text-xs">
      <p className={clsx("mb-1 text-[11px] font-medium", up ? "text-up" : "text-down")}>{title}</p>
      {list.length === 0 ? (
        <p className="py-1 text-ink-3">None right now.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((x) => {
            const share = up ? x.buyers : 1 - x.buyers;
            return (
              <li key={x.symbol}>
                <Link href={`/stock/in/${encodeURIComponent(x.symbol)}`} className="flex items-center gap-2 py-1.5 hover:bg-wash">
                  <StockLogo market="in" symbol={x.symbol} size={18} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{x.symbol}</span>
                    <span className="block text-[11px] text-ink-3">
                      {x.volume_x.toFixed(1)}× volume · {Math.round(share * 100)}% {up ? "buyers" : "sellers"}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-ink-2">{price(x.price, "in")}</span>
                    <span className={clsx("tabular block text-[11px]", x.move >= 0 ? "text-up" : "text-down")}
                      title="Move over the window">
                      {x.move >= 0 ? "+" : ""}{(x.move * 100).toFixed(2)}%
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
