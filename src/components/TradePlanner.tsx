"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import * as d3 from "d3";
import { getStopCheck, type MarketId, type StopCheck, type StopMethod, type StopSamples } from "@/lib/api";
import { CHARGES_CHECKED, plan, total, type Side, type TradeKind } from "@/lib/charges";
import { money, price } from "@/lib/format";
import { FONT, useChartColors } from "@/lib/charts/theme";
import { useWidth } from "@/lib/charts/useWidth";

const HOLDS = [1, 2, 3, 5, 10, 20];
const DEFAULT_RISK: Record<MarketId, number> = { in: 10000, us: 500 };
const DEFAULT_CAPITAL: Record<MarketId, number> = { in: 500000, us: 25000 };
const RISK_KEY = "ct.risk";
const CAPITAL_KEY = "ct.capital";
// Expected move's 80% range per unit of daily vol * sqrt(days), measured at 1, 5 and 10 days; the nearest is used.
const k80 = (days: number) => (days <= 1 ? 1.28 : days <= 5 ? 1.34 : 1.38);
const INPUT = "tabular w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-ink-3";

/** erfc, Numerical Recipes' erfcc (error < 1.2e-7). */
function erfc(x: number) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807
    + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

type Check = { method: StopMethod; samples: StopSamples; vol: number; time: number; n: number };

/** Share of past entries whose move reached a stop `dist` (log, > 0) away; null when no method passed the test. */
function hitRate(c: Check, side: Side, dist: number): number | null {
  if (!c.method || !(dist > 0)) return null;
  if (c.method === "formula") return Math.min(1, erfc(dist / (c.vol * Math.sqrt(c.time)) / Math.SQRT2));
  const xs = side === "buy" ? c.samples.buy : c.samples.short;
  if (xs.length === 0) return null;
  const hits = side === "buy" ? xs.filter((x) => x <= -dist).length : xs.filter((x) => x >= dist).length;
  return hits / xs.length;
}

function useStored(key: string, fallback: number): [number, (v: number) => void] {
  const [v, setV] = useState(fallback);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      setV(saved > 0 ? saved : fallback);
    } catch {}
  }, [key, fallback]);
  return [v, (x: number) => {
    setV(x);
    try {
      if (x > 0) localStorage.setItem(key, String(x));
    } catch {}
  }];
}

/** Plan a trade from your own entry, stop and target: shares, charges, what's at stake, and how often normal movement
 *  reached a stop this far away. Arithmetic and history, not a signal: nothing here says which way the stock goes. */
