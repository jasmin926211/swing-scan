"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, ChevronDown, X } from "lucide-react";
import { getPulse, type MarketId, type Pulse, type PulseCheck, type PulseStock } from "@/lib/api";
import { MARKETS, price } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { MoodGauge, moodLabel } from "@/components/pulse/MoodGauge";
import { BreadthLine } from "@/components/pulse/BreadthLine";
import { Bubbles } from "@/components/pulse/Bubbles";
import { SectorBars } from "@/components/pulse/SectorBars";
import { StockLogo } from "@/components/StockLogo";
import { CandidateDialog } from "@/components/pulse/CandidateDialog";
import { LeadersMap } from "@/components/pulse/LeadersMap";
import { OrderFlow } from "@/components/pulse/OrderFlow";
import { LineChart } from "lucide-react";
import { BUILDUP } from "@/components/OiLevels";

const REFRESH_S = 180; // trends can turn quickly; every 3 minutes
const TZ = { in: "Asia/Kolkata", us: "America/New_York" } as const;
const CHECK_LABEL: Record<PulseCheck, string> = {
  above_ema20: "Above 20 EMA",
  breakout: "Above 20-day high",
  volume: "Volume ≥ 1.5×",
  rsi: "RSI ≥ 60",
  adx: "ADX > 20, rising",
  relative_strength: "Beating the index (20 days)",
};
const pct = (v: number | null | undefined, d = 0) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const signedPct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;

