"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { MarketId, OptionChain as Chain, OptionSide } from "@/lib/api";
import { compact, price } from "@/lib/format";
import { OIButterfly } from "./charts/OIButterfly";

const AROUND_ATM = 12; // strikes shown each side of the money by default

export function OptionChain({ chain, market }: { chain: Chain; market: MarketId }) {
  const [all, setAll] = useState(false);
  const atmIndex = Math.max(0, chain.rows.findIndex((r) => r.strike === chain.atm_strike));
  const rows = useMemo(
    () => (all ? chain.rows : chain.rows.slice(Math.max(0, atmIndex - AROUND_ATM), atmIndex + AROUND_ATM + 1)),
    [all, chain.rows, atmIndex],
  );
  const spot = chain.spot ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-5">
        <Stat label="Spot" value={price(chain.spot, market)} />
        <Stat label="ATM strike" value={price(chain.atm_strike, market)} />
        <Stat label="Put / call OI" value={chain.pcr != null ? chain.pcr.toFixed(2) : "—"} />
        <Stat label="Max pain" value={price(chain.max_pain, market)} />
        <Stat label="Lot size" value={String(chain.lot_size)} />
      </div>

      <OIButterfly rows={rows} chain={chain} market={market} />

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="tabular w-full text-xs">
          <thead>
            <tr className="border-b border-line text-ink-3">
              <th colSpan={5} className="py-2 text-center font-medium text-ink-2">Calls</th>
              <th className="py-2" />
              <th colSpan={5} className="py-2 text-center font-medium text-ink-2">Puts</th>
            </tr>
            <tr className="text-ink-3">
              {["OI", "Chg OI", "IV", "Delta", "Price"].map((h) => <th key={`c${h}`} className="px-2 py-1.5 text-right font-normal">{h}</th>)}
              <th className="px-3 py-1.5 text-center font-normal">Strike</th>
              {["Price", "Delta", "IV", "Chg OI", "OI"].map((h) => <th key={`p${h}`} className="px-2 py-1.5 text-right font-normal">{h}</th>)}
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
      <div className="flex items-center justify-between text-xs text-ink-3">
        <span>Shaded cells are in the money · prices from {chain.source}</span>
        {chain.rows.length > rows.length || all ? (
          <button onClick={() => setAll(!all)} className="font-medium text-accent hover:underline">
            {all ? "Show strikes near the money" : `Show all ${chain.rows.length} strikes`}
          </button>
        ) : null}
      </div>
    </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="tabular mt-0.5 font-medium">{value}</p>
    </div>
  );
}
