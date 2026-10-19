"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { X } from "lucide-react";
import { getHistory, type Candle, type MarketId, type PulseCandidate } from "@/lib/api";
import { price } from "@/lib/format";
import { BreakoutChart } from "./BreakoutChart";
import { StockLogo } from "../StockLogo";

const INDEX: Record<MarketId, string> = { in: "^NSEI", us: "^GSPC" }; // the index Market Pulse compares with

/** Completed daily bars only: what last night's indicators were computed from (today is the live price). */
function completed(candles: Candle[], tz: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  return candles.filter((k) => new Date(k[0]).toISOString().slice(0, 10) < today);
}

/** A breakout candidate's conditions, each drawn on a real chart. */
export function CandidateDialog({ market, c, indexName, indexLive, tz, onClose }: {
  market: MarketId;
  c: PulseCandidate;
  indexName: string;
  indexLive: number | null;
  tz: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ stock: Candle[]; index: Candle[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getHistory(market, c.symbol, "1d"), getHistory(market, INDEX[market], "1d")])
      .then(([s, i]) => alive && setData({ stock: completed(s.candles, tz), index: completed(i.candles, tz) }))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load the chart"));
    return () => {
      alive = false;
    };
  }, [market, c.symbol, tz]);

  // Enter animation, Escape closes, focus moves into the dialog, and the page behind doesn't scroll.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  function close() {
    setShown(false);
    window.setTimeout(onClose, 180);
  }

  const met = Object.values(c.checks).filter(Boolean).length;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="cand-title">
      <div className={clsx("absolute inset-0 bg-black/45 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")} onClick={close} />
      <div className={clsx(
        "relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-line bg-paper shadow-xl transition-all duration-200 sm:rounded-2xl",
        shown ? "translate-y-0 opacity-100 sm:scale-100" : "translate-y-4 opacity-0 sm:scale-[0.98]",
      )}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <StockLogo market={market} symbol={c.symbol} size={36} />
            <div className="min-w-0">
              <h2 id="cand-title" className="text-base font-semibold">
                {c.symbol} · {met} of 6 conditions met
              </h2>
              <p className="truncate text-xs text-ink-3">
                {c.name ?? c.sector} · live {price(c.price, market)}{" "}
                <span className={(c.change_pct ?? 0) >= 0 ? "text-up" : "text-down"}>
                  {(c.change_pct ?? 0) >= 0 ? "+" : ""}{(c.change_pct ?? 0).toFixed(2)}%
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={`/stock/${market}/${encodeURIComponent(c.symbol)}`} className="hidden rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-ink-3 hover:text-ink sm:inline-block">
              Open stock page →
            </Link>
            <button ref={closeRef} onClick={close} aria-label="Close" className="rounded-lg p-1.5 text-ink-2 hover:bg-wash hover:text-ink">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-4">
          {error && <p className="text-sm text-down">{error}</p>}
          {!data && !error && <div className="h-[640px] animate-pulse rounded-xl bg-wash" />}
          {data && data.stock.length >= 30 && (
            <BreakoutChart market={market} c={c} candles={data.stock} index={data.index} indexName={indexName} indexLive={indexLive} tz={tz} />
          )}
          {data && data.stock.length < 30 && <p className="text-sm text-ink-2">Not enough price history to draw the indicators.</p>}
        </div>
      </div>
    </div>
  );
}