/** Market Pulse: how broad the market's strength is, which sectors lead, and which stocks are breaking out. */
export default function PulsePage() {
  const { market } = useMarket();
  const [data, setData] = useState<Pulse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(REFRESH_S);
  const [open, setOpen] = useState<string | null>(null); // candidate symbol shown on a chart

  const load = useCallback(async () => {
    try {
      setData(await getPulse(market));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Market Pulse is unavailable");
    }
    setLeft(REFRESH_S);
  }, [market]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  // Countdown to the next refresh; it pauses while the tab is hidden and resumes when it's visible again.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setLeft((s) => {
        if (s <= 1) {
          load();
          return REFRESH_S;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [load]);

  const b = data?.breadth;
  const ad = data?.advance_decline;
  const hl = data?.highs_lows;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Market Pulse · {MARKETS[market].name}</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            How broad the market’s strength is today, which sectors lead, and which stocks are breaking out
            {data ? ` · ${data.stocks.toLocaleString()} liquid stocks` : ""}.
          </p>
        </div>
        <RefreshRing left={left} total={REFRESH_S} live={!!data?.market_open} updated={data?.updated_at} tz={TZ[market]} onRefresh={load} />
      </div>

      {error && <p className="rounded-xl border border-line p-4 text-sm text-ink-2">{error}</p>}
      {!data && !error && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-wash" />
          ))}
        </div>
      )}

      {data && ad && hl && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Market mood" note="Breadth, advances vs declines and new highs vs lows, combined (0–100).">
              <div className="flex flex-col items-center">
                <MoodGauge value={data.mood} />
                <p className="-mt-2 text-2xl font-semibold tracking-tight">{data.mood != null ? Math.round(data.mood * 100) : "—"}</p>
                <p className={clsx("text-sm font-medium", data.mood == null ? "text-ink-3" : data.mood >= 0.65 ? "text-up" : data.mood < 0.45 ? "text-down" : "text-ink-2")}>
                  {data.mood != null ? moodLabel(data.mood) : "Not enough data"}
                </p>
                <p className="mt-2 text-center text-xs text-ink-3">
                  {data.mood == null
                    ? ""
                    : data.mood >= 0.65
                      ? "Broad strength. In testing, breakouts did best on days like this, but still only about broke even."
                      : data.mood < 0.45
                        ? "Weak breadth. In testing, breakouts lost the most on days like this."
                        : "Mixed. In testing, breakouts lost money on average on days like this."}
                </p>
              </div>
            </Card>

            <Card title="Breadth" note="Share of stocks above each average. Above 60%: broad strength; below 30%: broad weakness.">
              <div className="space-y-4 pt-1">
                <Bar label="Above 20 EMA (short term)" value={b?.above_ema20} />
                <Bar label="Above 50-day average" value={b?.above_50dma} />
                <Bar label="Above 200-day average (long term)" value={b?.above_200dma} />
              </div>
            </Card>

            <Card title={`${data.index.name} & risk`} note="A high volatility index means wider swings: smaller positions, wider stops.">
              <div className="grid grid-cols-2 gap-4">
                <Big label={data.index.name} value={price(data.index.price, market)} change={data.index.change_pct} />
                <Big label={data.vix.name} value={data.vix.value != null ? data.vix.value.toFixed(2) : "—"} change={data.vix.change_pct} invert />
              </div>
              <BreadthLists ad={ad} hl={hl} market={market} />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Breadth through the day" note="% of stocks above their 20 EMA. Rising from below 30–40% towards 60%+ often marks a fresh upswing." className="lg:col-span-2">
              <BreadthLine points={data.history} tz={TZ[market]} />
            </Card>
            <Card title="Sector strength" note="Median move today; ↑20 = share of the sector above its 20 EMA.">
              <SectorBars sectors={data.sectors} />
            </Card>
          </div>

          <Card title="Volume vs move" note="Today's most traded stocks. Above the dashed line = at least 1.5× usual volume (in testing, heavy volume on up moves didn’t lead to better returns). Click a bubble to open the stock.">
            <Bubbles data={data.bubbles} market={market} />
          </Card>

          {market === "in" && <OrderFlow />}

          <Card
            title={`Momentum leaders · ${data.leaders_zone.count} in the zone`}
            note={`Momentum rating (NSE Nifty200 Momentum 30 method: 6- and 12-month returns adjusted for volatility, ranked 1–99) against distance from the 52-week high. Tested on 10 years: the top 20% beat the average liquid stock by ${pct(data.records.momentum.quarter, 1)} over the next 3 months (${pct(data.records.momentum.month, 1)} over 1 month), after costs. A tilt for 1–3 month holds, not a 2–3 day signal; momentum can drop sharply in fast rebounds after market falls.`}
          >
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <LeadersMap data={data.leaders} zone={data.leaders_zone} market={market} />
              <LeadersList data={data.leaders} zone={data.leaders_zone} market={market} />
            </div>
          </Card>

          <Card
            title={`Breakout candidates · ${data.candidates_total}`}
            note="Through the 20-day high and above the 20 EMA, with most of the swing checklist met. A watchlist to check, not a buy list."
          >
            <PlanRecord r={data.records.plan} market={market} />
            {data.candidates.length === 0 ? (
              <p className="text-sm text-ink-3">No stock meets the conditions right now.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.candidates.map((c) => (
                  <div key={c.symbol} className="flex min-w-0 flex-col rounded-xl border border-line p-3 transition-colors hover:border-ink-3">
                    <div className="flex items-center gap-2.5">
                      <StockLogo market={market} symbol={c.symbol} size={30} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/stock/${market}/${encodeURIComponent(c.symbol)}`} className="block truncate font-medium hover:underline">{c.symbol}</Link>
                        <p className="truncate text-xs text-ink-3">{c.sector ?? c.name}</p>
                      </div>
                      {c.rating != null && (
                        <span title="Momentum rating vs all liquid stocks (1–99)"
                          className={clsx("tabular rounded px-1.5 py-0.5 text-[10px] font-medium", c.rating >= 80 ? "bg-up-wash text-up" : c.rating < 40 ? "bg-down-wash text-down" : "bg-wash text-ink-2")}>
                          Mom {c.rating}
                        </span>
                      )}
                      <div className="text-right">
                        <p className="tabular text-sm font-medium">{price(c.price, market)}</p>
                        <p className={clsx("tabular text-xs", (c.change_pct ?? 0) >= 0 ? "text-up" : "text-down")}>
                          {(c.change_pct ?? 0) >= 0 ? "+" : ""}
                          {(c.change_pct ?? 0).toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    {c.upper_circuit && (
                      <p className="mt-2 rounded bg-warn-wash px-2 py-1 text-[11px] text-warn">
                        At the upper circuit: only buyers, so a buy order rarely fills today.
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {(Object.keys(CHECK_LABEL) as PulseCheck[]).map((k) => (
                        <span key={k} className={clsx("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]", c.checks[k] ? "bg-up-wash text-up" : "bg-wash text-ink-3")}>
                          {c.checks[k] ? <Check className="h-3 w-3" aria-label="met" /> : <X className="h-3 w-3" aria-label="not met" />} {CHECK_LABEL[k]}
                        </span>
                      ))}
                    </div>
                    <p className="tabular mt-2 text-[11px] text-ink-3">
                      RVOL {c.rvol?.toFixed(1) ?? "—"}× · RSI {c.rsi.toFixed(0)} · ADX {c.adx.toFixed(0)}
                      {c.squeeze_before && " · tight range or low volume before the break"}
                    </p>
                    <div className="mt-3 flex items-center gap-3 border-t border-line pt-2.5 text-xs">
                      <button
                        onClick={() => setOpen(c.symbol)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 font-medium text-paper transition-opacity hover:opacity-90"
                      >
                        <LineChart className="h-3.5 w-3.5" /> Show on chart
                      </button>
                      <Link href={`/stock/${market}/${encodeURIComponent(c.symbol)}`} className="font-medium text-ink-2 hover:text-ink hover:underline">
                        Open stock →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {open && data.candidates.some((c) => c.symbol === open) && (
            <CandidateDialog
              market={market}
              c={data.candidates.find((c) => c.symbol === open)!}
              indexName={data.index.name}
              indexLive={data.index.price}
              tz={TZ[market]}
              onClose={() => setOpen(null)}
            />
          )}

          {data.buildup && (
            <Card title="F&O positioning" note={`Futures build-up across F&O stocks at the end of ${new Date(data.buildup.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}.`}>
              <BuildupBar counts={data.buildup.counts} />
            </Card>
          )}

          <p className="text-[11px] leading-relaxed text-ink-3">
            Indicators (20 EMA, 20-day high and volume, RSI, ADX) come from each stock&apos;s last completed day and are compared with live prices.
            Volume is today&apos;s so far, so RVOL reads low early in the session. These readings describe the market; they aren&apos;t tested predictions.
          </p>
        </>
      )}
    </div>
  );
}

/** What the candidate trade plan did on 10 years of breakouts, in plain words. */
function PlanRecord({ r, market }: { r: Pulse["records"]["plan"]; market: MarketId }) {
  return (
    <div className="mb-3 rounded-lg bg-warn-wash px-3 py-2.5 text-xs leading-relaxed text-warn">
      <p>
        <b>Why there&apos;s no entry, stop or target here.</b> Buying breakouts like these at the close, with a stop under the
        breakout level, a target at twice the risk and out after 10 trading days, was tested on {r.trades.toLocaleString()} past
        breakouts{market === "in" ? " (upper-circuit days excluded)" : ""}:
      </p>
      <div className="my-2 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
        <div className="bg-up" style={{ width: `${r.target_hit * 100}%` }} />
        <div className="bg-line" style={{ width: `${r.timed_out * 100}%` }} />
        <div className="bg-down" style={{ width: `${r.stopped * 100}%` }} />
      </div>
      <p>
        <b>{pct(r.target_hit)} reached the target</b> (usually within {r.median_days_to_target} days), {pct(r.timed_out)} ran out of time and{" "}
        <b>{pct(r.stopped)} hit the stop first</b>. The typical best gain within 10 days was {signedPct(r.median_best_gain)}. On average that
        lost a little after costs ({r.avg_r.toFixed(2)}R; momentum rating 80+: {r.high_momentum.avg_r.toFixed(2)}R), and no other
        target or time limit made money either. So this list shows what is breaking out, to study on the chart; it is not a buy signal.
      </p>
    </div>
  );
}

function LeadersList({ data, zone, market }: { data: Pulse["leaders"]; zone: Pulse["leaders_zone"]; market: MarketId }) {
  const top = data
    .filter((d) => d.rating >= zone.rating && d.from_high >= zone.from_high)
    .sort((a, b) => b.rating - a.rating || b.from_high - a.from_high)
    .slice(0, 12);
  if (top.length === 0) return <p className="text-sm text-ink-3">No stock is in the leaders zone right now.</p>;
  return (
    <table className="w-full table-fixed text-sm">
      <caption className="sr-only">Top stocks in the leaders zone</caption>
      <thead>
        <tr className="border-b border-line text-left text-[11px] text-ink-3">
          <th scope="col" className="w-6 pb-1.5 font-normal">#</th>
          <th scope="col" className="pb-1.5 font-normal">Stock</th>
          <th scope="col" className="w-[72px] pb-1.5 text-right font-normal leading-tight" title="Momentum rating vs all liquid stocks: 99 = stronger than 99% of the market">
            Momentum
            <span className="block text-[10px]">1–99</span>
          </th>
          <th scope="col" className="w-[72px] pb-1.5 text-right font-normal leading-tight" title="How far the price is below its highest price of the last 12 months">
            From high
            <span className="block text-[10px]">52 weeks</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {top.map((d, i) => (
          <tr key={d.symbol}>
            <td className="tabular py-1.5 text-xs text-ink-3">{i + 1}</td>
            <td className="truncate py-1.5 pr-2">
              <Link href={`/stock/${market}/${encodeURIComponent(d.symbol)}`} className="font-medium hover:underline">
                {d.symbol}
              </Link>
              {d.sector && <span className="ml-1.5 text-xs text-ink-3">{d.sector}</span>}
            </td>
            <td className="py-1.5 text-right">
              <span className="tabular rounded bg-up-wash px-1.5 text-[11px] font-medium text-up">{d.rating}</span>
            </td>
            <td className="tabular py-1.5 text-right text-xs text-ink-2">{d.from_high > -0.005 ? "at high" : `${(d.from_high * 100).toFixed(1)}%`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Card({ title, note, className, children }: { title: string; note?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={clsx("rounded-xl border border-line p-4", className)}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {note && <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bar({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value ?? 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-ink-2">{label}</span>
        <span className="tabular font-medium">{pct(value)}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-line" role="meter" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div
          className={clsx("h-full rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none", v >= 0.6 ? "bg-up" : v < 0.3 ? "bg-down" : "bg-accent")}
          style={{ width: `${v * 100}%` }}
        />
        {[0.3, 0.6].map((t) => (
          <span key={t} className="absolute -top-0.5 h-3.5 w-px bg-ink-3/60" style={{ left: `${t * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

function Big({ label, value, change, invert }: { label: string; value: string; change: number | null; invert?: boolean }) {
  const good = change != null && (invert ? change < 0 : change >= 0);
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="tabular mt-0.5 text-xl font-semibold tracking-tight">{value}</p>
      {change != null && (
        <p className={clsx("tabular text-xs", good ? "text-up" : "text-down")}>
          {change >= 0 ? "+" : ""}
          {change.toFixed(2)}%
        </p>
      )}
    </div>
  );
}

/** Advances / declines and new highs / lows; tap either to see the stocks behind the numbers. */
function BreadthLists({ ad, hl, market }: { ad: Pulse["advance_decline"]; hl: Pulse["highs_lows"]; market: MarketId }) {
  const [open, setOpen] = useState<"ad" | "hl" | null>(null);
  const rows = [
    { id: "ad" as const, label: "Advances / declines", a: ad.advances, b: ad.declines, mid: ad.unchanged, aLabel: "up", bLabel: "down",
      lists: [[`Biggest gainers · top ${ad.top_up?.length ?? 0} of ${ad.advances}`, ad.top_up], [`Biggest losers · top ${ad.top_down?.length ?? 0} of ${ad.declines}`, ad.top_down]] as const },
    { id: "hl" as const, label: "New 52-week highs / lows", a: hl.highs, b: hl.lows, mid: 0, aLabel: "highs", bLabel: "lows",
      lists: [[listTitle("At a 52-week high", hl.high_list, hl.highs), hl.high_list], [listTitle("At a 52-week low", hl.low_list, hl.lows), hl.low_list]] as const },
  ];
  return (
    <div className="mt-4 space-y-1 text-xs">
      {rows.map((r) => {
        const expanded = open === r.id;
        const has = r.lists.some(([, l]) => l != null);
        return (
          <div key={r.id}>
            <button type="button" disabled={!has} aria-expanded={expanded} aria-controls={`breadth-${r.id}`}
              onClick={() => setOpen(expanded ? null : r.id)}
              className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1.5 text-left transition-colors enabled:hover:bg-wash">
              <Split label={r.label} a={r.a} b={r.b} mid={r.mid} aLabel={r.aLabel} bLabel={r.bLabel} expanded={has ? expanded : undefined} />
            </button>
            {expanded && (
              <div id={`breadth-${r.id}`} className="mb-2 mt-1 space-y-3 rounded-lg border border-line p-2.5">
                {r.lists.map(([title, list], k) => (
                  <StockList key={title} title={title} list={list ?? []} market={market} up={k === 0} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function listTitle(what: string, list: unknown[] | undefined, total: number) {
  return list && total > list.length ? `${what} · ${list.length} most traded of ${total}` : `${what} · ${total}`;
}

function StockList({ title, list, market, up }: { title: string; list: PulseStock[]; market: MarketId; up: boolean }) {
  return (
    <div className="min-w-0">
      <p className={clsx("mb-1 text-[11px] font-medium", up ? "text-up" : "text-down")}>{title}</p>
      {list.length === 0 ? (
        <p className="py-1 text-ink-3">None right now.</p>
      ) : (
        <ul className="max-h-48 divide-y divide-line overflow-y-auto">
          {list.map((x) => (
            <li key={x.symbol}>
              <Link href={`/stock/${market}/${encodeURIComponent(x.symbol)}`}
                className="flex items-center gap-2 py-1.5 hover:bg-wash">
                <StockLogo market={market} symbol={x.symbol} size={18} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-ink">{x.symbol}</span>
                  {x.sector && <span className="text-ink-3"> · {x.sector}</span>}
                </span>
                <span className="tabular text-ink-2">{price(x.price, market)}</span>
                <span className={clsx("tabular w-14 text-right", (x.change_pct ?? 0) >= 0 ? "text-up" : "text-down")}>
                  {x.change_pct == null ? "—" : `${x.change_pct >= 0 ? "+" : ""}${x.change_pct.toFixed(2)}%`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Split({ label, a, b, mid = 0, aLabel, bLabel, expanded }: {
  label: string; a: number; b: number; mid?: number; aLabel: string; bLabel: string; expanded?: boolean;
}) {
  const total = a + b + mid || 1;
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2">
        <span className="flex items-center gap-1 text-ink-2">
          {label}
          {expanded != null && <ChevronDown className={clsx("h-3.5 w-3.5 text-ink-3 transition-transform", expanded && "rotate-180")} aria-hidden />}
        </span>
        <span className="tabular text-ink-3">
          <span className="text-up">{a} {aLabel}</span> · <span className="text-down">{b} {bLabel}</span>
        </span>
      </div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        <div className="bg-up transition-[width] duration-1000 ease-out" style={{ width: `${(a / total) * 100}%` }} />
        {mid > 0 && <div className="bg-line transition-[width] duration-1000" style={{ width: `${(mid / total) * 100}%` }} />}
        <div className="bg-down transition-[width] duration-1000 ease-out" style={{ width: `${(b / total) * 100}%` }} />
      </div>
    </div>
  );
}

function BuildupBar({ counts }: { counts: Partial<Record<keyof typeof BUILDUP, number>> }) {
  const kinds = ["long_buildup", "short_covering", "neutral", "long_unwinding", "short_buildup"] as const;
  const total = kinds.reduce((s, k) => s + (counts[k] ?? 0), 0) || 1;
  const bar: Record<(typeof kinds)[number], string> = {
    long_buildup: "bg-up", short_covering: "bg-accent", neutral: "bg-line", long_unwinding: "bg-warn", short_buildup: "bg-down",
  };
  return (
    <div>
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">
        {kinds.map(
          (k) =>
            (counts[k] ?? 0) > 0 && (
              <div key={k} className={clsx(bar[k], "transition-[width] duration-1000 ease-out")} style={{ width: `${((counts[k] ?? 0) / total) * 100}%` }} title={BUILDUP[k].label} />
            ),
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {kinds.map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-ink-2">
            <span className={clsx("h-2 w-2 rounded-full", bar[k])} /> {BUILDUP[k].label} <span className="tabular text-ink-3">{counts[k] ?? 0}</span>
          </span>
        ))}
      </div>
      <Link href="/fno#buildup" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
        See the stocks →
      </Link>
    </div>
  );
}

function RefreshRing({ left, total, live, updated, tz, onRefresh }: { left: number; total: number; live: boolean; updated?: number; tz: string; onRefresh: () => void }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <button onClick={onRefresh} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-2 hover:border-ink-3 hover:text-ink"
      title="Refresh now" aria-label={`Refreshes in ${left} seconds; refresh now`}>
      <svg width={22} height={22} className="-rotate-90" aria-hidden>
        <circle cx={11} cy={11} r={r} fill="none" className="stroke-line" strokeWidth={2.5} />
        <circle cx={11} cy={11} r={r} fill="none" className="stroke-accent transition-[stroke-dashoffset] duration-1000 ease-linear" strokeWidth={2.5}
          strokeDasharray={c} strokeDashoffset={c * (1 - left / total)} />
      </svg>
      <span className="text-left leading-tight">
        <span className="flex items-center gap-1.5">
          <span className={clsx("h-1.5 w-1.5 rounded-full", live ? "animate-pulse bg-up" : "bg-ink-3")} /> {live ? "Live" : "Market closed"}
        </span>
        <span className="tabular text-ink-3">
          {updated ? new Date(updated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }) : ""} · next in {Math.floor(left / 60)}:
          {String(left % 60).padStart(2, "0")}
        </span>
      </span>
    </button>
  );
}
