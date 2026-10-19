"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronRight, Search } from "lucide-react";
import { getFnoUnderlyings, type FnoUnderlying } from "@/lib/api";
import { MARKETS, changeColor, compact, fmtDate, price, signedPct } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { UpstoxConnect } from "@/components/UpstoxConnect";
import { StockLogo } from "@/components/StockLogo";
import { OiBuildup } from "@/components/OiBuildup";
import { Tabs, TabPanel, useHashTab } from "@/components/fno/Tabs";
import { Term } from "@/components/fno/Term";

const LIST_TABS = ["all", "buildup"] as const;
type ListTab = (typeof LIST_TABS)[number];

export default function FnoHome() {
  const { market } = useMarket();
  const router = useRouter();
  const [rows, setRows] = useState<FnoUnderlying[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useHashTab<ListTab>(LIST_TABS, "all");

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    getFnoUnderlyings(market)
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [market]);

  const q = search.trim().toUpperCase();
  const shown = useMemo(
    () => (rows ?? []).filter((r) => !q || r.symbol.includes(q) || r.name.toUpperCase().includes(q)),
    [rows, q],
  );
  const open = (symbol: string) => router.push(`/fno/${market}/${encodeURIComponent(symbol)}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{MARKETS[market].name} · Futures &amp; options</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          {market === "in"
            ? "Every NSE F&O stock and index. Open one for a plain-language summary of its open interest, the option chain and AI trade ideas."
            : "US stocks have options (no single-stock futures). The 200 largest are listed; search to open any other."}{" "}
          Analysis only — place orders in your broker app.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
          <span>New to F&amp;O? Tap ⓘ:</span>
          <Term k="oi">Open interest</Term>
          <Term k="buildup">Build-up</Term>
          <Term k="pcr">PCR</Term>
          <Term k="max_pain">Max pain</Term>
          <Term k="lot">Lot size</Term>
        </p>
      </div>

      {market === "in" && (
        <Tabs<ListTab>
          label="F&O lists"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "all", label: "All stocks & indices", badge: rows?.length },
            { id: "buildup", label: "Futures build-up" },
          ]}
        />
      )}

      <TabPanel id="buildup" active={market === "in" && tab === "buildup"}>
        <OiBuildup />
      </TabPanel>

      {(market !== "in" || tab === "all") && (
        <section className="rounded-xl border border-line">
          <div className="border-b border-line p-3">
            <label className="relative block max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && market === "us" && q && shown.length === 0 && open(q)}
                placeholder={market === "in" ? "Search NIFTY, BANKNIFTY, RELIANCE…" : "Search or type any US ticker"}
                className="w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm outline-none focus:border-ink-3"
              />
            </label>
          </div>

          {error && <p className="p-6 text-sm text-down">{error}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="px-3 py-2.5 font-normal">Underlying</th>
                  <th className="px-3 py-2.5 text-right font-normal">Price</th>
                  <th className="px-3 py-2.5 text-right font-normal">Change</th>
                  <th className="hidden px-3 py-2.5 text-right font-normal sm:table-cell">Lot size</th>
                  {market === "in" ? (
                    <th className="hidden px-3 py-2.5 text-right font-normal md:table-cell">Next expiry</th>
                  ) : (
                    <th className="hidden px-3 py-2.5 text-right font-normal md:table-cell">Mkt cap</th>
                  )}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {!rows &&
                  !error &&
                  Array.from({ length: 10 }, (_, i) => (
                    <tr key={i} className="border-t border-line">
                      <td colSpan={6} className="px-3 py-3">
                        <div className="h-5 animate-pulse rounded bg-wash" />
                      </td>
                    </tr>
                  ))}
                {shown.map((r) => (
                  <tr key={r.symbol} onClick={() => open(r.symbol)} className="group cursor-pointer border-t border-line hover:bg-wash">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {r.kind !== "INDEX" && (
                          <span className="hidden sm:block">
                            <StockLogo market={market} symbol={r.symbol} size={30} />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium">
                            {r.symbol}
                            {r.kind === "INDEX" && <span className="rounded bg-wash px-1 text-[10px] font-normal text-ink-2">INDEX</span>}
                          </p>
                          <p className="max-w-[140px] truncate text-xs text-ink-3 sm:max-w-[260px]">{r.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right font-medium">{price(r.price, market)}</td>
                    <td className={clsx("tabular px-3 py-2.5 text-right", changeColor(r.change_pct))}>{signedPct(r.change_pct)}</td>
                    <td className="tabular hidden px-3 py-2.5 text-right text-ink-2 sm:table-cell">{r.lot_size}</td>
                    <td className="tabular hidden px-3 py-2.5 text-right text-ink-2 md:table-cell">
                      {market === "in" ? (r.next_expiry ? fmtDate(r.next_expiry) : "—") : compact(r.market_cap, market)}
                    </td>
                    <td className="pr-3 text-ink-3 group-hover:text-ink">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows && shown.length === 0 && (
            <div className="p-6 text-sm text-ink-2">
              Nothing matches “{search}”.
              {market === "us" && /^[A-Z.-]{1,8}$/.test(q) && (
                <button onClick={() => open(q)} className="ml-2 font-medium text-accent hover:underline">
                  Open {q} options →
                </button>
              )}
            </div>
          )}
        </section>
      )}
      {market === "in" && tab === "all" && <UpstoxConnect compact />}
    </div>
  );
}
