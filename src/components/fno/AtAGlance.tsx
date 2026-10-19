"use client";

import clsx from "clsx";
import type { ExpectedMove, MarketId, StockOi } from "@/lib/api";
import { fmtDate, price } from "@/lib/format";
import { BUILDUP } from "../OiLevels";
import { Term } from "./Term";

// The tested 80% multipliers from Expected move (1, 5 and 10 trading days), interpolated in between.
const K80: [number, number][] = [[1, 1.28], [5, 1.34], [10, 1.38]];
function k80(days: number) {
  if (days <= 1) return K80[0][1];
  for (let i = 1; i < K80.length; i++) {
    const [d0, k0] = K80[i - 1];
    const [d1, k1] = K80[i];
    if (days <= d1) return k0 + ((k1 - k0) * (days - d0)) / (d1 - d0);
  }
  return K80[K80.length - 1][1];
}

/** Weekdays from tomorrow to the expiry date, inclusive (exchange holidays aren't counted out). */
export function tradingDaysTo(expiry: string, today = new Date()) {
  const end = new Date(`${expiry}T00:00:00Z`);
  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  let n = 0;
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

/** The F&O picture in plain words: who is adding positions, where option sellers are defending, and how far the
 *  stock usually moves before expiry. */
export function AtAGlance({ market, oi, move, spot, loading }: {
  market: MarketId;
  oi: StockOi | null;
  move: ExpectedMove | null;
  spot: number | null;
  loading: boolean;
}) {
  if (loading && !oi) return <div className="h-40 animate-pulse rounded-xl bg-wash" />;
  if (!oi) return null;
  const px = spot ?? oi.spot;
  const days = tradingDaysTo(oi.expiry);
  const b = oi.buildup?.buildup;
  const range = oi.support != null && oi.resistance != null && px != null ? { lo: Math.min(oi.support, oi.resistance), hi: Math.max(oi.support, oi.resistance) } : null;
  const where =
    range && px != null
      ? px > range.hi ? "above both walls" : px < range.lo ? "below both walls"
      : (px - range.lo) / (range.hi - range.lo || 1) > 0.66 ? "close to resistance"
      : (px - range.lo) / (range.hi - range.lo || 1) < 0.33 ? "close to support" : "in the middle of the range"
      : null;
  const pcrText =
    oi.pcr == null ? null
    : oi.pcr >= 1.2 ? "More puts than calls written: option sellers look comfortable with the price holding up."
    : oi.pcr <= 0.7 ? "More calls than puts written: option sellers are betting the price stays capped."
    : "Puts and calls are roughly balanced: no strong lean either way.";
  const movePct = move && days > 0 ? Math.exp(k80(days) * move.daily_vol * Math.sqrt(days)) - 1 : null;

  return (
    <section className="overflow-hidden rounded-xl border border-line">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">At a glance</h2>
        <p className="mt-0.5 text-xs text-ink-3">
          {oi.as_of ? `Open interest at the end of ${fmtDate(oi.as_of)}` : "Live open interest"} · nearest expiry {fmtDate(oi.expiry)}
          {days > 0 && ` (${days} trading day${days === 1 ? "" : "s"} away)`}
        </p>
      </div>
      <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="space-y-4 p-4">
          {b && (
            <Fact label={<Term k="buildup">Who is adding positions</Term>}>
              <span className={clsx("mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium", BUILDUP[b].cls)}>{BUILDUP[b].label}</span>
              {BUILDUP[b].meaning}.
            </Fact>
          )}
          {range && px != null && (
            <Fact label="Range option sellers are defending">
              <span className="tabular">
                <Term k="support">{price(oi.support, market)}</Term> → <Term k="resistance">{price(oi.resistance, market)}</Term>
              </span>
              <RangeBar lo={range.lo} hi={range.hi} value={px} />
              <span className="text-ink-2">Price {price(px, market)} is {where}.</span>
            </Fact>
          )}
        </div>
        <div className="space-y-4 p-4">
          {pcrText && (
            <Fact label={<Term k="pcr">Put-call ratio {oi.pcr!.toFixed(2)}</Term>}>{pcrText}</Fact>
          )}
          {oi.max_pain != null && (
            <Fact label={<Term k="max_pain">Max pain {price(oi.max_pain, market)}</Term>}>
              {px != null && `${Math.abs(oi.max_pain / px - 1) < 0.005 ? "Right at" : oi.max_pain > px ? `${((oi.max_pain / px - 1) * 100).toFixed(1)}% above` : `${((1 - oi.max_pain / px) * 100).toFixed(1)}% below`} the price. `}
              Near expiry some traders expect a drift towards it; it&apos;s a tendency, not a rule.
            </Fact>
          )}
          {movePct != null && px != null && (
            <Fact label={`Typical move by expiry (${fmtDate(oi.expiry)})`}>
              <span className="tabular font-medium text-ink">±{(movePct * 100).toFixed(1)}%</span>
              <span className="tabular text-ink-2"> · {price(px / (1 + movePct), market)} – {price(px * (1 + movePct), market)}</span>
              <span className="block text-ink-3">Held 8 in 10 times in testing (from the stock&apos;s daily ranges).</span>
            </Fact>
          )}
        </div>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-[11px] text-ink-3">
        These describe how traders are positioned; they aren&apos;t predictions. Tap ⓘ next to any term for what it means.
      </p>
    </section>
  );
}

function Fact({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <p className="mb-1 text-xs font-medium text-ink-3">{label}</p>
      <div className="leading-relaxed text-ink">{children}</div>
    </div>
  );
}

function RangeBar({ lo, hi, value }: { lo: number; hi: number; value: number }) {
  const span = hi - lo || 1;
  const pad = span * 0.15;
  const pos = Math.min(100, Math.max(0, ((value - (lo - pad)) / (span + 2 * pad)) * 100));
  const at = (v: number) => ((v - (lo - pad)) / (span + 2 * pad)) * 100;
  return (
    <span className="relative my-2 block h-1.5 rounded-full bg-line" aria-hidden>
      <span className="absolute inset-y-0 rounded-full bg-accent/30" style={{ left: `${at(lo)}%`, width: `${at(hi) - at(lo)}%` }} />
      <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-ink" style={{ left: `${pos}%` }} />
    </span>
  );
}
