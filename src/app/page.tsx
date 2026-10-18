import Link from "next/link";
import { ArrowRight, BarChart3, CandlestickChart, Check, ChevronDown, Layers, ShieldCheck, Sparkles, Target } from "lucide-react";
import { HeroArt } from "@/components/home/HeroArt";
import { MarketSnapshot } from "@/components/home/MarketSnapshot";
import { ACCURACY, COVERAGE } from "@/lib/site";

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

const FEATURES = [
  {
    icon: CandlestickChart,
    title: "Every listed stock, live",
    body: "All NSE and BSE equities and every NYSE, Nasdaq and AMEX stock, refreshed every 15 seconds while markets are open. Search, sort, and filter by sector, exchange or F&O.",
  },
  {
    icon: Sparkles,
    title: "Kronos forecasts in seconds",
    body: "Pick a stock and Kronos samples dozens of possible futures from its recent candles: the median path, a likely range and the chance of closing higher, drawn right on the chart.",
  },
  {
    icon: Target,
    title: "A track record for every stock",
    body: "Before you trust a forecast, CandleTrade replays Kronos on that stock’s recent past and shows how often it was right. Low-trust forecasts are flagged in red.",
  },
  {
    icon: Layers,
    title: "F&O planning with defined risk",
    body: "Option chains with OI, IV and max pain for NSE indices, F&O stocks and US options. Trade ideas are scored on Kronos’ paths and on the market’s own implied volatility.",
  },
];

const STEPS = [
  { title: "Find a stock", body: "Browse the live market or search any of 11,000+ Indian and US stocks." },
  { title: "Run Kronos", body: "Get a forecast from daily, hourly or weekly candles in about 10 seconds." },
  { title: "Check the record", body: "See how Kronos did on that same stock before acting on it." },
  { title: "Decide with your plan", body: "Use the range and the odds to size the trade and place your stop." },
];

const IDEAS = [
  {
    title: "Forecasts are probabilities",
    body: "A 65% chance of closing higher still means it won’t, about one time in three. Size every trade so being wrong is affordable.",
  },
  {
    title: "Risk 1–2% per trade",
    body: "Decide your stop-loss before you enter, and size the position so that hitting it costs no more than 1–2% of your capital.",
  },
  {
    title: "Trust the record, not the headline",
    body: "If Kronos hasn’t beaten “price stays flat” on a stock lately, treat its forecast as noise, however confident it looks.",
  },
  {
    title: "Stick to liquid stocks",
    body: "Thinly traded stocks gap and trade with wide spreads. Forecasts and your fills are both worse there.",
  },
  {
    title: "Let the market check your view",
    body: "When Kronos and the option market’s implied volatility disagree sharply, the market is usually the better calibrated of the two.",
  },
  {
    title: "Prefer defined risk",
    body: "Spreads cap what you can lose. Selling naked options can lose many times what it earns, on a single bad day.",
  },
];

