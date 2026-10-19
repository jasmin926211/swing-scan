"use client";

import { useEffect, useState } from "react";
import { getExpectedMove, type ExpectedMove as Move, type MarketId } from "@/lib/api";
import { money, price } from "@/lib/format";

const LABEL: Record<number, string> = { 1: "Tomorrow", 5: "Next week", 10: "Next 2 weeks" };
const DEFAULT_RISK: Record<MarketId, number> = { in: 10000, us: 500 };
const RISK_KEY = "ct.risk";

const pctText = (v: number) => `${(Math.abs(v) * 100).toFixed(1)}%`;

/** How far the stock typically moves, a stop-distance guide, and a position-size calculator. */
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
    <section className="rounded-xl border border-line">
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
        <div className="grid gap-px bg-line lg:grid-cols-[3fr_2fr]">
          <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
            {data.horizons.map((h) => (
              <div key={h.days} className="bg-paper px-4 py-3">
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
            <p className="bg-paper px-4 py-3 text-xs leading-relaxed text-ink-2 sm:col-span-3">
              <span className="font-medium text-ink">Stop guide:</span> a stop less than {pctText(data.horizons[0].likely.down)} away
              ({price(base * (1 + data.horizons[0].likely.down), market)} for a buy) sits inside ordinary daily noise and gets hit about 1 day in 10
              with no real change in the trend. For a 2-week swing, normal movement reaches {pctText(data.horizons[2].likely.down)} on the downside.
            </p>
          </div>
          <RiskCalculator market={market} base={base} defaultStop={Math.abs(data.horizons[2].likely.down)} />
        </div>
      )}
    </section>
  );
}

function RiskCalculator({ market, base, defaultStop }: { market: MarketId; base: number; defaultStop: number }) {
  const [risk, setRisk] = useState(DEFAULT_RISK[market]);
  const [stopPct, setStopPct] = useState(Number((defaultStop * 100).toFixed(1)));

  // The amount risked per trade is a personal setting: remember it per browser and market.
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(`${RISK_KEY}.${market}`));
      if (saved > 0) setRisk(saved);
    } catch {}
  }, [market]);
  useEffect(() => setStopPct(Number((defaultStop * 100).toFixed(1))), [defaultStop]);

  function saveRisk(v: number) {
    setRisk(v);
    try {
      if (v > 0) localStorage.setItem(`${RISK_KEY}.${market}`, String(v));
    } catch {}
  }

  const perShare = base * (stopPct / 100);
  const qty = perShare > 0 && risk > 0 ? Math.floor(risk / perShare) : 0;
  const INPUT = "tabular w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-ink-3";

  return (
    <div className="bg-paper px-4 py-3">
      <p className="text-xs font-semibold text-ink">Position size</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="text-xs text-ink-3">
          Risk per trade
          <input type="number" min={0} step={market === "in" ? 500 : 50} value={risk || ""} onChange={(e) => saveRisk(Number(e.target.value))} className={`${INPUT} mt-1`} />
        </label>
        <label className="text-xs text-ink-3">
          Stop distance %
          <input type="number" min={0.1} step={0.1} value={stopPct || ""} onChange={(e) => setStopPct(Number(e.target.value))} className={`${INPUT} mt-1`} />
        </label>
      </div>
      <dl className="tabular mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-ink-3">Buy</dt>
        <dd className="text-right font-semibold text-ink">{qty.toLocaleString()} shares</dd>
        <dt className="text-ink-3">Position value</dt>
        <dd className="text-right text-ink">{money(qty * base, market)}</dd>
        <dt className="text-ink-3">Stop at (buy)</dt>
        <dd className="text-right text-ink">{price(base - perShare, market)}</dd>
        <dt className="text-ink-3">Loss if stopped</dt>
        <dd className="text-right text-ink">{money(qty * perShare, market)}</dd>
      </dl>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
        Stop starts at the 2-week normal range. Shares = risk ÷ (price × stop %). Gaps can fill beyond a stop; costs aren&apos;t included.
      </p>
    </div>
  );
}
