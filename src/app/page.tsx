import Link from "next/link";
import { ArrowRight, CandlestickChart, Check, ChevronDown, Layers, Sparkles, Target } from "lucide-react";
import { HeroArt } from "@/components/home/HeroArt";
import { MarketSnapshot } from "@/components/home/MarketSnapshot";
import { Section, Stat, pct } from "@/components/marketing";
import { ACCURACY } from "@/lib/site";

const FEATURES = [
  {
    icon: CandlestickChart,
    title: "Every listed stock, live",
    body: "All NSE and BSE equities and every NYSE, Nasdaq and AMEX stock, refreshed every 15 seconds while markets are open. Search, sort, and filter by sector, exchange or F&O.",
  },
  {
    icon: Sparkles,
    title: "AI forecasts in seconds",
    body: "Pick a stock and CandleTrade AI samples dozens of possible futures from its recent candles: a likely price range, tested on stocks it hadn’t seen, drawn right on the chart.",
  },
  {
    icon: Target,
    title: "A track record for every stock",
    body: "Before you trust a forecast, CandleTrade replays its AI on that stock’s recent past and shows how often it was right. Low-trust forecasts are flagged in red.",
  },
  {
    icon: Layers,
    title: "F&O planning with defined risk",
    body: "Option chains with OI, IV and max pain for NSE indices, F&O stocks and US options. Trade ideas are scored on the AI’s paths and on the market’s own implied volatility.",
  },
];

const STEPS = [
  { title: "Find a stock", body: "Browse the live market or search any of 11,000+ Indian and US stocks." },
  { title: "Run the AI forecast", body: "Get a forecast from daily, hourly or weekly candles in about 10 seconds." },
  { title: "Check the record", body: "See how the AI did on that same stock before acting on it." },
  { title: "Decide with your plan", body: "Use the range and the odds to size the trade and place your stop." },
];

const IDEAS = [
  {
    title: "Direction is close to a coin flip",
    body: "In our tests on stocks the AI hadn’t seen, its up / down view was right about half the time, so we don’t show it as a call. Plan with ranges and stops, and size every trade so being wrong is affordable.",
  },
  {
    title: "Risk 1–2% per trade",
    body: "Decide your stop-loss before you enter, and size the position so that hitting it costs no more than 1–2% of your capital.",
  },
  {
    title: "Trust the record, not the headline",
    body: "If the AI hasn’t beaten “price stays flat” on a stock lately, treat its forecast as noise, however confident it looks.",
  },
  {
    title: "Stick to liquid stocks",
    body: "Thinly traded stocks gap and trade with wide spreads. Forecasts and your fills are both worse there.",
  },
  {
    title: "Let the market check your view",
    body: "When the AI and the option market’s implied volatility disagree sharply, the market is usually the better calibrated of the two.",
  },
  {
    title: "Prefer defined risk",
    body: "Spreads cap what you can lose. Selling naked options can lose many times what it earns, on a single bad day.",
  },
];

