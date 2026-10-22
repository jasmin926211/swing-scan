import Link from "next/link";
import { Activity, ArrowRight, CandlestickChart, Check, ChevronDown, FlaskConical, Layers } from "lucide-react";
import { HeroArt } from "@/components/home/HeroArt";
import { MarketSnapshot } from "@/components/home/MarketSnapshot";
import { Section, Stat, pct } from "@/components/marketing";
import { TESTED } from "@/lib/site";

const FEATURES = [
  {
    icon: CandlestickChart,
    title: "Every listed stock, live",
    body: "All NSE and BSE equities and every NYSE, Nasdaq and AMEX stock, refreshed every 15 seconds while markets are open. Search, sort, and filter by sector, exchange or F&O.",
  },
  {
    icon: FlaskConical,
    title: "Only patterns that passed a 10-year test",
    body: `We tested ${TESTED.patternSetups}+ chart and candlestick setups on 10 years of data, against random entries and after costs. ${TESTED.patternsPassed} passed, and only those are marked on the charts, each with its own record.`,
  },
  {
    icon: Activity,
    title: "Market Pulse",
    body: "Breadth, sectors, momentum leaders and where heavy buying or selling is happening right now. The momentum rating is tested; everything else is labelled as a fact, not a signal.",
  },
  {
    icon: Layers,
    title: "F&O with defined risk",
    body: "Option chains with OI, IV and max pain for NSE indices, F&O stocks and US options. Trade ideas show their payoff and what the option market’s own prices imply, with no made-up edge.",
  },
];

const STEPS = [
  { title: "Find a stock", body: "Browse the live market, the Pulse page or search any of 11,000+ Indian and US stocks." },
  { title: "Read the facts", body: "At a glance shows what was tested for and against, and the facts to check before a trade." },
  { title: "Know the normal move", body: "The Expected move shows how far the stock usually moves, so a stop isn’t inside ordinary noise." },
  { title: "Decide with your plan", body: "You choose the trade, the stop and the size. CandleTrade never places orders." },
];

const IDEAS = [
  {
    title: "Most signals don’t work",
    body: `Of ${TESTED.patternSetups}+ popular setups we tested, ${TESTED.patternsPassed} beat random entries after costs. Treat any untested signal, here or elsewhere, as a coin flip until proven otherwise.`,
  },
  {
    title: "Risk 1–2% per trade",
    body: "Decide your stop-loss before you enter, and size the position so that hitting it costs no more than 1–2% of your capital.",
  },
  {
    title: "A good recent record isn’t an edge",
    body: "Whatever looked right on a stock lately usually reverts to average. Judge a method on thousands of past trades, not the last ten.",
  },
  {
    title: "Stick to liquid stocks",
    body: "Thinly traded stocks gap and trade with wide spreads, so your fills are worse and exits are harder.",
  },
  {
    title: "Costs decide short trades",
    body: "Intraday, fees, taxes and slippage take 0.05–0.1% a round trip, often a third of a typical 15-minute move. Longer holds give an edge more room.",
  },
  {
    title: "Prefer defined risk",
    body: "Spreads cap what you can lose. Selling naked options can lose many times what it earns, on a single bad day.",
  },
];

