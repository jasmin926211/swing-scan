"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight, ListChecks } from "lucide-react";
import { getChecklist, type Checklist, type MarketId, type TradeSide } from "@/lib/api";
import { MARKETS, price } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { StockLogo } from "@/components/StockLogo";
import { VERDICT } from "@/components/TradeChecklist";

const MAX = 25;
const PARALLEL = 3;
const ORDER: Record<Checklist["verdict"], number> = { Passes: 0, Caution: 1, Skip: 2 };
const EXAMPLE: Record<MarketId, string> = { in: "RELIANCE, BEL, TCS, HDFCBANK", us: "AAPL, NVDA, MSFT, JPM" };

type Row = { symbol: string; result?: Checklist; error?: string };

function parse(text: string): string[] {
  return [...new Set(text.toUpperCase().split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))].slice(0, MAX);
}

/** Run the 15-step checklist on several stocks at once and see which ones are worth a closer look. */
export default function ChecklistPage() {
  const { market } = useMarket();
  const [text, setText] = useState("");
  const [side, setSide] = useState<TradeSide>("long");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const run = useRef(0);

  // The list is remembered per market, in this browser.
  useEffect(() => {
    try {
      setText(localStorage.getItem(`ct.checklist.${market}`) ?? "");
    } catch {}
    setRows([]);
  }, [market]);

  async function start() {
    const symbols = parse(text);
    if (!symbols.length) return;
    try {
      localStorage.setItem(`ct.checklist.${market}`, symbols.join(", "));
    } catch {}
    const id = ++run.current;
    setRunning(true);
    setRows(symbols.map((symbol) => ({ symbol })));
    let next = 0;
    async function worker() {
      while (next < symbols.length && run.current === id) {
        const symbol = symbols[next++];
        let row: Row;
        try {
          row = { symbol, result: await getChecklist(market, symbol, side) };
        } catch (e) {
          row = { symbol, error: e instanceof Error ? e.message : "Failed" };
        }
        if (run.current === id) setRows((rs) => rs.map((r) => (r.symbol === symbol ? row : r)));
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    if (run.current === id) setRunning(false);
  }

  const done = rows.filter((r) => r.result || r.error).length;
  const sorted = [...rows].sort((a, b) => {
    if (!a.result || !b.result) return a.result ? -1 : b.result ? 1 : 0;
    return ORDER[a.result.verdict] - ORDER[b.result.verdict] || a.result.counts.fail - b.result.counts.fail || b.result.counts.pass - a.result.counts.pass;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ListChecks className="h-5 w-5" /> Trade checklist · {MARKETS[market].name}
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Paste the stocks you&apos;re considering. Each one goes through the same 15 steps (market, sector, liquidity, news,
          fundamentals, trend, levels, volume, indicators, entry, stop, risk:reward, size, costs), and the ones that pass come first.
        </p>
      </div>

      <section className="rounded-xl border border-line p-4">
        <label htmlFor="symbols" className="text-xs text-ink-3">
          Symbols (up to {MAX}, separated by commas or spaces)
        </label>
        <textarea
          id="symbols"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE[market]}
          className="mt-1 w-full resize-y rounded-lg border border-line bg-paper px-3 py-2 text-sm uppercase text-ink outline-none placeholder:normal-case focus:border-ink-3"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Trade direction" className="flex rounded-lg border border-line p-0.5 text-sm">
            {(["long", "short"] as const).map((s) => (
              <button key={s} role="radio" aria-checked={side === s} onClick={() => setSide(s)}
                className={clsx("rounded-md px-3 py-1 transition-colors", side === s ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}>
                {s === "long" ? "Buy" : "Short"}
              </button>
            ))}
          </div>
          <button
            onClick={start}
            disabled={running || parse(text).length === 0}
            className="rounded-lg bg-ink px-4 py-1.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {running ? `Checking ${done} of ${rows.length}…` : `Check ${parse(text).length || ""} stock${parse(text).length === 1 ? "" : "s"}`}
          </button>
          {!running && rows.length > 0 && (
            <span className="text-xs text-ink-3">
              {rows.filter((r) => r.result?.verdict === "Passes").length} pass · {rows.filter((r) => r.result?.verdict === "Caution").length} caution ·{" "}
              {rows.filter((r) => r.result?.verdict === "Skip").length} skip
            </span>
          )}
        </div>
      </section>

      {rows.length > 0 && (
        <section className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-3">
              <tr className="text-left">
                <th className="px-3 py-2.5 font-normal">Stock</th>
                <th className="px-3 py-2.5 font-normal">Verdict</th>
                <th className="hidden px-3 py-2.5 font-normal md:table-cell">Failed steps</th>
                <th className="px-3 py-2.5 text-right font-normal">R:R</th>
                <th className="hidden px-3 py-2.5 text-right font-normal sm:table-cell">Entry · Stop · Target</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.symbol} className="border-t border-line">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="hidden sm:block">
                        <StockLogo market={market} symbol={r.symbol} size={28} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">{r.symbol}</p>
                        <p className="max-w-[160px] truncate text-xs text-ink-3">{r.result?.name ?? ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.result ? (
                      <span className={clsx("inline-flex flex-col rounded-lg border px-2 py-1 text-xs", VERDICT[r.result.verdict].cls)}>
                        <span className="font-semibold">{r.result.verdict}</span>
                        <span className="tabular">
                          {r.result.counts.pass}✓ {r.result.counts.warn}! {r.result.counts.fail}✗
                        </span>
                      </span>
                    ) : r.error ? (
                      <span className="text-xs text-down">{r.error}</span>
                    ) : (
                      <span className="inline-block h-8 w-20 animate-pulse rounded-lg bg-wash" />
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs text-ink-2 md:table-cell">{r.result ? r.result.fails.join(", ") || "—" : ""}</td>
                  <td className={clsx("tabular px-3 py-2.5 text-right", r.result && (r.result.plan.rr >= 2 ? "text-up" : "text-down"))}>
                    {r.result ? `1:${r.result.plan.rr.toFixed(1)}` : ""}
                  </td>
                  <td className="tabular hidden px-3 py-2.5 text-right text-xs text-ink-2 sm:table-cell">
                    {r.result && `${price(r.result.plan.entry, market)} · ${price(r.result.plan.stop, market)} · ${price(r.result.plan.target, market)}`}
                  </td>
                  <td className="px-2">
                    {r.result && (
                      <Link href={`/stock/${market}/${encodeURIComponent(r.symbol)}`} aria-label={`Open ${r.symbol}`} className="text-ink-3 hover:text-ink">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-3 py-2.5 text-[11px] text-ink-3">
            Open a stock for its full checklist, trade plan and &ldquo;Copy trade plan&rdquo;. The rules keep you disciplined; they
            don&apos;t predict the price.
          </p>
        </section>
      )}
    </div>
  );
}
