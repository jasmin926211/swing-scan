import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, Lock, Scale, ShieldCheck, UserCheck } from "lucide-react";
import { InfoCard, PageHero, Section, Stat, pct } from "@/components/marketing";
import { COVERAGE, TESTED } from "@/lib/site";

export const metadata: Metadata = {
  title: "About us — CandleTrade",
  description: "What CandleTrade is, how we test every signal before showing it, what passed and failed, and which markets we cover.",
};

const HOW_WE_TEST = [
  {
    title: "Only what was known then",
    body: "Each method is run over 10 years of past data, and every decision uses only the prices available on that day. No peeking at the future.",
  },
  {
    title: "Against random entries, after costs",
    body: "Trades pay brokerage, taxes and slippage, and are compared with entering at random on the same stocks and days. Beating the market's drift isn't enough.",
  },
  {
    title: "Twice, on separate years",
    body: "A method must work in the earlier years and again in the later ones, on hundreds of trades. One good stretch is usually luck.",
  },
];

const PRINCIPLES = [
  { icon: Scale, title: "Tested, or labelled a fact", body: "A signal is shown as one only after it passes our tests. Everything else is shown as a plain fact, and what failed is removed, not dressed up." },
  { icon: UserCheck, title: "Your decision, your risk", body: "CandleTrade gives tested evidence and context. It never places trades and never tells you what to buy." },
  { icon: Lock, title: "Privacy by default", body: "Passwords are stored only as strong one-way hashes, sessions use secure cookies, and we don’t sell your data." },
  { icon: Eye, title: "Prices only", body: "The Upstox connection is used only to read Indian F&O prices. CandleTrade has no feature that places, changes or cancels orders, or moves funds." },
];

export default function About() {
  return (
    <main>
      <PageHero
        eyebrow="About us"
        title="We test trading signals before we show them."
        intro="CandleTrade brings live prices for every Indian and US stock together with the few signals that held up on 10 years of data, and says plainly which numbers are tested and which are only facts."
      />

      <Section eyebrow="What we do" title="From a live quote to a decision you can check">
        <div className="grid gap-8 text-ink-2 lg:grid-cols-2">
          <p className="leading-relaxed">
            Most trading sites show indicators and patterns as if they worked. We test them first. Of {TESTED.patternSetups}+ popular
            chart and candlestick setups, {TESTED.patternsPassed} beat random entries after costs in both halves of 10 years; only those
            are marked on the charts. Stocks in the top 20% by momentum beat the average stock over the following months. The rest of
            the site is labelled as facts: trend, breadth, volume, fundamentals, open interest.
          </p>
          <p className="leading-relaxed">
            Around that sits what a swing or F&amp;O trader checks daily: live prices for 11,000+ stocks across NSE, BSE, NYSE,
            Nasdaq and AMEX, candlestick charts on three timeframes, the Expected move (how far a stock normally moves), Market
            Pulse, and option chains with open interest, implied volatility and defined-risk trade ideas valued at the option
            market&apos;s own prices.
          </p>
        </div>
      </Section>

      <Section id="research" eyebrow="Research" title="How we test">
        <div className="grid gap-4 md:grid-cols-3">
          {HOW_WE_TEST.map((s, i) => (
            <div key={s.title} className="rounded-xl border border-line p-6">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">{i + 1}</span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat value={`${TESTED.patternsPassed} of ${TESTED.patternSetups}+`} label="Pattern setups that passed" note="Daily, weekly and monthly; India and USA" />
          <Stat value={`+${pct(TESTED.momentumEdgeQuarter, 1)}`} label="Top-20% momentum vs the average stock" note="Next 3 months, after costs" />
          <Stat value={pct(TESTED.expectedMoveCoverage)} label="Moves inside the Expected move" note="On stocks the method hadn’t seen" />
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="font-semibold">What failed, and was removed</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Buying breakouts with a stop and a 2:1 target lost money over {TESTED.breakoutTrades.toLocaleString()} trades. Heavy buying
              volume was followed by slightly worse returns, the next day and later. None of 108 intraday (15-minute) pattern setups
              passed. An AI price-forecasting model, tested on thousands of past forecasts for stocks it hadn&apos;t seen, called
              direction no better than a coin flip, and a simple volatility formula estimated the size of moves better. We showed
              that AI for a while and took it off the site.
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            {[
              ["Tested points marked", "At a glance puts a point for or against a stock only if it was tested."],
              ["Facts stay facts", "Trend, volume, open interest and fundamentals are shown without a buy or sell label."],
              ["No made-up edge in F&O", "Trade ideas show what the option market’s own prices imply, which is no edge either way."],
              ["Every result kept", "Passes and failures go in our research log, so nothing is retried blind."],
            ].map(([t, b]) => (
              <li key={t} className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-up" />
                <span>
                  <span className="font-medium">{t}.</span> <span className="text-ink-2">{b}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-8 grid gap-4 text-sm md:grid-cols-3">
          <InfoCard title="Data you can trace">
            Prices from Yahoo Finance, refreshed every 15–20 seconds during market hours. Indian hourly candles and F&amp;O from
            Upstox. Stock lists from NSE, BSE and Nasdaq.
          </InfoCard>
          <InfoCard title="Completed candles only">
            Signals are read from finished bars; today&apos;s still-forming candle is left out, so they don&apos;t flicker on intraday noise.
          </InfoCard>
          <InfoCard title="Analysis only, by design">
            CandleTrade never places orders: the broker connection is used only to read prices, and your password is stored only as a strong hash.
          </InfoCard>
        </div>
      </Section>

      {/* Supported markets */}
      <Section id="coverage" eyebrow="Supported markets" title="Two markets, every listed stock">
        <div className="grid gap-4 md:grid-cols-2">
          {Object.values(COVERAGE).map((m) => (
            <div key={m.name} className="rounded-xl border border-line p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold">{m.name}</h3>
                <span className="text-sm text-ink-3">{m.exchanges}</span>
              </div>
              <p className="tabular mt-4 text-3xl font-semibold tracking-tight">{m.stocks}</p>
              <p className="text-sm text-ink-2">stocks with live prices</p>
              <dl className="mt-5 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-3">Indices</dt>
                  <dd className="mt-0.5">{m.indices.join(" · ")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">Derivatives</dt>
                  <dd className="mt-0.5 text-ink-2">{m.fno}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">Charts</dt>
                  <dd className="mt-0.5 text-ink-2">Hourly, daily and weekly candles with tested patterns marked</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Our principles" title="What we will and won’t do">
        <div className="grid gap-4 sm:grid-cols-2">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4 rounded-xl border border-line p-6">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-wash px-8 py-10 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Questions, ideas or a bug to report?</h2>
            <p className="mt-2 text-sm text-ink-2">We read every message.</p>
          </div>
          <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-paper hover:opacity-90">
            Contact us <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