const FAQ = [
  {
    q: "Will CandleTrade tell me when a stock is going up?",
    a: "Only where a method has proved itself in testing, and very few have. Stocks in the top 20% by momentum beat the average stock over the next months in 10 years of tests, and a small set of chart patterns passed; those are marked as tested. We also tested an AI price-forecasting model on thousands of past forecasts: its up / down view was right about half the time, no better than a coin flip, so we removed it rather than show calls that would often be wrong.",
  },
  {
    q: "What does “tested” mean here?",
    a: "A method is run on 10 years of past data using only what was known at each date, after trading costs, and compared with entering at random on the same stocks and days. It must be profitable and beat random entries in the earlier years and again in the later years, on hundreds of trades. Every result, including the many failures, is kept in our research log.",
  },
  {
    q: "Are prices real-time? Can I scalp with them?",
    a: "Close to real-time, not tick-by-tick. During market hours stock prices refresh about every 20 seconds, so a price can be up to about a minute old; BSE prices from our data source can lag by 15 minutes. That works for swing and positional decisions, not for scalping: always check the live price in your broker before placing an order.",
  },
  {
    q: "How should I use the Expected move?",
    a: "To size stops and targets realistically. It shows the range a stock normally stays within over 1 day, 1 week and 2 weeks, from its recent daily ranges; in testing about 80% of moves stayed inside. A stop inside that range is likely to be hit by ordinary noise.",
  },
  {
    q: "How should I use the F&O trade ideas?",
    a: "As a map of defined-risk trades, valued at expiry and per lot. The chance of profit shown is what the option market’s own prices imply, not a prediction: on average no idea has an edge over another before costs. Before trading, check the option’s volume, open interest and bid-ask spread, the lot size and your broker’s margin, and remember the values assume you hold until expiry.",
  },
  {
    q: "Can I place trades from CandleTrade?",
    a: "No, and that is deliberate. CandleTrade is for analysis: it never places, modifies or cancels orders. The Upstox connection is used only to read Indian F&O prices. You place every trade yourself in your broker’s app, and the decision and the risk stay with you.",
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 md:px-6 lg:grid-cols-2 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Tested tools · India &amp; USA
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            Live markets, and only the signals that survived a 10-year test.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            CandleTrade puts live prices for 11,000+ Indian and US stocks next to tools we have tested on 10 years of data. What
            passed is marked as tested; what didn&apos;t, including our own AI forecasts, was removed instead of dressed up.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-paper hover:opacity-90">
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="#market" className="rounded-lg border border-line px-5 py-3 text-sm font-medium hover:bg-wash">
              See today’s market
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            {["Never places trades", "Every signal tested first", "NSE, BSE, NYSE & Nasdaq"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-up" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <HeroArt />
      </section>

      {/* Live market (public) */}
      <Section id="market" eyebrow="Live market" title="Today’s market at a glance" intro="Headline indices, the largest stocks and the day’s biggest movers. Free for everyone.">
        <MarketSnapshot />
      </Section>

      {/* Features */}
      <Section id="features" eyebrow="What you get" title="Facts and tested signals, nothing dressed up" intro="Every number is either a plain fact or a result that held up in testing, and it says which.">
        <div className="grid gap-4 md:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-line p-6">
              <Icon className="h-5 w-5 text-accent" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
        <ol className="mt-10 grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">{i + 1}</span>
              <h4 className="mt-3 text-sm font-semibold">{s.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Trading ideas */}
      <Section id="ideas" eyebrow="Trading with CandleTrade" title="Six habits that matter more than any signal" intro="What 10 years of testing taught us about trading.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {IDEAS.map((idea, i) => (
            <div key={idea.title} className="rounded-xl bg-wash p-6">
              <p className="tabular text-xs font-semibold text-ink-3">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 font-semibold">{idea.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{idea.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* What we tested */}
      <Section
        id="tested"
        eyebrow="Research"
        title="We test before we show"
        intro="Each method was run on 10 years of past data, after costs, against random entries on the same stocks and days, and had to hold up in the earlier and the later years."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat value={`${TESTED.patternsPassed} of ${TESTED.patternSetups}+`} label="Pattern setups that passed" note="Only these are marked on the charts" />
          <Stat value={`+${pct(TESTED.momentumEdgeQuarter, 1)}`} label="Top-20% momentum vs the average stock" note="Next 3 months, after costs, India and USA" />
          <Stat value={pct(TESTED.expectedMoveCoverage)} label="Moves inside the Expected move" note="Tested on stocks the method hadn’t seen" />
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-ink-2">
          What failed is listed too: breakout buying lost money over {TESTED.breakoutTrades.toLocaleString()} trades, heavy-volume buying
          and most intraday setups didn&apos;t beat random entries, and an AI forecasting model called direction no better than a coin flip.
          None of them is shown as a signal.
        </p>
        <Link href="/about#research" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
          How we test <ArrowRight className="h-4 w-4" />
        </Link>
      </Section>

      {/* FAQ */}
      <Section id="faq" eyebrow="FAQ" title="Questions traders ask">
        <div className="divide-y divide-line rounded-xl border border-line">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {q}
                <ChevronDown className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* Final call to action */}
      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-ink px-8 py-10 text-paper md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Trade on what&apos;s been tested.</h2>
            <p className="mt-2 text-sm text-paper/70">Free account. Every stock live, with the tested signals and the facts.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/signup" className="rounded-lg bg-paper px-5 py-3 text-sm font-medium text-ink hover:opacity-90">
              Create account
            </Link>
            <Link href="/signin" className="rounded-lg border border-paper/25 px-5 py-3 text-sm font-medium text-paper hover:bg-paper/10">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
