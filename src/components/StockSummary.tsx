"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronDown, Info, TrendingDown, TrendingUp } from "lucide-react";
import { getSummary, type MarketId, type StockSummary as Summary, type SummaryPoint, type SummarySide } from "@/lib/api";

const COLUMNS: { side: SummarySide; title: string; Icon: typeof TrendingUp; tone: string }[] = [
  { side: "bull", title: "Tested points for", Icon: TrendingUp, tone: "text-up" },
  { side: "bear", title: "Tested points against", Icon: TrendingDown, tone: "text-down" },
  { side: "check", title: "Facts to check", Icon: Info, tone: "text-ink-2" },
];

/** The stock's evidence in one place. Only points that held up in 10-year tests sit for or against; everything else
 *  (trend, 52-week range, fundamentals, futures positioning, ...) is a neutral fact. No verdict. */
export function StockSummary({ market, symbol }: { market: MarketId; symbol: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    getSummary(market, symbol)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load the summary"));
    return () => {
      alive = false;
    };
  }, [market, symbol]);

  return (
    <section className="overflow-hidden rounded-xl border border-line">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">At a glance</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
          Everything the site knows about {symbol}. Only points that held up in our 10-year tests (<TestedBadge tested />) are
          put for or against; the rest are facts (<TestedBadge tested={false} />) that weren&apos;t tested as signals. There&apos;s no buy or
          sell verdict: no mix of these points has been tested as one.
        </p>
      </div>
      {error && <p className="px-4 py-3 text-sm text-ink-2">{error}</p>}
      {!data && !error && <div className="m-4 h-28 animate-pulse rounded-lg bg-wash" />}
      {data && (
        <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {COLUMNS.map(({ side, title, Icon, tone }) => {
            const points = data.points.filter((p) => p.side === side);
            return (
              <div key={side} className="min-w-0 p-4">
                <h3 className={clsx("flex items-center gap-1.5 text-xs font-semibold", tone)}>
                  <Icon className="h-3.5 w-3.5" aria-hidden /> {title}
                  <span className="font-normal text-ink-3">· {points.length}</span>
                </h3>
                {points.length === 0 ? (
                  <p className="mt-2 text-xs text-ink-3">Nothing here right now.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {points.map((p) => <PointRow key={p.text} p={p} />)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PointRow({ p }: { p: SummaryPoint }) {
  const [open, setOpen] = useState(false);
  const body = (
    <>
      <span className="text-ink">{p.text}</span> <TestedBadge tested={p.tested} />
    </>
  );
  if (!p.detail) return <li className="text-sm leading-snug">{body}</li>;
  return (
    <li className="text-sm leading-snug">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="group flex w-full items-start gap-1 text-left">
        <span className="min-w-0 flex-1">{body}</span>
        <ChevronDown className={clsx("mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform group-hover:text-ink", open && "rotate-180")} aria-hidden />
      </button>
      {open && <p className="mt-1 text-xs leading-relaxed text-ink-2">{p.detail}</p>}
    </li>
  );
}

function TestedBadge({ tested }: { tested: boolean }) {
  return (
    <span className={clsx("inline-block whitespace-nowrap rounded px-1 align-[1px] text-[10px] font-medium",
      tested ? "bg-accent-wash text-accent" : "bg-wash text-ink-3")}>
      {tested ? "Tested" : "Fact"}
    </span>
  );
}
