"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { getMoves, getPulse, type MarketId, type Pulse, type PulseMoves, type PulseStock } from "@/lib/api";
import { MARKETS, price } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { moodLabel } from "@/components/pulse/MoodGauge";
import { MoveHistogram, type MoveMode } from "@/components/pulse/MoveHistogram";
import { SectorRotation } from "@/components/pulse/SectorRotation";
import { SectorTreemap } from "@/components/pulse/SectorTreemap";
import { Shortlist } from "@/components/pulse/Shortlist";
import { BreadthLine } from "@/components/pulse/BreadthLine";
import { Bubbles } from "@/components/pulse/Bubbles";
import { SectorBars } from "@/components/pulse/SectorBars";
import { StockLogo } from "@/components/StockLogo";
import { LeadersMap } from "@/components/pulse/LeadersMap";
import { OrderFlow } from "@/components/pulse/OrderFlow";
import { BUILDUP } from "@/components/OiLevels";

const REFRESH_S = 30; // during market hours prices move fast; the server recomputes at most every 25 s
const TZ = { in: "Asia/Kolkata", us: "America/New_York" } as const;
const TAB_KEY = "pulse-tab";
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "sectors", label: "Sectors" },
  { id: "momentum", label: "Momentum" },
  { id: "flow", label: "Flow" },
  { id: "fno", label: "F&O" },
  { id: "shortlist", label: "Shortlist" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const pct = (v: number | null | undefined, d = 0) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);

