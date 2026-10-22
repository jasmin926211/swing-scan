"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronDown, Info, TriangleAlert } from "lucide-react";
import { getChecklist, type Checklist, type FactStatus, type MarketId } from "@/lib/api";

const STATUS: Record<FactStatus, { Icon: typeof Info; cls: string; label: string }> = {
  info: { Icon: Info, cls: "bg-wash text-ink-3", label: "Fact" },
  caution: { Icon: TriangleAlert, cls: "bg-warn-wash text-warn", label: "Caution" },
};

/** Before you trade: the facts about one stock. No pass / fail verdict and no entry / stop / target: those looked like
 *  tested advice and weren't (a plan built the same way lost money on 90,273 tested breakouts). */
export function TradeChecklist({ market, symbol }: { market: MarketId; symbol: string }) {
  const [data, setData] = useState<Checklist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    getChecklist(market, symbol)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load the facts"));
    return () => {
      alive = false;
    };
  }, [market, symbol]);

  return (
    <section className="rounded-xl border border-line">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Before you trade: the facts</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
          What to know about {symbol} before a trade. Facts, not a buy or sell signal; cautions mark practical risks
          (hard to exit, results soon, costs against a normal move).
        </p>
      </div>
      {error && <p className="px-4 py-3 text-sm text-down">{error}</p>}
      {!data && !error && <div className="m-4 h-40 animate-pulse rounded-lg bg-wash" />}
      {data && (
        <>
          {data.cautions.length > 0 && (
            <p className="mx-4 mt-3 rounded-lg bg-warn-wash px-3 py-2 text-xs text-warn">
              <b>Caution:</b> {data.cautions.join(", ").toLowerCase()}.
            </p>
          )}
          <ul className="divide-y divide-line px-4 py-1">
            {data.items.map((x) => {
              const { Icon, cls, label } = STATUS[x.status];
              const expanded = open === x.title;
              return (
                <li key={x.title}>
                  <button
                    onClick={() => setOpen(expanded ? null : x.title)}
                    disabled={!x.detail}
                    aria-expanded={expanded}
                    className="flex w-full items-start gap-3 py-2.5 text-left text-sm disabled:cursor-default"
                  >
                    <span className={clsx("mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full", cls)} title={label}>
                      <Icon className="h-3 w-3" aria-label={label} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-xs text-ink-3">{x.title}</span>
                      <span className="block text-ink">{x.summary}</span>
                      {expanded && x.detail && <span className="mt-1 block text-xs leading-relaxed text-ink-2">{x.detail}</span>}
                    </span>
                    {x.detail && <ChevronDown className={clsx("mt-1 h-4 w-4 shrink-0 text-ink-3 transition-transform", expanded && "rotate-180")} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
