"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, ClipboardCopy, Info, TriangleAlert, X } from "lucide-react";
import { getChecklist, type CheckStatus, type Checklist, type MarketId, type TradeSide } from "@/lib/api";
import { money, price } from "@/lib/format";

const STATUS: Record<CheckStatus, { Icon: typeof Check; cls: string; label: string }> = {
  pass: { Icon: Check, cls: "bg-up-wash text-up", label: "Pass" },
  warn: { Icon: TriangleAlert, cls: "bg-warn-wash text-warn", label: "Warning" },
  fail: { Icon: X, cls: "bg-down-wash text-down", label: "Fail" },
  info: { Icon: Info, cls: "bg-wash text-ink-3", label: "Info" },
};
const VERDICT: Record<Checklist["verdict"], { cls: string; text: string }> = {
  Passes: { cls: "border-line bg-wash text-ink", text: "No red flags in the checklist" },
  Caution: { cls: "border-warn/30 bg-warn-wash text-warn", text: "Caution: several warnings" },
  Skip: { cls: "border-down/30 bg-down-wash text-down", text: "Skip this trade" },
};
const DEFAULT_RISK: Record<MarketId, number> = { in: 10000, us: 500 };

/** The risk amount saved by the position-size calculator (Expected move card), or a default. */
function savedRisk(market: MarketId): number {
  try {
    const v = Number(localStorage.getItem(`ct.risk.${market}`));
    if (v > 0) return v;
  } catch {}
  return DEFAULT_RISK[market];
}

function planText(c: Checklist, market: MarketId, shares: number): string {
  const lines = [
    `${c.symbol}${c.name ? ` (${c.name})` : ""}: ${c.side === "long" ? "BUY" : "SELL / SHORT"} plan, ${new Date().toLocaleDateString("en-GB")}`,
    `Verdict: ${VERDICT[c.verdict].text}${c.fails.length ? ` (failed: ${c.fails.join(", ")})` : ""}`,
    ...(c.plan.valid === false
      ? [`No trade plan: ${c.plan.note}`]
      : [`Entry ${price(c.plan.entry, market)} · Stop ${price(c.plan.stop, market)} · Target ${price(c.plan.target, market)} · Risk:reward 1:${c.plan.rr.toFixed(1)}`,
         `Size ${shares} shares (risk ${money(shares * c.plan.risk_per_share, market)})`]),
    "",
    ...c.checks.map((x) => `${x.step}. ${x.title} [${STATUS[x.status].label}]: ${x.summary}`),
    "",
    "Reason for the trade: ",
    "Result / lessons: ",
  ];
  return lines.join("\n");
}