/** Market Pulse: a strip of the day's headline numbers, then one section at a time in tabs, ending in a shortlist. */
export default function PulsePage() {
  const { market } = useMarket();
  const [data, setData] = useState<Pulse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(REFRESH_S);

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

  const ad = data?.advance_decline;
  const hl = data?.highs_lows;
  const tabs = TABS.filter((t) => t.id !== "fno" || (market === "in" && data?.buildup));
  const [tab, setTab] = useState<TabId>("overview");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as TabId | null;
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved);
    } catch {}
  }, []);
  function choose(id: TabId) {
    setTab(id);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {}
  }
  const active = tabs.some((t) => t.id === tab) ? tab : "overview";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Market Pulse · {MARKETS[market].name}</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            The market today{data ? ` across ${data.stocks.toLocaleString()} liquid stocks` : ""}, and a shortlist of the strongest.
          </p>
        </div>
        <RefreshRing left={left} total={REFRESH_S} live={!!data?.market_open} updated={data?.updated_at} tz={TZ[market]} onRefresh={load} />
      </div>

      {error && <p className="rounded-xl border border-line p-4 text-sm text-ink-2">{error}</p>}
      {!data && !error && (
        <div className="space-y-4">
          <div className="h-20 animate-pulse rounded-xl bg-wash" />
          <div className="h-80 animate-pulse rounded-xl bg-wash" />
        </div>
      )}

      {data && ad && hl && (
        <>
          <MarketStrip data={data} market={market} />

          <div role="tablist" aria-label="Pulse sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 text-sm">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => choose(t.id)}
                className={clsx("-mb-px shrink-0 border-b-2 px-3 py-2 transition-colors",
                  active === t.id ? "border-ink font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink")}>
                {t.label}
              </button>
            ))}
          </div>

          {active === "overview" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title="Breadth through the day" note="% of stocks above their 20 EMA. Rising from below 30–40% towards 60%+ often marks a fresh upswing.">
                <BreadthLine points={data.history} tz={TZ[market]} />
              </Card>
              <MovesCard data={data} market={market} />
              <Card title="Breadth" note="Share of stocks above each average. Above 60%: broad strength; below 30%: broad weakness.">
                <div className="space-y-4 pt-1">
                  <Bar label="Above 20 EMA (short term)" value={data.breadth.above_ema20} />
                  <Bar label="Above 50-day average" value={data.breadth.above_50dma} />
                  <Bar label="Above 200-day average (long term)" value={data.breadth.above_200dma} />
                </div>
              </Card>
              <Card title="Gainers, losers and new highs / lows" note="Tap a row to see the stocks behind the numbers.">
                <BreadthLists ad={ad} hl={hl} market={market} />
              </Card>
            </div>
          )}

          {active === "sectors" && (
            <div className="space-y-4">
              <Card title="Sector map" note="Each tile is a sector, sized by money traded today and coloured by its median move. Hover a tile for details.">
                <SectorTreemap sectors={data.sectors} market={market} />
              </Card>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
                <Card title="Sector rotation" note="Median move over the last month against this week. Sectors drift between the corners as leadership changes. Bubble size = money traded today.">
                  <SectorRotation sectors={data.sectors} />
                </Card>
                <Card title="Sectors today" note="Median move today; ↑20 = share of the sector above its 20 EMA.">
                  <SectorBars sectors={data.sectors} />
                </Card>
              </div>
            </div>
          )}

          {active === "momentum" && (
            <Card
              title={`Momentum leaders · ${data.leaders_zone.count} in the zone`}
              note={`Momentum rating (NSE Nifty200 Momentum 30 method: 6- and 12-month returns adjusted for volatility, ranked 1–99) against distance from the 52-week high. Tested on 10 years: the top 20% beat the average liquid stock by ${pct(data.records.momentum.quarter, 1)} over the next 3 months, after costs. A tilt for 1–3 month holds, not a 2–3 day signal.`}
            >
              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <LeadersMap data={data.leaders} zone={data.leaders_zone} market={market} />
                <LeadersList data={data.leaders} zone={data.leaders_zone} market={market} />
              </div>
            </Card>
          )}

          {active === "flow" && (
            <div className="space-y-4">
              {market === "in" && <OrderFlow />}
              <Card title="Volume vs move" note="Today's most traded stocks. Above the dashed line = at least 1.5× usual volume (in testing, heavy volume on up moves didn’t lead to better returns). Click a bubble to open the stock.">
                <Bubbles data={data.bubbles} market={market} />
              </Card>
            </div>
          )}

          {active === "fno" && data.buildup && (
            <Card title="F&O positioning" note={`Futures build-up across F&O stocks at the end of ${new Date(data.buildup.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}. A common reading of positioning, not a tested signal.`}>
              <BuildupBar counts={data.buildup.counts} />
            </Card>
          )}

          {active === "shortlist" && (
            <Card title={`Shortlist · ${data.shortlist.stocks.length} stocks`} note="Thousands of stocks narrowed to the strongest few, by the one method here that held up on 10 years of data.">
              <Shortlist data={data.shortlist} record={data.records.shortlist} market={market} />
            </Card>
          )}

          <p className="text-[11px] leading-relaxed text-ink-3">
            Indicators come from each stock&apos;s last completed day and are compared with live prices. Volume is today&apos;s so far, so it
            reads low early in the session. Only momentum is a tested signal here; the rest describes the market.
          </p>
        </>
      )}
    </div>
  );
}

