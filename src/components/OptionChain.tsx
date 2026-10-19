"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { MarketId, OptionChain as Chain, OptionSide } from "@/lib/api";
import { compact, price } from "@/lib/format";
import { OIButterfly } from "./charts/OIButterfly";
import { Term, type TermKey } from "./fno/Term";

const AROUND_ATM = 12; // strikes shown each side of the money by default

/** The option chain as a table, or (view="chart") as open interest per strike. */
export function OptionChain({ chain, market, view = "table" }: { chain: Chain; market: MarketId; view?: "table" | "chart" }) {
  const [all, setAll] = useState(false);
  const atmIndex = Math.max(0, chain.rows.findIndex((r) => r.strike === chain.atm_strike));
  const rows = useMemo(
    () => (all ? chain.rows : chain.rows.slice(Math.max(0, atmIndex - AROUND_ATM), atmIndex + AROUND_ATM + 1)),
    [all, chain.rows, atmIndex],
  );
  const spot = chain.spot ?? 0;

  const stats = (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-5">
      <Stat label="Spot" value={price(chain.spot, market)} />
      <Stat label={<Term k="atm">ATM strike</Term>} value={price(chain.atm_strike, market)} />
      <Stat label={<Term k="pcr">Put / call OI</Term>} value={chain.pcr != null ? chain.pcr.toFixed(2) : "—"} />
      <Stat label={<Term k="max_pain">Max pain</Term>} value={price(chain.max_pain, market)} />
      <Stat label={<Term k="lot">Lot size</Term>} value={String(chain.lot_size)} />
    </div>
  );

  if (view === "chart")
    return (
      <div className="space-y-4">
        {stats}
        <p className="text-xs leading-relaxed text-ink-2">
          Each row is a strike price: <Term k="call">calls</Term> on the left, <Term k="put">puts</Term> on the right, bar length = <Term k="oi">open interest</Term>.
          The longest call bar is where sellers expect a ceiling (resistance); the longest put bar a floor (support).
        </p>
        <OIButterfly rows={rows} chain={chain} market={market} />
        <ShowAll chain={chain} shown={rows.length} all={all} setAll={setAll} />
      </div>
    );

  return (
    <div className="space-y-4">
      {stats}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="tabular w-full text-xs">
          <thead>
            <tr className="border-b border-line text-ink-3">
              <th colSpan={5} className="py-2 text-center font-medium text-ink-2">Calls</th>
              <th className="py-2" />
              <th colSpan={5} className="py-2 text-center font-medium text-ink-2">Puts</th>
            </tr>
            <tr className="text-ink-3">
              {HEAD.map(([h, k]) => <th key={`c${h}`} className="px-2 py-1.5 text-right font-normal">{k ? <Term k={k}>{h}</Term> : h}</th>)}
              <th className="px-3 py-1.5 text-center font-normal">Strike</th>
              {[...HEAD].reverse().map(([h, k]) => <th key={`p${h}`} className="px-2 py-1.5 text-right font-normal">{k ? <Term k={k}>{h}</Term> : h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const atm = r.strike === chain.atm_strike;
              return (
                <tr key={r.strike} className={clsx("border-t border-line", atm && "font-semibold")}>
                  <Side side={r.call} market={market} itm={r.strike < spot} order="call" />
                  <td className={clsx("px-3 py-1.5 text-center", atm ? "bg-ink text-paper" : "bg-wash")}>{price(r.strike, market)}</td>
                  <Side side={r.put} market={market} itm={r.strike > spot} order="put" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-ink-3">
        <span>
          Shaded cells are <Term k="itm">in the money</Term> · bold row is at the money · prices from {chain.source}
        </span>
        <ShowAll chain={chain} shown={rows.length} all={all} setAll={setAll} />
      </div>
    </div>
  );
}

const HEAD: [string, TermKey | null][] = [["OI", "oi"], ["Chg OI", "oi_change"], ["IV", "iv"], ["Delta", "delta"], ["Price", null]];

function ShowAll({ chain, shown, all, setAll }: { chain: Chain; shown: number; all: boolean; setAll: (v: boolean) => void }) {
  if (!(chain.rows.length > shown || all)) return null;
  return (
    <button onClick={() => setAll(!all)} className="shrink-0 text-xs font-medium text-accent hover:underline">
      {all ? "Show strikes near the money" : `Show all ${chain.rows.length} strikes`}
    </button>
  );
}

function Side({ side, market, itm, order }: { side: OptionSide | null; market: MarketId; itm: boolean; order: "call" | "put" }) {
  const cells = [
    compact(side?.oi, market),
    side?.oi_change == null ? "—" : `${side.oi_change > 0 ? "+" : ""}${compact(side.oi_change, market)}`,
    side?.iv != null ? `${(side.iv * 100).toFixed(1)}%` : "—",
    side?.delta != null ? side.delta.toFixed(2) : "—",
    price(side?.price, market),
  ];
  const ordered = order === "call" ? cells : [...cells].reverse();
  return (
    <>
      {ordered.map((c, i) => (
        <td key={i} className={clsx("px-2 py-1.5 text-right", itm && "bg-select")}>
          {c}
        </td>
      ))}
    </>
  );
}

function Stat({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="tabular mt-0.5 font-medium">{value}</p>
    </div>
  );
}
