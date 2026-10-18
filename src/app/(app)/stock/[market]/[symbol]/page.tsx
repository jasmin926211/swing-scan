"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { getHistory, getPatterns, getQuote, type Candle, type Forecast, type Interval, type MarketId, type PatternSignal, type StockQuote } from "@/lib/api";
import { MARKETS, changeColor, compact, marketStateLabel, price, signedPct } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { PriceChart } from "@/components/charts/PriceChart";
import { RangeBar } from "@/components/RangeBar";
import { ForecastPanel } from "@/components/ForecastPanel";
import { AccuracyCheck, useAccuracyCheck } from "@/components/AccuracyCheck";
import { ValidatedPatterns } from "@/components/ValidatedPatterns";
import { StockLogo } from "@/components/StockLogo";

const INTERVALS: { id: Interval; label: string }[] = [
  { id: "1h", label: "Hourly" },
  { id: "1d", label: "Daily" },
  { id: "1wk", label: "Weekly" },
];

export default function StockPage() {
  const params = useParams<{ market: string; symbol: string }>();
  const market: MarketId = params.market === "us" ? "us" : "in";
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const { setMarket } = useMarket();

  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [interval, setBarInterval] = useState<Interval>("1d");
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [showPaths, setShowPaths] = useState(false);
  const [signals, setSignals] = useState<PatternSignal[] | null>(null);
  const [liquid, setLiquid] = useState(true);
  const [patternError, setPatternError] = useState<string | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<number | null>(null);

  // Validated patterns don't depend on the chart's interval (they come from daily / weekly / monthly candles).
  useEffect(() => {
    let alive = true;
    setSignals(null);
    setSelectedSignal(null);
    setPatternError(null);
    getPatterns(market, symbol)
      .then((r) => {
        if (!alive) return;
        setSignals(r.signals);
        setLiquid(r.liquid);
      })
      .catch((e) => alive && setPatternError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [market, symbol]);
  const accuracy = useAccuracyCheck(market, symbol, interval);

  // Every forecast is followed by the AI's recent track record on this stock (once per stock & interval),
  // so the panel can say when the forecast deserves little trust.
  function onForecast(f: Forecast) {
    setForecast(f);
    if (!accuracy.result && !accuracy.running) accuracy.run();
  }

  // Opening a stock link selects its country in the header. Only on route change, so the
  // header's own country switch (which navigates away) isn't undone.
  useEffect(() => {
    setMarket(market);
  }, [market, setMarket]);

  const isOpen = quote?.market_state === "REGULAR";

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const q = await getQuote(market, symbol);
        if (alive) {
          setQuote(q);
          setQuoteError(null);
        }
      } catch (e) {
        if (alive) setQuoteError((e as Error).message);
      }
      if (alive) timer = setTimeout(load, isOpen ? 15_000 : 60_000);
    }
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [market, symbol, isOpen]);

  useEffect(() => {
    let alive = true;
    setCandles(null);
    setHistoryError(null);
    setForecast(null); // a forecast belongs to one bar interval
    getHistory(market, symbol, interval)
      .then((h) => alive && setCandles(h.candles))
      .catch((e) => alive && setHistoryError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [market, symbol, interval]);

  if (quoteError && !quote) {
    return (
      <div className="space-y-4">
        <BackLink market={market} />
        <p className="text-sm text-down">{quoteError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink market={market} />

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <StockLogo market={market} symbol={symbol} size={48} className="mt-0.5" />
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {symbol}
              {quote?.exchange && <span className="rounded border border-line px-1.5 text-xs font-normal text-ink-3">{quote.exchange}</span>}
            </h1>
            <p className="mt-0.5 text-sm text-ink-2">
              {quote?.name ?? " "}
              {quote?.sector && <span className="text-ink-3"> · {quote.sector}</span>}
            </p>
            {quote?.has_fno && (
              <Link href={`/fno/${market}/${encodeURIComponent(symbol)}`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                Futures &amp; options analysis →
              </Link>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="tabular text-3xl font-semibold tracking-tight">{quote ? price(quote.price, market) : "—"}</p>
          <p className={clsx("tabular text-sm", changeColor(quote?.change))}>
            {quote?.change != null && `${quote.change > 0 ? "+" : ""}${price(quote.change, market)}`} ({signedPct(quote?.change_pct)})
          </p>
          <p className="mt-0.5 flex items-center justify-end gap-1.5 text-xs text-ink-3">
            <span className={clsx("h-1.5 w-1.5 rounded-full", isOpen ? "bg-up" : "bg-ink-3")} />
            {marketStateLabel(quote?.market_state)} · {quote?.currency ?? MARKETS[market].currency}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-line p-4 text-sm sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Open" value={price(quote?.open, market)} />
        <Stat label="Day high" value={price(quote?.high, market)} />
        <Stat label="Day low" value={price(quote?.low, market)} />
        <Stat label="Prev close" value={price(quote?.prev_close, market)} />
        <Stat label="Volume" value={compact(quote?.volume, market)} />
        <Stat label="Avg vol (3M)" value={compact(quote?.avg_volume, market)} />
        <Stat label="Market cap" value={compact(quote?.market_cap, market)} />
        <Stat label="P/E" value={quote?.pe != null ? quote.pe.toFixed(1) : "—"} />
        <div className="col-span-2 sm:col-span-4 lg:col-span-8">
          <p className="mb-1.5 text-xs text-ink-3">52-week range</p>
          <RangeBar low={quote?.low_52w} high={quote?.high_52w} value={quote?.price} market={market} labels />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="self-start rounded-xl border border-line lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <div className="flex gap-1 text-sm">
              {INTERVALS.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setBarInterval(i.id)}
                  className={clsx(
                    "rounded-md px-3 py-1 transition-colors",
                    interval === i.id ? "bg-wash font-medium text-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {i.label}
                </button>
              ))}
            </div>
            {forecast && (
              <label className="flex items-center gap-2 text-xs text-ink-2">
                <input type="checkbox" checked={showPaths} onChange={(e) => setShowPaths(e.target.checked)} className="accent-accent" />
                Show all {forecast.paths.length} sampled paths
              </label>
            )}
          </div>
          <div className="p-2">
            {historyError ? (
              <p className="p-6 text-sm text-down">Could not load chart: {historyError}</p>
            ) : candles ? (
              <PriceChart
                candles={candles}
                interval={interval}
                forecast={forecast}
                showPaths={showPaths}
                decimals={2}
                signals={signals ?? []}
                selected={selectedSignal}
                onSelect={setSelectedSignal}
              />
            ) : (
              <div className="h-[520px] animate-pulse rounded-lg bg-wash" />
            )}
          </div>
        </section>

        <ForecastPanel
          key={`${market}/${symbol}/${interval}`}
          market={market}
          symbol={symbol}
          interval={interval}
          forecast={forecast}
          onForecast={onForecast}
          accuracy={accuracy}
        />
      </div>

      <ValidatedPatterns
        signals={signals}
        liquid={liquid}
        loading={signals === null && !patternError}
        error={patternError}
        market={market}
        selected={selectedSignal}
        onSelect={setSelectedSignal}
      />

      <AccuracyCheck market={market} symbol={symbol} interval={interval} check={accuracy} />
    </div>
  );
}

function BackLink({ market }: { market: MarketId }) {
  return (
    <Link href="/markets" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
      <ArrowLeft className="h-4 w-4" /> {MARKETS[market].name} stocks
    </Link>
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