/** How far stocks moved over the last 1-7 sessions; today's comes with the Pulse snapshot, longer periods on demand. */
function MovesCard({ data, market }: { data: Pulse; market: MarketId }) {
  const [days, setDays] = useState(1);
  const [mode, setMode] = useState<MoveMode>("bands");
  const [moves, setMoves] = useState<PulseMoves | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (days === 1) return;
    let alive = true;
    setError(null);
    getMoves(market, days)
      .then((m) => alive && setMoves(m))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load the moves"));
    return () => {
      alive = false;
    };
  }, [market, days, data.updated_at]); // refetched on every Pulse refresh
  const bins = days === 1 ? data.histogram : moves?.days === days ? moves.bins : null;
  const span = days === 1 ? "today" : `over the last ${days} sessions`;
  return (
    <Card
      title={`How far stocks moved ${span}`}
      note={`${mode === "atleast" ? "Number of stocks at or beyond each move: \"+2% or more\" also counts +4%, +6% and higher; \"-2% or worse\" also counts -4% and lower." : "Number of stocks in each band of their move."} ${days > 1 ? "Live price vs the close " + days + " sessions back. " : ""}Click a bar to see its stocks.`}
      action={
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <div role="radiogroup" aria-label="View" className="flex rounded-md border border-line p-0.5 text-xs">
          {([["bands", "Bands"], ["atleast", "At least"]] as const).map(([m, l]) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
              className={clsx("rounded px-2 py-0.5", mode === m ? "bg-wash font-medium text-ink" : "text-ink-3 hover:text-ink")}>
              {l}
            </button>
          ))}
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-3">
          Period
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Number of sessions"
            className="rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>{d === 1 ? "1 day (today)" : `${d} days`}</option>
            ))}
          </select>
        </label>
        </div>
      }
    >
      {error && <p className="text-sm text-ink-2">{error}</p>}
      {!error && !bins && <div className="h-56 animate-pulse rounded-lg bg-wash" />}
      {bins && <MoveHistogram key={`${days}-${mode}`} bins={bins} market={market} days={days} mode={mode} />}
    </Card>
  );
}

/** One row of the day's headline numbers, always visible above the tabs. */
function MarketStrip({ data, market }: { data: Pulse; market: MarketId }) {
  const ad = data.advance_decline;
  const hl = data.highs_lows;
  const mood = data.mood;
  const tiles = [
    { label: "Market mood", value: mood != null ? String(Math.round(mood * 100)) : "—", sub: mood != null ? moodLabel(mood) : "",
      tone: mood == null ? "" : mood >= 0.65 ? "text-up" : mood < 0.45 ? "text-down" : "text-ink-2",
      title: "Breadth, advances vs declines and new highs vs lows, combined (0–100)" },
    { label: "Above 20 EMA", value: pct(data.breadth.above_ema20), sub: "of stocks", tone: "", title: "Share of stocks above their 20-day EMA" },
    { label: "Advances / declines", value: `${ad.advances} / ${ad.declines}`, sub: `${ad.unchanged} unchanged`, tone: ad.advances >= ad.declines ? "text-up" : "text-down", title: "" },
    { label: "52-week highs / lows", value: `${hl.highs} / ${hl.lows}`, sub: "today", tone: hl.highs >= hl.lows ? "text-up" : "text-down", title: "" },
    { label: data.index.name, value: price(data.index.price, market), sub: signed(data.index.change_pct), tone: (data.index.change_pct ?? 0) >= 0 ? "text-up" : "text-down", title: "" },
    { label: data.vix.name, value: data.vix.value != null ? data.vix.value.toFixed(2) : "—", sub: signed(data.vix.change_pct),
      tone: (data.vix.change_pct ?? 0) <= 0 ? "text-up" : "text-down", title: "Volatility index: higher means wider swings" },
  ];
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t, i) => (
        <div key={t.label} title={t.title || undefined}
          className={clsx("border-line px-4 py-3", i % 2 === 1 && "border-l", i >= 2 && "border-t",
            "sm:border-l-0 sm:border-t-0 sm:[&:not(:nth-child(3n+1))]:border-l sm:[&:nth-child(n+4)]:border-t",
            "lg:border-t-0 lg:[&:not(:first-child)]:border-l")}>
          <p className="truncate text-[11px] text-ink-3">{t.label}</p>
          <p className="tabular mt-0.5 text-lg font-semibold tracking-tight">{t.value}</p>
          <p className={clsx("tabular text-[11px]", t.tone || "text-ink-3")}>{t.sub}</p>
        </div>
      ))}
    </div>
  );
}

function signed(v: number | null | undefined) {
  return v == null ? "" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
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

function Card({ title, note, className, action, children }: {
  title: string; note?: string; className?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className={clsx("rounded-xl border border-line p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
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
