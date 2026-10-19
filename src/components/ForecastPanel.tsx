"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Minus, Play, TrendingDown, TrendingUp } from "lucide-react";
import { runForecast, type Forecast, type ForecastParams, type Interval, type MarketId, type ModelName } from "@/lib/api";
import { barTime, pct, price } from "@/lib/format";
import type { AccuracyState } from "./AccuracyCheck";

const MODELS: { id: ModelName; label: string; note: string }[] = [
  { id: "fast", label: "Fast", note: "recommended: as accurate as the larger models in testing, and quickest" },
  { id: "balanced", label: "Balanced", note: "larger model, ~5× slower" },
  { id: "accurate", label: "Thorough", note: "largest model, ~3× slower" },
];

const HORIZON: Record<Interval, { value: number; unit: string; options: number[] }> = {
  "1h": { value: 14, unit: "hours", options: [7, 14, 21, 35] },
  "1d": { value: 10, unit: "days", options: [5, 10, 20, 30] },
  "1wk": { value: 8, unit: "weeks", options: [4, 8, 12, 26] },
};

const OUTLOOK = {
  bullish: { label: "Likely up (validated)", Icon: TrendingUp, cls: "bg-up-wash text-up" },
  bearish: { label: "Likely down (validated)", Icon: TrendingDown, cls: "bg-down-wash text-down" },
  // No call: the model's view hasn't proved reliable out of sample, so the site doesn't turn it into up / down.
  neutral: { label: "No reliable direction", Icon: Minus, cls: "bg-wash text-ink-2" },
};

