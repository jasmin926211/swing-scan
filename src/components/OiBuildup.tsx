"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { getOiBuildup, type Buildup, type BuildupRow } from "@/lib/api";
import { compact, fmtDate, price } from "@/lib/format";
import { BUILDUP } from "./OiLevels";
import { StockLogo } from "./StockLogo";

const KINDS: Exclude<Buildup, "neutral">[] = ["long_buildup", "short_buildup", "short_covering", "long_unwinding"];
const pct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

/** India: which F&O stocks saw long build-up, short build-up, short covering or long unwinding on the last trading day. */
export function OiBuildup() {
  const [data, setData] = useState<{ date: string; rows: BuildupRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("long_buildup");

  useEffect(() => {
    getOiBuildup("in")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Open interest is unavailable"));
  }, []);

  // Biggest open-interest change first: where positions moved most.
  const rows = (data?.rows ?? []).filter((r) => r.buildup === kind).sort((a, b) => Math.abs(b.oi_chg_pct) - Math.abs(a.oi_chg_pct));

  return (
    <section className="overflow-hidden rounded-xl border border-line">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Futures build-up{data && ` · ${fmtDate(data.date)}`}</h2>
        <p className="mt-0.5 text-xs text-ink-3">
          Price change of the nearest future and the change in open interest across all expiries, from NSE&apos;s end-of-day
          file (updated each evening). It shows who added or closed positions, not where the price goes next.
        </p>
      </div>
      {error && <p className="px-4 py-3 text-sm text-ink-2">{error}</p>}
      {!data && !error && <div className="m-4 h-24 animate-pulse rounded-lg bg-wash" />}
      {data && (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-line px-3 text-sm">
            {KINDS.map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={clsx("-mb-px whitespace-nowrap border-b-2 px-2.5 py-2.5 transition-colors",
                  kind === k ? "border-ink font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink")}
              >
                {BUILDUP[k].label}
                <span className="tabular ml-1.5 text-xs text-ink-3">{data.rows.filter((r) => r.buildup === k).length}</span>
              </button>
            ))}
          </div>
          <p className="px-4 pt-2.5 text-xs text-ink-2">{BUILDUP[kind].meaning[0].toUpperCase() + BUILDUP[kind].meaning.slice(1)}.</p>
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-3">None on this day.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="tabular w-full table-fixed text-sm">
                <thead className="sticky top-0 bg-paper text-xs text-ink-3">
                  <tr className="text-left">
                    <th className="py-2 pl-4 pr-2 font-normal">Stock</th>
                    <th className="w-24 px-2 py-2 text-right font-normal">Futures</th>
                    <th className="w-20 px-2 py-2 text-right font-normal">Price</th>
                    <th className="w-20 px-2 py-2 text-right font-normal">OI</th>
                    <th className="hidden w-24 py-2 pl-2 pr-4 text-right font-normal sm:table-cell">Open interest</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.symbol} className="border-t border-line hover:bg-wash">
                      <td className="py-2 pl-4 pr-2">
                        <Link href={`/fno/in/${encodeURIComponent(r.symbol)}`} className="flex min-w-0 items-center gap-2 font-medium hover:underline">
                          {r.kind === "stock" ? (
                            <span className="hidden sm:block">
                              <StockLogo market="in" symbol={r.symbol} size={24} />
                            </span>
                          ) : (
                            <span className="rounded bg-wash px-1 text-[10px] font-normal text-ink-2">INDEX</span>
                          )}
                          <span className="truncate">{r.symbol}</span>
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-right">{price(r.price, "in")}</td>
                      <td className={clsx("px-2 py-2 text-right", r.price_chg_pct >= 0 ? "text-up" : "text-down")}>{pct(r.price_chg_pct)}</td>
                      <td className={clsx("px-2 py-2 text-right", r.oi_chg_pct >= 0 ? "text-up" : "text-down")}>{pct(r.oi_chg_pct)}</td>
                      <td className="hidden py-2 pl-2 pr-4 text-right text-ink-2 sm:table-cell">{compact(r.oi, "in")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
