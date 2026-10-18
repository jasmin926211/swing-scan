"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import type * as HighchartsNS from "highcharts";
import { Minus, Play, TrendingDown, TrendingUp } from "lucide-react";
import { needsUpstox, runIdeas, type Idea, type IdeasResult, type MarketId, type ModelName } from "@/lib/api";
import { fmtDate, money, pct, price } from "@/lib/format";
import { COLORS } from "@/lib/highcharts";
import { Chart } from "./Chart";

const OUTLOOK = {
  bullish: { label: "Bullish", Icon: TrendingUp, cls: "bg-[#e8f6f0] text-up" },
  bearish: { label: "Bearish", Icon: TrendingDown, cls: "bg-[#fcebeb] text-down" },
  neutral: { label: "Neutral", Icon: Minus, cls: "bg-wash text-ink-2" },
};

export function FnoIdeas({ market, symbol, expiry }: { market: MarketId; symbol: string; expiry: string }) {
  const [model, setModel] = useState<ModelName>("balanced");
  const [samples, setSamples] = useState(30);
  const [result, setResult] = useState<IdeasResult | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);

  async function run() {
    setRunning(true);
    setElapsed(0);
    setError(null);
    try {
      setResult(await runIdeas(market, symbol, { expiry, model, n_samples: samples }));
    } catch (e) {
      setError(needsUpstox(e) ? "Connect Upstox above to load Indian option prices first." : (e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const s = result?.forecast.summary;
  const scale = result ? result.spot / result.forecast.summary.last_close : 1; // forecast was rescaled to live spot

  return (
    <section className="rounded-xl border border-line">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">AI trade ideas for {fmtDate(expiry)} expiry</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            Forecasts {symbol} to expiry, then values futures and defined-risk option trades on every sampled path.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select value={model} onChange={(e) => setModel(e.target.value as ModelName)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-ink-2">
            <option value="fast">Fast</option>
            <option value="balanced">Balanced</option>
            <option value="accurate">Thorough (slowest)</option>
          </select>
          <select value={samples} onChange={(e) => setSamples(Number(e.target.value))} className="rounded-lg border border-line bg-white px-2 py-1.5 text-ink-2">
            {[20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n} paths
              </option>
            ))}
          </select>
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-2 rounded-lg bg-ink px-4 py-1.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {running ? `Running on CPU… ${elapsed}s` : (
              <>
                <Play className="h-3.5 w-3.5" /> {result ? "Run again" : "Run AI forecast"}
              </>
            )}
          </button>
        </div>
      </div>
      {error && <p className="px-4 py-3 text-sm text-down">{error}</p>}

      {result && s && (
        <div className={clsx("space-y-5 p-4", running && "opacity-50")}>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 text-sm">
              <OutlookBadge outlook={s.outlook} />
              <Stat label={`Median price at expiry (${result.horizon} trading days)`} value={price(s.predicted_close * scale, market)}
                sub={`spot ${price(result.spot, market)}`} />
              <Stat label="AI 80% range" value={`${price(s.close_p10 * scale, market)} – ${price(s.close_p90 * scale, market)}`} />
              <Stat label="Chance of finishing higher" value={pct(s.prob_up, 0)} />
              {result.market_iv != null && <Stat label="Market implied volatility (ATM)" value={pct(result.market_iv)} />}
            </div>
            <div className="lg:col-span-2">
              <Distribution result={result} market={market} />
            </div>
          </div>

          <div className="rounded-lg bg-wash px-3 py-2 text-xs leading-relaxed text-ink-2">
            Each idea is valued twice: on the AI&apos;s paths, and on the option market&apos;s own expectation (its implied
            volatility). In testing the AI&apos;s range was too narrow (its 80% band held the outcome ~41% of the time), so it
            overrates selling options. Trust an idea more when both columns agree. Analysis only, not advice.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="px-2 py-2 font-normal">Idea (per lot of {result.lot_size})</th>
                  <th className="px-2 py-2 text-right font-normal">Premium</th>
                  <th className="px-2 py-2 text-right font-normal">Max profit</th>
                  <th className="px-2 py-2 text-right font-normal">Max loss</th>
                  <th className="px-2 py-2 text-right font-normal">Breakeven</th>
                  <th className="px-2 py-2 text-right font-normal">AI P(profit)</th>
                  <th className="px-2 py-2 text-right font-normal">AI avg P&amp;L</th>
                  <th className="px-2 py-2 text-right font-normal">Market P(profit)</th>
                  <th className="px-2 py-2 text-right font-normal">Market avg P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {result.ideas.map((i) => (
                  <IdeaRow key={i.name} idea={i} market={market} />
                ))}
              </tbody>
            </table>
            {result.ideas.length === 0 && <p className="py-4 text-sm text-ink-2">No option prices to build ideas from.</p>}
          </div>
          <p className="text-xs text-ink-3">
            Premium: + is credit received, − is debit paid. “Open” means no limit (e.g. a bought call’s profit or a sold future’s loss).
            {result.future_price == null && market === "in" && " No futures contract expires on this date, so futures ideas are left out."}{" "}
            The forecast took {result.forecast.seconds}s.
          </p>
        </div>
      )}
    </section>
  );
}

function Distribution({ result, market }: { result: IdeasResult; market: MarketId }) {
  const options = useCallback((): HighchartsNS.Options => {
    const prices = result.final_prices;
    const lo = Math.min(...prices, result.spot);
    const hi = Math.max(...prices, result.spot);
    const bins = 20;
    const width = (hi - lo) / bins || 1;
    const counts = Array.from({ length: bins }, () => 0);
    for (const p of prices) counts[Math.min(bins - 1, Math.floor((p - lo) / width))]++;
    return {
      chart: { type: "column" },
      legend: { enabled: false },
      xAxis: {
        labels: { style: { color: COLORS.ink3 } },
        lineColor: COLORS.line,
        plotLines: [{ value: result.spot, color: "#0b0b0b", width: 1, dashStyle: "Dash", zIndex: 5,
                      label: { text: "Spot", rotation: 0, y: 12, style: { color: COLORS.ink2 } } }],
      },
      yAxis: { title: { text: "Paths" }, allowDecimals: false, gridLineColor: COLORS.line, labels: { style: { color: COLORS.ink3 } } },
      tooltip: {
        formatter: function () {
          const x = (this as unknown as { x: number; y: number });
          return `${price(x.x - width / 2, market)} – ${price(x.x + width / 2, market)}: <b>${x.y}</b> paths`;
        },
      },
      plotOptions: { column: { pointPadding: 0, groupPadding: 0, borderWidth: 1, borderColor: "#ffffff", borderRadius: 2 } },
      series: [{ type: "column", name: "Forecast paths", color: COLORS.forecast, data: counts.map((c, i) => [lo + width * (i + 0.5), c]) }],
    };
  }, [result, market]);
  return <Chart options={options} height={220} label="Distribution of AI sampled prices at expiry" />;
}

function IdeaRow({ idea, market }: { idea: Idea; market: MarketId }) {
  const legs = idea.legs.map((l) =>
    l.kind === "FUT" ? `${l.side} future @ ${price(l.strike, market)}` : `${l.side} ${price(l.strike, market)} ${l.kind} @ ${price(l.price, market)}`,
  );
  return (
    <tr className="tabular border-t border-line align-top">
      <td className="px-2 py-2.5">
        <p className="flex items-center gap-1.5 font-medium">
          {idea.name}
          {idea.matches_outlook && <span className="rounded bg-[#eaf2fb] px-1 text-[10px] font-normal text-accent">matches AI view</span>}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{legs.join(" · ")}</p>
      </td>
      <td className="px-2 py-2.5 text-right">{idea.net_premium ? money(idea.net_premium, market) : "—"}</td>
      <td className="px-2 py-2.5 text-right">{idea.max_profit == null ? "Open" : money(idea.max_profit, market)}</td>
      <td className="px-2 py-2.5 text-right">{idea.max_loss == null ? "Open" : money(idea.max_loss, market)}</td>
      <td className="px-2 py-2.5 text-right text-xs">{idea.breakevens.map((b) => price(b, market)).join(" / ") || "—"}</td>
      <td className="px-2 py-2.5 text-right font-medium">{pct(idea.prob_profit, 0)}</td>
      <td className={clsx("px-2 py-2.5 text-right font-medium", idea.expected_pnl >= 0 ? "text-up" : "text-down")}>
        {money(idea.expected_pnl, market)}
      </td>
      <td className="px-2 py-2.5 text-right text-ink-2">{pct(idea.market_prob_profit, 0)}</td>
      <td className={clsx("px-2 py-2.5 text-right", (idea.market_expected_pnl ?? 0) >= 0 ? "text-up" : "text-down")}>
        {money(idea.market_expected_pnl, market)}
      </td>
    </tr>
  );
}

function OutlookBadge({ outlook }: { outlook: keyof typeof OUTLOOK }) {
  const { label, Icon, cls } = OUTLOOK[outlook];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", cls)}>
      <Icon className="h-3.5 w-3.5" /> AI: {label}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="tabular font-medium">
        {value} {sub && <span className="text-xs font-normal text-ink-3">· {sub}</span>}
      </p>
    </div>
  );
}