const FAQ = [
  {
    q: "Will the AI tell me when a stock is going up?",
    a: "Only when that has proved reliable, and so far it hasn’t. We tested the AI’s up / down view on thousands of past forecasts for stocks it hadn’t seen: even when most of its paths pointed up, those stocks closed higher only about half the time. So the site shows “No reliable direction” instead of a buy or sell call that would often be wrong. The forecast’s price range is reliable (it held the actual price about 84% of the time), so use it, the Expected move and the trade checklist to plan entry, stop-loss and size.",
  },
  {
    q: "Which timeframe should I use for swing or intraday trading?",
    a: "Use daily candles for swing trades of a few days to a few weeks; that is where the AI has been tested most (1 to 10 trading days ahead). Hourly candles suit short-term views over the next one or two sessions, and weekly candles suit positional trades. Hourly and weekly forecasts haven’t been tested as thoroughly, so lean harder on the per-stock track record there.",
  },
  {
    q: "Are prices real-time? Can I scalp with them?",
    a: "Close to real-time, not tick-by-tick. During market hours stock prices refresh about every 20 seconds and the page updates every 30, so a price can be up to about a minute old (Yahoo itself may add a few seconds). Indian option chains refresh every 30 seconds. That works for swing and positional decisions, not for scalping: always check the live price in your broker before placing an order.",
  },
  {
    q: "Does the AI know about results, news or RBI / Fed decisions?",
    a: "No. The AI only reads price and volume candles. It doesn’t know about upcoming earnings, dividends, splits, budget announcements, rate decisions or company news, so it can’t predict the gap those cause. Be most careful around result dates and big economic events, when a forecast built on recent candles matters least.",
  },
  {
    q: "Which stocks does it work best on?",
    a: "Large, liquid stocks and indices. Thinly traded stocks gap more and trade with wide spreads, so both the forecast and your fill are worse. The Markets page shows the day’s value traded for every stock, and the top gainers and losers only include liquid names.",
  },
  {
    q: "How should I use the F&O trade ideas?",
    a: "As a starting point for defined-risk trades, valued at expiry and per lot. Each idea shows its chance of profit twice: on the AI’s paths and on the option market’s implied volatility. Trust an idea more when both agree; the AI tends to overrate selling options. Before trading, check the option’s volume, open interest and bid-ask spread, the lot size and your broker’s margin, and remember the values assume you hold until expiry.",
  },
  {
    q: "Can I place trades from CandleTrade?",
    a: "No, and that is deliberate. CandleTrade is for analysis: it never places, modifies or cancels orders. The Upstox connection is used only to read Indian F&O prices; CandleTrade has no feature that places or changes orders. You place every trade yourself in your broker’s app, and the decision and the risk stay with you.",
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 md:px-6 lg:grid-cols-2 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> AI forecasts · India &amp; USA
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            Read the market candle by candle, and see how often the forecast was right.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            CandleTrade puts live prices for 11,000+ Indian and US stocks next to CandleTrade AI, a forecasting model trained on
            years of candlestick data. Every forecast comes with its own track record, so you know when to trust it.
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
            {["Never places trades", "Honest accuracy numbers", "NSE, BSE, NYSE & Nasdaq"].map((t) => (
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
      <Section id="features" eyebrow="What you get" title="Everything you need to judge a forecast" intro="Not just a prediction: the context to decide how much it’s worth.">
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
      <Section id="ideas" eyebrow="Trading with CandleTrade" title="Six habits that matter more than any forecast" intro="CandleTrade gives you odds. These keep you in the game when the odds go against you.">
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

      {/* Accuracy at a glance */}
      <Section
        id="accuracy"
        eyebrow="Accuracy"
        title="Honest numbers, not hype"
        intro={`Tested the strict way: forecasting from past dates with only the data available then. ${ACCURACY.forecasts} forecasts on ${ACCURACY.stocks} Indian and US stocks, large and small, ${ACCURACY.horizonDays} trading days ahead.`}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat value={pct(ACCURACY.directionRight)} label="Direction called right" note={`A coin flip gets 50%; 1 day ahead: ${pct(ACCURACY.shortTermDirection)}`} />
          <Stat value={pct(ACCURACY.avgError)} label={`Average price error after ${ACCURACY.horizonDays} days`} note={`Assuming “no change”: ${pct(ACCURACY.noChangeError)}`} />
          <Stat value={String(ACCURACY.forecasts)} label="Walk-forward forecasts" note="No peeking at the future" />
        </div>
        <Link href="/about#accuracy" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
          How we test and what we do about the weak spots <ArrowRight className="h-4 w-4" />
        </Link>
      </Section>

      {/* FAQ */}
      <Section id="faq" eyebrow="FAQ" title="Questions traders ask before they trust a forecast">
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
            <h2 className="text-2xl font-semibold tracking-tight">Start reading the market with better odds.</h2>
            <p className="mt-2 text-sm text-paper/70">Free account. Every stock, every forecast, with its track record.</p>
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
