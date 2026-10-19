"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ExternalLink, FileText, Newspaper, X } from "lucide-react";
import { getFilings, getNews, type Filing, type MarketId, type NewsFeed, type NewsItem, type Sentiment, type StockFilings, type StockNews } from "@/lib/api";

const SENTIMENT: Record<Sentiment, { label: string; mark: string; chip: string; bar: string }> = {
  positive: { label: "Positive", mark: "▲", chip: "bg-up-wash text-up", bar: "bg-up" },
  neutral: { label: "Neutral", mark: "●", chip: "bg-wash text-ink-2", bar: "bg-ink-3" },
  negative: { label: "Negative", mark: "▼", chip: "bg-down-wash text-down", bar: "bg-down" },
};
const ORDER: Sentiment[] = ["positive", "neutral", "negative"];

/** "Latest news" button for a stock page; opens a dialog with two weeks of headlines and their sentiment. */
export function NewsButton({ market, symbol, name }: { market: MarketId; symbol: string; name?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
      >
        <Newspaper className="h-4 w-4" /> Latest news
      </button>
      {open && <NewsDialog market={market} symbol={symbol} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewsDialog({ market, symbol, name, onClose }: { market: MarketId; symbol: string; name?: string | null; onClose: () => void }) {
  const [data, setData] = useState<StockNews | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"company" | "market" | "filings">("company");
  // Exchange filings (Indian stocks only) load the first time their tab opens.
  const [filings, setFilings] = useState<StockFilings | null>(null);
  const [filingsError, setFilingsError] = useState<string | null>(null);
  const tabs = market === "in" ? (["company", "market", "filings"] as const) : (["company", "market"] as const);

  useEffect(() => {
    if (tab !== "filings" || filings || filingsError) return;
    getFilings(market, symbol)
      .then(setFilings)
      .catch((e) => setFilingsError(e instanceof Error ? e.message : "Exchange filings are unavailable right now"));
  }, [tab, market, symbol, filings, filingsError]);
  const [filter, setFilter] = useState<Sentiment | "all">("all");
  const [shown, setShown] = useState(false); // drives the enter animation
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    getNews(market, symbol)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load news"));
    return () => {
      alive = false;
    };
  }, [market, symbol]);

  // Open animation, Escape to close, focus inside, and no page scrolling behind the dialog.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  function close() {
    setShown(false);
    window.setTimeout(onClose, 180);
  }

  const feed: NewsFeed | null = data && tab !== "filings" ? data[tab] : null;
  const items = feed ? feed.items.filter((i) => filter === "all" || i.sentiment === filter) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="news-title">
      <div className={clsx("absolute inset-0 bg-black/45 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")} onClick={close} />
      <div
        className={clsx(
          "relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-line bg-paper shadow-xl transition-all duration-200 sm:rounded-2xl",
          shown ? "translate-y-0 opacity-100 sm:scale-100" : "translate-y-4 opacity-0 sm:scale-[0.98]",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="news-title" className="text-base font-semibold">Latest news · {symbol}</h2>
            <p className="mt-0.5 truncate text-xs text-ink-3">
              {name ? `${name} · ` : ""}last {data?.days ?? 14} days · sentiment read by {data?.model ?? "FinBERT"}
            </p>
          </div>
          <button ref={closeRef} onClick={close} aria-label="Close" className="rounded-lg p-1.5 text-ink-2 hover:bg-wash hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-line px-5 text-sm">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setFilter("all");
              }}
              className={clsx("-mb-px border-b-2 px-2.5 py-2.5 transition-colors", tab === t ? "border-ink font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink")}
            >
              {t === "company" ? "Company" : t === "filings" ? "Exchange filings" : market === "in" ? "Indian market" : "US market"}
              {t !== "filings" && data && <span className="ml-1.5 text-xs text-ink-3">{data[t].summary.total}</span>}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto overscroll-contain px-5 py-4">
          {tab === "filings" && <Filings data={filings} error={filingsError} />}
          {tab !== "filings" && error && <p className="text-sm text-down">{error}</p>}
          {tab !== "filings" && !data && !error && (
            <div className="space-y-3">
              <p className="text-sm text-ink-2">Reading the latest headlines… the first load can take up to half a minute.</p>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-wash" />
              ))}
            </div>
          )}
          {feed && (
            <>
              <Summary feed={feed} />
              <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
                {(["all", ...ORDER] as const).map((f) => {
                  const n = f === "all" ? feed.summary.total : feed.summary[f];
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      disabled={n === 0}
                      className={clsx(
                        "rounded-full border px-3 py-1 transition-colors disabled:opacity-40",
                        filter === f ? "border-ink bg-ink text-paper" : "border-line text-ink-2 hover:border-ink-3 hover:text-ink",
                      )}
                    >
                      {f === "all" ? "All" : SENTIMENT[f].label} {n}
                    </button>
                  );
                })}
              </div>
              {items.length === 0 ? (
                <p className="mt-6 text-sm text-ink-2">
                  {feed.summary.total === 0 ? "No news found in the last two weeks." : "No headlines with this sentiment."}
                </p>
              ) : (
                <ByDay items={items} />
              )}
            </>
          )}
        </div>

        <p className="border-t border-line px-5 py-3 text-[11px] leading-relaxed text-ink-3">
          {tab === "filings" ? (
            <>
              Official announcements the company filed with {filings?.source ?? "the exchange"}, tagged by type. Open the PDF for the
              details; filings aren&apos;t scored for sentiment because their wording is formulaic.
            </>
          ) : (
            <>
              Sentiment is read from each headline by an automatic model and can misread trader wording (&ldquo;rally&rdquo;,
              &ldquo;upside&rdquo;). It describes the news, it doesn&apos;t predict the price: news is often priced in within minutes.
              Headlines link to their publishers.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function Summary({ feed }: { feed: NewsFeed }) {
  const { summary: s } = feed;
  const tone = s.verdict.startsWith("Mostly positive") ? "text-up" : s.verdict.startsWith("Mostly negative") ? "text-down" : "text-ink";
  return (
    <div className="rounded-xl bg-wash px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={clsx("text-sm font-semibold", tone)}>{s.verdict}</p>
        <p className="tabular text-xs text-ink-3">
          {s.positive} positive · {s.neutral} neutral · {s.negative} negative
        </p>
      </div>
      {s.total > 0 && (
        <div className="mt-2.5 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {ORDER.map((k) => s[k] > 0 && <div key={k} className={clsx("h-full", SENTIMENT[k].bar)} style={{ width: `${(s[k] / s.total) * 100}%` }} />)}
        </div>
      )}
    </div>
  );
}

function dayLabel(ms: number) {
  const d = new Date(ms);
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

function ByDay({ items }: { items: NewsItem[] }) {
  const groups: { label: string; items: NewsItem[] }[] = [];
  for (const it of items) {
    const label = dayLabel(it.published);
    if (groups.at(-1)?.label === label) groups.at(-1)!.items.push(it);
    else groups.push({ label, items: [it] });
  }
  return (
    <div className="mt-4 space-y-5">
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-3">{g.label}</h3>
          <ul className="divide-y divide-line">
            {g.items.map((it) => (
              <Headline key={it.url + it.title} item={it} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Headline({ item }: { item: NewsItem }) {
  const s = SENTIMENT[item.sentiment];
  const time = new Date(item.published).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <li className="py-2.5">
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3">
        <span className={clsx("mt-0.5 inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium", s.chip)}>
          <span aria-hidden>{s.mark}</span> {s.label}
        </span>
        <span className="min-w-0">
          <span className="text-sm leading-snug text-ink group-hover:underline">{item.title}</span>
          <ExternalLink className="ml-1 inline h-3 w-3 text-ink-3" aria-hidden />
          <span className="mt-0.5 block text-xs text-ink-3">
            {item.source} · {time}
            {item.also.length > 0 && ` · also in ${item.also.slice(0, 2).join(", ")}${item.also.length > 2 ? ` +${item.also.length - 2}` : ""}`}
          </span>
        </span>
      </a>
    </li>
  );
}

const IMPORTANT = new Set(["Results", "Dividend", "Order win", "Buyback", "Bonus / split", "Deal", "Fund raising", "Credit rating", "Management", "Legal / regulatory"]);

function Filings({ data, error }: { data: StockFilings | null; error: string | null }) {
  const [showRoutine, setShowRoutine] = useState(false);
  if (error) return <p className="text-sm text-ink-2">{error}</p>;
  if (!data)
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-wash" />
        ))}
      </div>
    );
  const items = data.items.filter((f) => showRoutine || !f.routine);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-wash px-4 py-3 text-sm">
        <p>
          <span className="font-semibold">{data.items.length - data.routine}</span> announcement{data.items.length - data.routine === 1 ? "" : "s"} on{" "}
          {data.source} in the last {data.days} days
        </p>
        {data.routine > 0 && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-2">
            <input type="checkbox" checked={showRoutine} onChange={(e) => setShowRoutine(e.target.checked)} className="accent-ink" />
            Show {data.routine} routine
          </label>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-ink-2">{data.items.length === 0 ? "No filings in the last two weeks." : "Only routine filings in the last two weeks."}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {items.map((f, i) => (
            <FilingRow key={`${f.published}-${i}`} f={f} />
          ))}
        </ul>
      )}
    </>
  );
}

function FilingRow({ f }: { f: Filing }) {
  const when = new Date(f.published).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const body = (
    <>
      <span
        className={clsx(
          "mt-0.5 inline-flex shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium",
          IMPORTANT.has(f.tag) && !f.routine ? "bg-accent-wash text-accent" : "bg-wash text-ink-2",
        )}
      >
        {f.tag}
      </span>
      <span className="min-w-0">
        <span className={clsx("text-sm leading-snug", f.routine ? "text-ink-2" : "text-ink", f.url && "group-hover:underline")}>{f.text}</span>
        {f.url && <FileText className="ml-1 inline h-3 w-3 text-ink-3" aria-label="PDF" />}
        <span className="mt-0.5 block text-xs text-ink-3">
          {f.exchange} · {when}
          {f.type && f.type !== f.text && ` · ${f.type}`}
        </span>
      </span>
    </>
  );
  return (
    <li className="py-2.5">
      {f.url ? (
        <a href={f.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3">
          {body}
        </a>
      ) : (
        <div className="flex items-start gap-3">{body}</div>
      )}
    </li>
  );
}