export function TradePlanner({ market, symbol, livePrice, exchange, marketOpen }: {
  market: MarketId; symbol: string; livePrice?: number | null; exchange?: string | null; marketOpen: boolean;
}) {
  const [check, setCheck] = useState<StopCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<TradeKind>("swing");
  const [hold, setHold] = useState(5);
  const [entryTime, setEntryTime] = useState(0);
  const [side, setSide] = useState<Side>("buy");
  const [entry, setEntry] = useState<number | null>(null);
  const [stop, setStop] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [capital, setCapital] = useStored(`${CAPITAL_KEY}.${market}`, DEFAULT_CAPITAL[market]);
  const [maxLoss, setMaxLoss] = useStored(`${RISK_KEY}.${market}`, DEFAULT_RISK[market]);
  const exch = exchange?.toUpperCase().includes("BSE") ? "BSE" : "NSE";
  const noSwingShort = market === "in" && kind === "swing";

  useEffect(() => {
    let alive = true;
    setCheck(null);
    setError(null);
    getStopCheck(market, symbol)
      .then((d) => alive && setCheck(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load the stop check"));
    return () => {
      alive = false;
    };
  }, [market, symbol]);

  // Intraday: start at the entry time nearest now (market time), else the first.
  useEffect(() => {
    if (!check?.intraday) return;
    const tz = market === "in" ? "Asia/Kolkata" : "America/New_York";
    const now = new Date().toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
    const i = check.intraday.entries.findLastIndex((e) => e.time <= now);
    setEntryTime(marketOpen && i >= 0 ? i : 0);
  }, [check, market, marketOpen]);

  useEffect(() => {
    if (noSwingShort && side === "short") setSide("buy");
  }, [noSwingShort, side]);

  const current: Check | null = useMemo(() => {
    if (!check) return null;
    if (kind === "swing") {
      const h = check.swing.holds.find((x) => x.days === hold);
      return h ? { method: h.method, samples: h, vol: check.swing.vol, time: hold, n: h.buy.length } : null;
    }
    const it = check.intraday;
    if (!it) return null;
    const e = it.entries[entryTime];
    // No entry times when intraday has no tested percentage: size it against a whole session's normal range.
    return e ? { method: it.method, samples: e, vol: it.vol, time: e.remain, n: it.sessions }
      : { method: null, samples: { buy: [], short: [] }, vol: it.vol, time: 1, n: 0 };
  }, [check, kind, hold, entryTime]);

  const base = entry ?? livePrice ?? null;
  // A fresh starting stop at the edge of the stock's normal range for the hold (Expected move's 80% range); yours to change.
  useEffect(() => {
    if (base == null || current == null) return;
    const d = k80(current.time) * current.vol * Math.sqrt(current.time);
    setStop(Number((side === "buy" ? base * Math.exp(-d) : base * Math.exp(d)).toFixed(2)));
    setTarget(null);
    // Only when the trade's shape changes, not on every price tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, side, entry == null && livePrice != null]);

  const p = base != null && stop != null ? plan(market, kind, side, base, stop, target, capital, maxLoss, exch) : null;
  const dist = base != null && stop != null && stop > 0 ? Math.abs(Math.log(stop / base)) : null;
  const rate = current && dist != null ? hitRate(current, side, dist) : null;
  const wrongSide = base != null && stop != null && (side === "buy" ? stop >= base : stop <= base);

  return (
    <section className="overflow-hidden rounded-xl border border-line">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Plan a trade</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
          Your entry, stop and target turned into shares, charges and what&apos;s at stake, plus how often {symbol}&apos;s normal
          movement reached a stop that far. Arithmetic and history, not a buy or sell signal.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5 text-sm">
        <Segmented value={kind} onChange={setKind} options={[["intraday", "Intraday"], ["swing", "Swing"]]} />
        {kind === "swing" ? (
          <label className="flex items-center gap-2 text-xs text-ink-3">
            Hold up to
            <select value={hold} onChange={(e) => setHold(Number(e.target.value))} className="rounded-md border border-line bg-paper px-2 py-1 text-sm text-ink">
              {HOLDS.map((h) => <option key={h} value={h}>{h} {h === 1 ? "session" : "sessions"}</option>)}
            </select>
          </label>
        ) : check?.intraday?.entries.length ? (
          <label className="flex items-center gap-2 text-xs text-ink-3">
            Entry at
            <select value={entryTime} onChange={(e) => setEntryTime(Number(e.target.value))}
              className="rounded-md border border-line bg-paper px-2 py-1 text-sm text-ink">
              {check.intraday.entries.map((e, i) => <option key={e.time} value={i}>{e.time}</option>)}
            </select>
            <span>exit by the close</span>
          </label>
        ) : (
          <span className="text-xs text-ink-3">Exit by the close</span>
        )}
        <Segmented value={side} onChange={setSide} options={[["buy", "Buy"], ["short", "Short"]]} disabled={noSwingShort ? ["short"] : []} />
        {noSwingShort && <span className="text-[11px] text-ink-3">Holding a short overnight needs futures in India.</span>}
      </div>

      <div className="grid gap-3 border-b border-line px-4 py-3 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="Entry">
          <input type="number" step="0.05" value={base ?? ""} onChange={(e) => setEntry(e.target.value ? Number(e.target.value) : null)} className={INPUT} />
          {entry != null && livePrice != null && (
            <button onClick={() => setEntry(null)} className="mt-0.5 text-[11px] text-accent hover:underline">Use live price</button>
          )}
        </Field>
        <Field label={side === "buy" ? "Stop (below entry)" : "Stop (above entry)"}>
          <input type="number" step="0.05" value={stop ?? ""} onChange={(e) => setStop(e.target.value ? Number(e.target.value) : null)}
            className={clsx(INPUT, wrongSide && "border-down")} />
          {dist != null && !wrongSide && <p className="tabular mt-0.5 text-[11px] text-ink-3">{(dist * 100).toFixed(2)}% away</p>}
        </Field>
        <Field label="Target (optional)">
          <input type="number" step="0.05" value={target ?? ""} onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : null)} className={INPUT} />
          {base != null && stop != null && !wrongSide && (
            <span className="mt-0.5 flex gap-1">
              {[1, 2, 3].map((r) => (
                <button key={r} onClick={() => setTarget(Number((base + (side === "buy" ? 1 : -1) * r * Math.abs(base - stop)).toFixed(2)))}
                  className="rounded border border-line px-1.5 text-[11px] text-ink-2 hover:border-ink-3">{r}R</button>
              ))}
            </span>
          )}
        </Field>
        <Field label="Capital">
          <input type="number" min={0} step={market === "in" ? 10000 : 1000} value={capital || ""} onChange={(e) => setCapital(Number(e.target.value))} className={INPUT} />
        </Field>
        <Field label="Max loss per trade">
          <input type="number" min={0} step={market === "in" ? 500 : 50} value={maxLoss || ""} onChange={(e) => setMaxLoss(Number(e.target.value))} className={INPUT} />
        </Field>
      </div>

      {wrongSide ? (
        <p className="px-4 py-3 text-sm text-down">For a {side === "buy" ? "buy, the stop goes below" : "short, the stop goes above"} the entry.</p>
      ) : (
        <div className="grid divide-y divide-line lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-ink">Position</p>
            {p && p.qty > 0 ? (
              <dl className="tabular mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-ink-3">{side === "buy" ? "Buy" : "Short"}</dt>
                <dd className="text-right text-base font-semibold text-ink">{p.qty.toLocaleString()} shares</dd>
                <dt className="text-ink-3">Position value</dt>
                <dd className="text-right text-ink">{money(p.value, market)}</dd>
                <dt className="text-ink-3">Risk a share</dt>
                <dd className="text-right text-ink">{price(p.perShareRisk, market)}</dd>
                {p.limitedBy === "capital" && <dd className="col-span-2 text-[11px] text-ink-3">Limited by your capital, not the max loss.</dd>}
              </dl>
            ) : (
              <p className="mt-2 text-xs text-ink-3">
                {p ? "Not even one share fits the max loss with this stop, charges included." : "Enter an entry and a stop."}
              </p>
            )}
          </div>

          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-ink">After charges</p>
            {p && p.qty > 0 && (
              <dl className="tabular mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-ink-3">Loss at the stop</dt>
                <dd className="text-right font-medium text-down">−{money(p.lossAtStop, market)}</dd>
                <dt className="text-ink-3">Profit at the target</dt>
                <dd className={clsx("text-right font-medium", p.profitAtTarget == null ? "text-ink-3" : p.profitAtTarget >= 0 ? "text-up" : "text-down")}>
                  {p.profitAtTarget == null ? "set a target" : `${p.profitAtTarget >= 0 ? "+" : "−"}${money(Math.abs(p.profitAtTarget), market)}`}
                </dd>
                {p.reward != null && target != null && base != null && stop != null && (
                  <>
                    <dt className="text-ink-3">Reward : risk</dt>
                    <dd className="text-right text-ink">
                      {(Math.abs(target - base) / Math.abs(base - stop)).toFixed(2)} before, <b>{p.reward.toFixed(2)}</b> after
                    </dd>
                  </>
                )}
                {p.winRateNeeded != null && (
                  <>
                    <dt className="text-ink-3">Must win to break even</dt>
                    <dd className="text-right font-medium text-ink">{Math.round(p.winRateNeeded * 100)}% of trades</dd>
                  </>
                )}
                <dt className="text-ink-3">Break-even exit</dt>
                <dd className="text-right text-ink">{price(p.breakEven, market)}</dd>
              </dl>
            )}
          </div>

          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-ink">Stop check</p>
            {error && <p className="mt-2 text-xs text-ink-3">{error}</p>}
            {!check && !error && <div className="mt-2 h-28 animate-pulse rounded-lg bg-wash" />}
            {check && current && (
              current.method == null ? (
                <p className="mt-2 text-xs leading-relaxed text-ink-3">
                  No percentage for {kind === "intraday" ? "intraday trades" : `${hold}-session holds`}. We tested it on years of data: a
                  stock&apos;s past record of stops hit didn&apos;t predict the next hit rate within 5 points, so a number here would mislead.
                  Only 5-session holds passed.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-xs leading-relaxed text-ink-2">
                    {rate == null ? "—" : (
                      <>
                        Normal movement reached a stop this far on <b className="tabular text-base text-ink">{Math.round(rate * 100)}%</b> of{" "}
                        {kind === "intraday" ? `the last ${current.n} sessions from ${check.intraday?.entries[entryTime]?.time} to the close` : `${hold}-session holds over the past year`}
                        , whichever way {symbol} went after.
                      </>
                    )}
                  </p>
                  <HitCurve check={current} side={side} dist={dist} />
                </>
              )
            )}
            {check && kind === "swing" && (
              <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
                Overnight gaps skip stops: the biggest opening gap in the past year was {Math.abs(check.swing.gap.down * 100).toFixed(1)}% down
                and +{(check.swing.gap.up * 100).toFixed(1)}% up. Past a gap, the loss is bigger than planned.
              </p>
            )}
          </div>
        </div>
      )}

      {p && p.qty > 0 && !wrongSide && (
        <details className="border-t border-line px-4 py-2.5 text-xs">
          <summary className="cursor-pointer text-ink-2">Charges: {money(total(p.chargesAtStop), market)} at the stop{p.chargesAtTarget ? `, ${money(total(p.chargesAtTarget), market)} at the target` : ""}</summary>
          <table className="tabular mt-2 w-full max-w-md">
            <thead>
              <tr className="text-left text-[11px] text-ink-3">
                <th className="py-1 font-normal">Item</th>
                <th className="py-1 text-right font-normal">At the stop</th>
                {p.chargesAtTarget && <th className="py-1 text-right font-normal">At the target</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {p.chargesAtStop.map((c, i) => (
                <tr key={c.label}>
                  <td className="py-1 text-ink-2">{c.label}</td>
                  <td className="py-1 text-right">{money(c.amount, market)}</td>
                  {p.chargesAtTarget && <td className="py-1 text-right">{money(p.chargesAtTarget[i].amount, market)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            {market === "in"
              ? `Discount-broker rates (brokerage: ${kind === "intraday" ? "₹20 or 0.03% an order, whichever is lower" : "free on delivery"}), ${exch}, checked ${CHARGES_CHECKED}. Full-service brokers charge more.`
              : `No commission (most US brokers); SEC and FINRA fees on the sale, checked ${CHARGES_CHECKED}.`}{" "}
            Not included: slippage (fills worse than your price) and tax on gains.
          </p>
        </details>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-ink-3">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Segmented<T extends string>({ value, onChange, options, disabled = [] }: {
  value: T; onChange: (v: T) => void; options: [T, string][]; disabled?: T[];
}) {
  return (
    <div className="flex rounded-lg bg-wash p-0.5 text-xs">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} disabled={disabled.includes(v)} aria-pressed={value === v}
          className={clsx("rounded-md px-3 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            value === v ? "bg-paper font-medium text-ink shadow-sm" : "text-ink-2 hover:text-ink")}>
          {label}
        </button>
      ))}
    </div>
  );
}

const CH = 120;
const CM = { top: 8, right: 8, bottom: 22, left: 34 };

/** How often a stop was reached, against how far away it was; the marker is yours. */
function HitCurve({ check, side, dist }: { check: Check; side: Side; dist: number | null }) {
  const COLORS = useChartColors();
  const [box, width] = useWidth<HTMLDivElement>();
  const typical = check.vol * Math.sqrt(check.time);
  const xMax = Math.max(3 * typical, (dist ?? 0) * 1.25);
  const pts = d3.range(1, 61).map((i) => {
    const d = (xMax * i) / 60;
    return [d, hitRate(check, side, d) ?? 0] as const;
  });
  const innerW = Math.max(0, width - CM.left - CM.right);
  const innerH = CH - CM.top - CM.bottom;
  const x = d3.scaleLinear().domain([0, xMax]).range([0, innerW]);
  const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);
  const line = d3.line<readonly [number, number]>().x((d) => x(d[0])).y((d) => y(d[1])).curve(d3.curveMonotoneX);
  const at = dist != null && dist <= xMax ? hitRate(check, side, dist) : null;
  return (
    <div ref={box} className="mt-2 w-full" style={{ height: CH }}>
      {width > 0 && (
        <svg width={width} height={CH} className="block max-w-full" style={{ fontFamily: FONT }} role="img"
          aria-label="Share of past entries whose stop was reached, by the stop's distance">
          <g transform={`translate(${CM.left},${CM.top})`}>
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke={COLORS.line} />
                <text x={-6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={COLORS.ink3}>{t * 100}%</text>
              </g>
            ))}
            {x.ticks(4).map((t) => (
              <text key={t} x={x(t)} y={innerH + 15} textAnchor="middle" fontSize={10} fill={COLORS.ink3}>{(t * 100).toFixed(1)}%</text>
            ))}
            <path d={line(pts) ?? ""} fill="none" stroke={COLORS.ink2} strokeWidth={2} />
            {at != null && dist != null && (
              <g transform={`translate(${x(dist)},${y(at)})`}>
                <line y1={0} y2={innerH - y(at)} stroke={COLORS.ink3} strokeDasharray="3 3" />
                <circle r={5} fill={COLORS.down} stroke={COLORS.paper} strokeWidth={2} />
              </g>
            )}
          </g>
        </svg>
      )}
      <p className="sr-only">Stop distance from the entry on the bottom axis; share of past entries that reached it on the left.</p>
    </div>
  );
}