export function ForecastPanel({
  market,
  symbol,
  interval,
  forecast,
  onForecast,
  accuracy,
}: {
  market: MarketId;
  symbol: string;
  interval: Interval;
  forecast: Forecast | null;
  onForecast: (f: Forecast) => void;
  accuracy: AccuracyState;
}) {
  const [model, setModel] = useState<ModelName>("fast");
  const [horizon, setHorizon] = useState(HORIZON[interval].value);
  const [samples, setSamples] = useState(20);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState<ForecastParams | null>(null);

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);

  async function run() {
    const params: ForecastParams = { interval, model, horizon, n_samples: samples };
    setRunning(true);
    setElapsed(0);
    setError(null);
    try {
      onForecast(await runForecast(market, symbol, params));
      setUsed(params);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const s = forecast?.summary;
  const unit = HORIZON[interval].unit;

  return (
    <section className="flex flex-col rounded-xl border border-line">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">AI forecast</h2>
        <p className="mt-0.5 text-xs text-ink-3">Samples many possible futures from the latest completed bars.</p>
      </div>

      <div className="space-y-4 p-4">
        <Field label="Model">
          <Segmented
            value={model}
            onChange={setModel}
            options={MODELS.map((m) => ({ value: m.id, label: m.label, title: m.note }))}
          />
        </Field>
        <Field label={`Forecast ahead (${unit})`}>
          <Segmented value={horizon} onChange={setHorizon} options={HORIZON[interval].options.map((n) => ({ value: n, label: String(n) }))} />
        </Field>
        <Field label="Sampled paths (more = steadier, slower)">
          <Segmented value={samples} onChange={setSamples} options={[10, 20, 30].map((n) => ({ value: n, label: String(n) }))} />
        </Field>

        <button
          onClick={run}
          disabled={running}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {running ? (
            <>Running on CPU… {elapsed}s</>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> {forecast ? "Run again" : `Forecast ${symbol}`}
            </>
          )}
        </button>
        {error && <p className="text-sm text-down">{error}</p>}
      </div>

      {s && forecast && (
        <div className={clsx("space-y-4 border-t border-line p-4 transition-opacity", running && "opacity-50")}>
          <TrustNote symbol={symbol} accuracy={accuracy} />

          <div className="flex items-center justify-between">
            <OutlookBadge outlook={s.outlook} />
            <span className="text-xs text-ink-3">
              next {forecast.points.length} {unit}
            </span>
          </div>

          <div>
            <p className="text-xs text-ink-3">Median predicted close</p>
            <p className="tabular text-2xl font-semibold tracking-tight">
              {price(s.predicted_close, market)}{" "}
              <span className={clsx("text-sm font-medium", s.predicted_close >= s.last_close ? "text-up" : "text-down")}>
                {s.predicted_close >= s.last_close ? "+" : ""}
                {pct(s.predicted_close / s.last_close - 1, 2)}
              </span>
            </p>
            <p className="tabular text-xs text-ink-3">from last close {price(s.last_close, market)}</p>
          </div>

          <DirectionNote s={s} paths={forecast.paths.length} />

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Item label="80% likely close" value={`${price(s.close_p10, market)} – ${price(s.close_p90, market)}`} wide />
            <Item label="Expected high" value={price(s.predicted_high, market)} />
            <Item label="Expected low" value={price(s.predicted_low, market)} />
            <Item label="Mean return" value={`${s.expected_return >= 0 ? "+" : ""}${pct(s.expected_return, 2)}`} />
            <Item label="Range width" value={pct(s.close_p90 / s.close_p10 - 1, 1)} />
          </dl>

          <p className="text-xs leading-relaxed text-ink-3">
            {used && MODELS.find((m) => m.id === used.model)?.label} model · {forecast.bars_used} bars up to{" "}
            {barTime(forecast.as_of, interval === "1h")} · {forecast.seconds}s. A statistical forecast, not advice — check its
            recent accuracy below before acting on it.
          </p>
        </div>
      )}
    </section>
  );
}

/** How much to trust this forecast, from the AI's recent record on the same stock. */
function TrustNote({ symbol, accuracy }: { symbol: string; accuracy: AccuracyState }) {
  const r = accuracy.result;
  if (accuracy.running && !r)
    return <p className="rounded-lg bg-wash px-3 py-2 text-xs text-ink-2">Checking the AI&apos;s recent record on {symbol}… {accuracy.elapsed}s</p>;
  if (!r) return null;
  const hits = `${Math.round(r.direction_accuracy * r.checks.length)}/${r.checks.length}`;
  const errors = `price error ${pct(r.mean_error_pct)} vs ${pct(r.naive_error_pct)} for “no change”`;
  if (r.verdict === "none")
    return (
      <p className="rounded-lg bg-down-wash px-3 py-2 text-xs leading-relaxed text-down">
        <b>Low trust.</b> The AI has had no skill on {symbol} recently: direction right {hits}, {errors}. Treat this
        forecast as noise.
      </p>
    );
  if (r.verdict === "weak")
    return (
      <p className="rounded-lg bg-warn-wash px-3 py-2 text-xs leading-relaxed text-warn">
        <b>Mixed record.</b> On {symbol} recently: direction right {hits}, {errors}. Use with caution.
      </p>
    );
  return (
    <p className="rounded-lg bg-wash px-3 py-2 text-xs leading-relaxed text-ink-2">
      <b>Looked better than “no change” recently</b> on {symbol}: direction right {hits}, {errors}. {r.checks.length} checks
      can&apos;t prove skill: a coin flip gets 6 of 8 right about 1 time in 7.
    </p>
  );
}

/** The model's own up / down view, next to how often such views were right in testing. */
function DirectionNote({ s, paths }: { s: Forecast["summary"]; paths: number }) {
  const upPaths = Math.round(s.prob_up * paths);
  return (
    <div className="rounded-lg border border-line px-3 py-2.5 text-xs leading-relaxed">
      <div className="flex justify-between gap-3">
        <span className="text-ink-3">Model&apos;s paths ending higher</span>
        <span className="tabular text-ink-2">
          {upPaths} / {paths}
        </span>
      </div>
      <div className="mt-1 flex justify-between gap-3">
        <span className="text-ink-3">Closed higher after views like this, in testing</span>
        <span className="tabular font-medium text-ink">{s.tested_prob_up != null ? `≈ ${pct(s.tested_prob_up, 0)}` : "not tested"}</span>
      </div>
      {!s.direction_validated && (
        <p className="mt-1.5 text-ink-3">
          On thousands of past forecasts for fresh stocks, the model&apos;s up / down view wasn&apos;t right often enough to act on,
          so it isn&apos;t turned into a buy or sell call. Use the range below for planning, not the direction.
        </p>
      )}
    </div>
  );
}

function OutlookBadge({ outlook }: { outlook: keyof typeof OUTLOOK }) {
  const { label, Icon, cls } = OUTLOOK[outlook];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", cls)}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-ink-3">{label}</p>
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; title?: string }[];
}) {
  return (
    <div className="flex rounded-lg border border-line p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={clsx(
            "flex-1 rounded-md px-2 py-1 transition-colors",
            value === o.value ? "bg-wash font-medium text-ink" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Item({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={clsx(wide && "col-span-2")}>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="tabular mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