const FAQ = [
  {
    q: "Should I buy just because Kronos says “Bullish”?",
    a: "No. “Bullish” means at least 60% of Kronos’ sampled paths end higher and the average path is up; it is a probability, not a signal to act on alone. Check the trust note under the forecast first, then decide entry, stop-loss and position size from your own plan. If Kronos hasn’t beaten “price stays flat” on that stock recently, the forecast is flagged as low trust.",
  },
  {
    q: "Which timeframe should I use for swing or intraday trading?",
    a: "Use daily candles for swing trades of a few days to a few weeks; that is where Kronos has been tested most (1 to 10 trading days ahead). Hourly candles suit short-term views over the next one or two sessions, and weekly candles suit positional trades. Hourly and weekly forecasts haven’t been tested as thoroughly, so lean harder on the per-stock track record there.",
  },
  {
    q: "Are prices real-time? Can I scalp with them?",
    a: "Close to real-time, not tick-by-tick. During market hours stock prices refresh about every 20 seconds and the page updates every 30, so a price can be up to about a minute old (Yahoo itself may add a few seconds). Indian option chains refresh every 30 seconds. That works for swing and positional decisions, not for scalping: always check the live price in your broker before placing an order.",
  },
  {
    q: "Does Kronos know about results, news or RBI / Fed decisions?",
    a: "No. Kronos only reads price and volume candles. It doesn’t know about upcoming earnings, dividends, splits, budget announcements, rate decisions or company news, so it can’t predict the gap those cause. Be most careful around result dates and big economic events, when a forecast built on recent candles matters least.",
  },
  {
    q: "Which stocks does it work best on?",
    a: "Large, liquid stocks and indices: in our tests Kronos did best on large caps and worst on small stocks in strong trends. Thinly traded stocks also gap more and trade with wide spreads, so both the forecast and your fill are worse. The Markets page shows the day’s value traded for every stock, and the top gainers and losers only include liquid names.",
  },
  {
    q: "How should I use the F&O trade ideas?",
    a: "As a starting point for defined-risk trades, valued at expiry and per lot. Each idea shows its chance of profit twice: on Kronos’ paths and on the option market’s implied volatility. Trust an idea more when both agree; Kronos tends to overrate selling options. Before trading, check the option’s volume, open interest and bid-ask spread, the lot size and your broker’s margin, and remember the values assume you hold until expiry.",
  },
  {
    q: "Can I place trades from CandleTrade?",
    a: "No, and that is deliberate. CandleTrade is for analysis: it never places, modifies or cancels orders. The Upstox connection used for Indian F&O prices is read-only. You place every trade yourself in your broker’s app, and the decision and the risk stay with you.",
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 md:px-6 lg:grid-cols-2 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2a78d6]" /> Kronos AI forecasts · India &amp; USA
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            Read the market candle by candle, and see how often the forecast was right.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            CandleTrade puts live prices for 11,000+ Indian and US stocks next to Kronos, an open AI model trained on
            candlestick data from 45 exchanges. Every forecast comes with its own track record, so you know when to trust it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-white hover:opacity-90">
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
              <Icon className="h-5 w-5 text-[#2a78d6]" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
        <ol className="mt-10 grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span>
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

      {/* Accuracy & reliability */}
      <Section
        id="accuracy"
        eyebrow="Accuracy & reliability"
        title="How good is it, honestly?"
        intro={`We test Kronos the strict way: forecasting from past dates using only the data available then, and comparing with what actually happened. Latest test: ${ACCURACY.forecasts} forecasts on ${ACCURACY.stocks} large US and Indian stocks, ${ACCURACY.horizonDays} trading days ahead (${ACCURACY.testedOn}).`}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value={pct(ACCURACY.directionRight)} label="Direction called right" note="A coin flip gets 50%" />
          <Stat value={pct(ACCURACY.avgError)} label={`Average price error after ${ACCURACY.horizonDays} days`} note={`Assuming “no change”: ${pct(ACCURACY.noChangeError)}`} />
          <Stat value={pct(ACCURACY.rawBandCoverage, 0)} label="Outcomes inside Kronos’ raw 80% range" note="Too narrow, so we widen it" />
          <Stat value={String(ACCURACY.forecasts)} label="Walk-forward forecasts" note="No peeking at the future" />
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="font-semibold">What that means for you</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Kronos has a real but modest edge on direction for large, liquid stocks, and it is overconfident about how
              far prices will move. It is weakest on small stocks in strong trends. No model predicts single stocks
              reliably, so CandleTrade is built to show you when not to trust it.
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            {[
              ["Per-stock track record", "Every forecast is followed by a replay on that stock’s recent past."],
              ["Calibrated ranges", "Kronos’ ranges are widened to match how often prices really landed inside them."],
              ["Low-trust warnings", "Forecasts on stocks where Kronos lost to “no change” are flagged in red."],
              ["Market cross-check", "F&O ideas are also valued on the option market’s implied volatility."],
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
          <Reliability title="Data you can trace">
            Prices from Yahoo Finance, refreshed every 15–20 seconds during market hours. Indian F&amp;O from Upstox. Stock
            lists from NSE, BSE and Nasdaq.
          </Reliability>
          <Reliability title="Completed candles only">
            Kronos only sees finished bars; today’s still-forming candle is left out, so forecasts don’t change on intraday noise.
          </Reliability>
          <Reliability title="Read-only by design">
            CandleTrade never places orders. Broker access is read-only, and your password is stored only as a strong hash.
          </Reliability>
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
                  <dt className="text-xs text-ink-3">Charts &amp; forecasts</dt>
                  <dd className="mt-0.5 text-ink-2">Hourly, daily and weekly candles with Kronos forecasts</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
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
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-ink px-8 py-10 text-white md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Start reading the market with better odds.</h2>
            <p className="mt-2 text-sm text-white/70">Free account. Every stock, every forecast, with its track record.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/signup" className="rounded-lg bg-white px-5 py-3 text-sm font-medium text-ink hover:opacity-90">
              Create account
            </Link>
            <Link href="/signin" className="rounded-lg border border-white/25 px-5 py-3 text-sm font-medium text-white hover:bg-white/10">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 md:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#2a78d6]">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
      {intro && <p className="mt-3 max-w-3xl leading-relaxed text-ink-2">{intro}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Stat({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="rounded-xl border border-line p-5">
      <p className="tabular text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm">{label}</p>
      <p className="mt-1 text-xs text-ink-3">{note}</p>
    </div>
  );
}

function Reliability({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-wash p-5">
      <p className="flex items-center gap-2 font-medium">
        <BarChart3 className="h-4 w-4 text-ink-3" /> {title}
      </p>
      <p className="mt-2 leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}