/** The 15-step pre-trade checklist for one stock, with long / short and a copyable trade plan. */
export function TradeChecklist({ market, symbol }: { market: MarketId; symbol: string }) {
  const [side, setSide] = useState<TradeSide>("long");
  const [data, setData] = useState<Checklist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState<"copied" | "saved" | null>(null);
  const [risk, setRisk] = useState(DEFAULT_RISK[market]);

  useEffect(() => setRisk(savedRisk(market)), [market, data]);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    getChecklist(market, symbol, side)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not run the checklist"));
    return () => {
      alive = false;
    };
  }, [market, symbol, side]);

  const shares = data && data.plan.risk_per_share > 0 ? Math.floor(risk / data.plan.risk_per_share) : 0;

  async function copy() {
    if (!data) return;
    const text = planText(data, market, shares);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("copied");
    } catch {
      // Clipboard blocked (permissions, insecure page): save the plan as a text file instead.
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `${data.symbol}-trade-plan.txt` });
      a.click();
      URL.revokeObjectURL(url);
      setCopied("saved");
    }
    window.setTimeout(() => setCopied(null), 2500);
  }

  return (
    <section className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Trade checklist</h2>
          <p className="mt-0.5 text-xs text-ink-3">15 steps to go through before every trade. Any fail: skip it, there&apos;s always another one.</p>
        </div>
        <div role="radiogroup" aria-label="Trade direction" className="flex rounded-lg border border-line p-0.5 text-sm">
          {(["long", "short"] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={side === s}
              onClick={() => setSide(s)}
              className={clsx("rounded-md px-3 py-1 transition-colors", side === s ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}
            >
              {s === "long" ? "Buy" : "Short"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="px-4 py-3 text-sm text-down">{error}</p>}
      {!data && !error && (
        <div className="space-y-2 p-4">
          <p className="text-xs text-ink-3">Checking market, sector, news, fundamentals and the chart…</p>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-wash" />
          ))}
        </div>
      )}

      {data && (
        <div className="grid lg:grid-cols-[3fr_2fr]">
          <ol className="divide-y divide-line">
            {data.checks.map((c) => {
              const st = STATUS[c.status];
              const expanded = open === c.step;
              return (
                <li key={c.step}>
                  <button
                    onClick={() => setOpen(expanded ? null : c.step)}
                    aria-expanded={expanded}
                    disabled={!c.detail}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors enabled:hover:bg-wash"
                  >
                    <span className={clsx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", st.cls)} title={st.label}>
                      <st.Icon className="h-3 w-3" aria-label={st.label} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-xs text-ink-3">
                        {c.step}. {c.title}
                      </span>
                      <span className="block text-sm text-ink">{c.summary}</span>
                      {expanded && <span className="mt-1 block text-xs leading-relaxed text-ink-2">{c.detail}</span>}
                    </span>
                    {c.detail && <ChevronDown className={clsx("mt-1 h-4 w-4 shrink-0 text-ink-3 transition-transform", expanded && "rotate-180")} />}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="border-t border-line p-4 lg:border-l lg:border-t-0">
            <div className={clsx("rounded-xl border px-4 py-3", VERDICT[data.verdict].cls)}>
              <p className="text-base font-semibold">{VERDICT[data.verdict].text}</p>
              <p className="tabular mt-0.5 text-xs">
                {data.counts.pass} pass · {data.counts.warn} warning{data.counts.warn === 1 ? "" : "s"} · {data.counts.fail} fail
              </p>
              {data.fails.length > 0 && <p className="mt-1.5 text-xs">Failed: {data.fails.join(", ")}</p>}
              {data.verdict !== "Skip" && (
                <p className="mt-1.5 text-xs text-ink-3">
                  These are common trading rules, not a tested buy signal: breakouts that met most of them hit a 2:1 target only about
                  1 time in 4, and lost a little on average.
                </p>
              )}
            </div>

            {data.plan.valid === false ? (
              <div className="mt-4 rounded-lg border border-line bg-wash px-3 py-2.5 text-sm">
                <p className="font-medium">No trade plan at this price</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-2">{data.plan.note}</p>
              </div>
            ) : (
              <>
                <dl className="tabular mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-ink-3">{data.side === "long" ? "Buy" : "Short"} at</dt>
                  <dd className="text-right font-medium">{price(data.plan.entry, market)}</dd>
                  <dt className="text-ink-3">Stop-loss</dt>
                  <dd className="text-right text-down">{price(data.plan.stop, market)}</dd>
                  <dt className="text-ink-3">Target</dt>
                  <dd className="text-right text-up">{price(data.plan.target, market)}</dd>
                  <dt className="text-ink-3">Risk:reward</dt>
                  <dd className={clsx("text-right font-medium", data.plan.rr >= 2 ? "text-up" : "text-down")}>1:{data.plan.rr.toFixed(1)}</dd>
                  <dt className="text-ink-3">Size (risking {money(risk, market)})</dt>
                  <dd className="text-right">{shares.toLocaleString()} shares</dd>
                  <dt className="text-ink-3">Position value</dt>
                  <dd className="text-right">{money(shares * data.plan.entry, market)}</dd>
                </dl>
                <p className="mt-2 text-[11px] text-ink-3">The risk amount comes from the position-size calculator in Expected move.</p>
              </>
            )}

            <button
              onClick={copy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
            >
              <ClipboardCopy className="h-4 w-4" />
              {copied === "copied" ? "Copied: paste it into your journal" : copied === "saved" ? "Saved as a text file" : "Copy trade plan"}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
              Thresholds are common trading rules, applied automatically. They keep you disciplined; they don&apos;t predict the
              price. Check anything that matters to you yourself.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
