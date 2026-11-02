"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import * as d3 from "d3";
import { getPaper, type PaperPortfolio } from "@/lib/api";
import { price } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { useChartColors } from "@/lib/charts/theme";
import { useWidth } from "@/lib/charts/useWidth";

const rupees = (v: number | null | undefined) => (v == null ? "—" : `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);
const signed = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(d)}%`);
const day = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "—";
const tone = (v: number) => (v > 0 ? "text-up" : v < 0 ? "text-down" : "text-ink");

/** Momentum strategy C, traded day by day with simulated money: does live trading match the backtest? */
export default function PaperPage() {
  const { market } = useMarket();
  const [data, setData] = useState<PaperPortfolio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPaper().then((d) => alive && setData(d)).catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Paper portfolio</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-2">
          The momentum strategy that held up in our 10-year test, traded with ₹10,00,000 of simulated money: no real orders are placed.
          It shows whether live prices, fills and costs behave the way the backtest assumed before any real money goes in.
        </p>
        {market !== "in" && <p className="mt-1 text-xs text-ink-3">It runs on Indian stocks only; the country switch doesn&apos;t change it.</p>}
      </section>

      {error && (
        <div className="rounded-xl border border-line p-4 text-sm text-ink-2">
          {error.includes("starts") ? error : <span className="text-down">{error}</span>}
        </div>
      )}
      {!data && !error && <div className="h-64 animate-pulse rounded-xl bg-wash" />}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Value">
              <p className="tabular text-2xl font-semibold tracking-tight">{rupees(data.value)}</p>
              <p className="text-xs text-ink-3">from {rupees(data.capital)} on {day(data.start_day)}</p>
            </Tile>
            <Tile label="Return since start">
              <p className={clsx("tabular text-2xl font-semibold tracking-tight", tone(data.return))}>{signed(data.return, 2)}</p>
              <p className="text-xs text-ink-3">
                Nifty ETF <span className={tone(data.benchmark_return)}>{signed(data.benchmark_return, 2)}</span> over the same {data.trading_days}{" "}
                {data.trading_days === 1 ? "day" : "days"}
              </p>
            </Tile>
            <Tile label="Worst drop so far">
              <p className="tabular text-2xl font-semibold tracking-tight">{signed(data.max_drop)}</p>
              <p className="text-xs text-ink-3">The backtest&apos;s worst was {signed(data.backtest.max_drop, 0)}</p>
            </Tile>
            <Tile label="Next rebalance">
              {data.pending ? (
                <>
                  <p className="text-lg font-semibold">Next open</p>
                  <p className="text-xs text-ink-3">{data.pending.picks.length} stocks chosen on {day(data.pending.signal_day)}&apos;s close</p>
                </>
              ) : (
                <>
                  <p className="tabular text-2xl font-semibold tracking-tight">{data.next_rebalance_in ?? "—"}</p>
                  <p className="text-xs text-ink-3">trading days; then the top {data.rules.hold} are chosen again</p>
                </>
              )}
            </Tile>
          </div>

          <section className="rounded-xl border border-line p-4">
            <p className="text-sm font-medium">Portfolio against the Nifty ETF</p>
            <p className="text-xs text-ink-3">Both start at 100 on {day(data.start_day)}; marked at each day&apos;s close, after costs.</p>
            <EquityChart data={data} />
          </section>

          {data.pending && (
            <section className="rounded-xl border border-line p-4">
              <p className="text-sm font-medium">Orders for the next open</p>
              <p className="mb-2 text-xs text-ink-3">
                Chosen on {day(data.pending.signal_day)}&apos;s close, best momentum first. Each gets an equal share of the portfolio, in whole shares.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.pending.picks.map((s, i) => (
                  <Link key={s} href={`/stock/in/${encodeURIComponent(s)}`} className="rounded-md border border-line px-2 py-1 text-xs hover:bg-wash">
                    <span className="text-ink-3">{i + 1}.</span> {s}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <Holdings data={data} />
          <Rebalances data={data} />
          <About data={data} />
        </>
      )}
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="mb-1 text-xs text-ink-3">{label}</p>
      {children}
    </div>
  );
}

const H = 240;
const M = { top: 12, right: 48, bottom: 24, left: 8 };

function EquityChart({ data }: { data: PaperPortfolio }) {
  const C = useChartColors();
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const eq = data.equity;
  if (eq.length < 2)
    return (
      <div ref={box} className="mt-3 flex h-40 items-center justify-center rounded-lg bg-wash text-xs text-ink-3">
        The line starts after the second trading day.
      </div>
    );
  const pts = eq.map((p) => ({ day: p.day, port: (p.value / data.capital) * 100, bench: (p.benchmark / eq[0].benchmark) * 100 }));
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const x = d3.scaleLinear().domain([0, pts.length - 1]).range([0, innerW]);
  const lo = d3.min(pts, (p) => Math.min(p.port, p.bench)) ?? 95;
  const hi = d3.max(pts, (p) => Math.max(p.port, p.bench)) ?? 105;
  const pad = Math.max(1, (hi - lo) * 0.1);
  const y = d3.scaleLinear().domain([lo - pad, hi + pad]).nice(5).range([innerH, 0]);
  const line = (k: "port" | "bench") => d3.line<(typeof pts)[number]>().x((_, i) => x(i)).y((p) => y(p[k]))(pts) ?? "";
  const last = pts[pts.length - 1];
  const ticks = [0, Math.floor((pts.length - 1) / 2), pts.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const h = hover != null ? pts[hover] : null;

  return (
    <div ref={box} className="relative mt-3">
      <div className="mb-2 flex gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: C.forecast }} />Paper portfolio</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: C.ink3 }} />Nifty ETF (NIFTYBEES)</span>
      </div>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={`Paper portfolio ${last.port.toFixed(1)} against the Nifty ETF ${last.bench.toFixed(1)}, both from 100`}
          onMouseMove={(e) => {
            const [mx] = d3.pointer(e);
            const i = Math.round(x.invert(mx - M.left));
            setHover(i >= 0 && i < pts.length ? i : null);
          }}
          onMouseLeave={() => setHover(null)}>
          <g transform={`translate(${M.left},${M.top})`}>
            {y.ticks(5).map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x2={innerW} stroke={C.line} strokeDasharray={t === 100 ? undefined : "2 3"} />
                <text x={innerW + 6} dy="0.32em" fontSize={11} fill={C.ink3} className="tabular">{t}</text>
              </g>
            ))}
            {ticks.map((i) => (
              <text key={i} x={x(i)} y={innerH + 17} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"} fontSize={11} fill={C.ink3}>
                {d3.utcFormat("%d %b")(new Date(`${pts[i].day}T00:00:00Z`))}
              </text>
            ))}
            <path d={line("bench")} fill="none" stroke={C.ink3} strokeWidth={1.5} />
            <path d={line("port")} fill="none" stroke={C.forecast} strokeWidth={2} />
            {h && hover != null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={0} y2={innerH} stroke={C.crosshair} strokeDasharray="3 3" />
                <circle cx={x(hover)} cy={y(h.port)} r={4} fill={C.forecast} stroke={C.paper} strokeWidth={2} />
                <circle cx={x(hover)} cy={y(h.bench)} r={4} fill={C.ink3} stroke={C.paper} strokeWidth={2} />
              </g>
            )}
          </g>
        </svg>
      )}
      {h && hover != null && (
        <div className="pointer-events-none absolute top-8 z-10 rounded-lg border border-line bg-paper px-3 py-2 text-xs shadow-sm"
          style={x(hover) > innerW / 2 ? { right: width - x(hover) - M.left + 12 } : { left: x(hover) + M.left + 12 }}>
          <p className="text-ink-3">{day(h.day)}</p>
          <p className="tabular">Portfolio {h.port.toFixed(2)} · Nifty ETF {h.bench.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}

function Holdings({ data }: { data: PaperPortfolio }) {
  if (!data.holdings.length) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-line">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <p className="text-sm font-medium">Holdings ({data.holdings.length})</p>
        <p className="text-xs text-ink-3">At {day(data.last_day)}&apos;s close · cash {rupees(data.cash)}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-3">
              <th className="px-4 py-2 font-normal">Stock</th>
              <th className="px-3 py-2 text-right font-normal">Shares</th>
              <th className="px-3 py-2 text-right font-normal">Bought at</th>
              <th className="px-3 py-2 text-right font-normal">Last close</th>
              <th className="px-3 py-2 text-right font-normal">Change</th>
              <th className="px-4 py-2 text-right font-normal">Value</th>
            </tr>
          </thead>
          <tbody>
            {data.holdings.map((h) => {
              const ch = h.cost && h.price ? h.price / h.cost - 1 : null;
              return (
                <tr key={h.symbol} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <Link href={`/stock/in/${encodeURIComponent(h.symbol)}`} className="font-medium hover:underline">{h.symbol}</Link>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right text-ink-2">{h.shares.toLocaleString("en-IN")}</td>
                  <td className="tabular px-3 py-2.5 text-right text-ink-2">{h.cost != null ? price(h.cost, "in") : "—"}</td>
                  <td className="tabular px-3 py-2.5 text-right text-ink-2">{h.price != null ? price(h.price, "in") : "—"}</td>
                  <td className={clsx("tabular px-3 py-2.5 text-right", ch != null && tone(ch))}>{signed(ch)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{rupees(h.value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2 text-[11px] text-ink-3">
        &quot;Bought at&quot; is the latest buy&apos;s price; splits and bonus issues change the share count, not this price.
      </p>
    </section>
  );
}

function Rebalances({ data }: { data: PaperPortfolio }) {
  if (!data.rebalances.length) return null;
  return (
    <section className="rounded-xl border border-line">
      <p className="border-b border-line px-4 py-3 text-sm font-medium">Rebalances</p>
      <div className="divide-y divide-line">
        {[...data.rebalances].reverse().map((r) => {
          const trades = data.trades.filter((t) => t.day === r.fill_day);
          return (
            <details key={r.fill_day} className="px-4 py-3 text-sm">
              <summary className="cursor-pointer">
                <span className="font-medium">{day(r.fill_day)}</span>
                <span className="text-ink-2"> · bought {r.bought}, sold {r.sold} · costs {rupees(r.fees)}</span>
              </summary>
              <div className="mt-2 grid gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
                {trades.map((t) => (
                  <p key={`${t.symbol}-${t.side}`} className="tabular text-ink-2">
                    <span className={t.side === "buy" ? "text-up" : "text-down"}>{t.side === "buy" ? "Buy" : "Sell"}</span> {t.shares} {t.symbol} at{" "}
                    {price(t.price, "in")}
                  </p>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function About({ data }: { data: PaperPortfolio }) {
  const b = data.backtest;
  return (
    <details className="rounded-xl border border-line px-4 py-3 text-sm" open={data.trading_days < 5}>
      <summary className="cursor-pointer font-medium">The rules, and what to expect</summary>
      <div className="mt-3 grid gap-x-8 gap-y-2 text-xs leading-relaxed text-ink-2 md:grid-cols-2">
        <p><span className="font-medium text-ink">Rules.</span> Every {data.rules.every} trading days, on that day&apos;s close: the {data.rules.pool} most
          traded liquid stocks (20-day value traded at least ₹1 Cr, price at least ₹20, past the site&apos;s quality screen), then the top {data.rules.hold} by
          momentum (6- and 12-month returns over the year&apos;s volatility). Orders fill at the next day&apos;s open, equal value, whole shares.</p>
        <p><span className="font-medium text-ink">Costs.</span> {(data.rules.cost_per_side * 100).toFixed(1)}% of each buy and sell, as in the backtest: charges plus
          some slippage. Splits and bonus issues adjust the shares; dividends go to cash. Tax isn&apos;t included.</p>
        <p><span className="font-medium text-ink">The backtest (2017–2026).</span> {signed(b.annual_return)} a year after costs, against {signed(b.pool_annual)} for
          the same 200 stocks held equally and {signed(b.etf_annual)} for the Nifty ETF. Worst drop {signed(b.max_drop, 0)}. Real results will be lower: the
          history leaves out companies that collapsed and were delisted.</p>
        <p><span className="font-medium text-ink">What 3 months can show.</span> Not whether the strategy works: its months swing by several points either
          way. After 63 trading days the backtest is re-run over the same dates; if the two returns are within 2 points, the backtest describes what trading
          the rules really does. That&apos;s the check, written down before the start.</p>
      </div>
      {data.notes.length > 0 && <p className="mt-3 text-[11px] text-ink-3">Log: {data.notes.join(" · ")}</p>}
    </details>
  );
}
