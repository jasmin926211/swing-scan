import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, Lock, Scale, ShieldCheck, UserCheck } from "lucide-react";
import { InfoCard, PageHero, Section, Stat, pct } from "@/components/marketing";
import { ACCURACY, COVERAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About us — CandleTrade",
  description: "What CandleTrade is, how Kronos forecasts work, how accurate they are and which markets we cover.",
};

const HOW_KRONOS_WORKS = [
  {
    title: "Candles as a language",
    body: "Kronos turns each candle (open, high, low, close, volume) into tokens, the way a language model turns words into tokens, and learns which patterns tend to follow which.",
  },
  {
    title: "Trained on 45 exchanges",
    body: "It is an open-source foundation model (MIT licence) pre-trained on more than 12 billion candles from 45 exchanges worldwide, then used as-is on Indian and US stocks.",
  },
  {
    title: "Many futures, not one",
    body: "For each forecast CandleTrade asks Kronos for 20 or more possible paths. The median path, the spread between them and the share that end higher become the forecast you see.",
  },
];

const PRINCIPLES = [
  { icon: Scale, title: "Honesty over hype", body: "We publish how often forecasts were wrong, show every stock’s own record and flag the forecasts we wouldn’t trust." },
  { icon: UserCheck, title: "Your decision, your risk", body: "CandleTrade gives probabilities and context. It never places trades and never tells you what to buy." },
  { icon: Lock, title: "Privacy by default", body: "Passwords are stored only as strong one-way hashes, sessions use secure cookies, and we don’t sell your data." },
  { icon: Eye, title: "Prices only", body: "The Upstox connection is used only to read Indian F&O prices. CandleTrade has no feature that places, changes or cancels orders, or moves funds." },
];

export default function About() {
  return (
    <main>
      <PageHero
        eyebrow="About us"
        title="We make AI market forecasts useful by being honest about them."
        intro="CandleTrade brings live prices for every Indian and US stock together with Kronos, an open AI model for candlestick data, and shows how often each forecast has been right, so traders can decide how much weight to give it."
      />

      <Section eyebrow="What we do" title="From a live quote to a forecast you can judge">
        <div className="grid gap-8 text-ink-2 lg:grid-cols-2">
          <p className="leading-relaxed">
            Most forecasting tools show a confident line and stop there. We built CandleTrade the other way round: every
            forecast comes with a range, a probability and a replay of how the same model did on the same stock in the
            recent past. When the record is poor, the forecast is labelled low trust instead of being dressed up.
          </p>
          <p className="leading-relaxed">
            Around that sits everything a swing or F&amp;O trader checks daily: live prices for 11,000+ stocks across NSE,
            BSE, NYSE, Nasdaq and AMEX, candlestick charts on three timeframes, option chains with open interest and implied
            volatility, and defined-risk trade ideas scored on both Kronos and the option market’s own view.
          </p>
        </div>
      </Section>

      <Section eyebrow="The model" title="How Kronos forecasts work">
        <div className="grid gap-4 md:grid-cols-3">
          {HOW_KRONOS_WORKS.map((s, i) => (
            <div key={s.title} className="rounded-xl border border-line p-6">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-3">
          Kronos is developed by its authors and published at{" "}
          <a href="https://github.com/shiyu-coder/Kronos" target="_blank" rel="noreferrer" className="underline hover:text-ink">
            github.com/shiyu-coder/Kronos
          </a>
          . CandleTrade runs it on its own servers; your data is not sent to third-party AI services.
        </p>
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
          <InfoCard title="Data you can trace">
            Prices from Yahoo Finance, refreshed every 15–20 seconds during market hours. Indian F&amp;O from Upstox. Stock
            lists from NSE, BSE and Nasdaq.
          </InfoCard>
          <InfoCard title="Completed candles only">
            Kronos only sees finished bars; today’s still-forming candle is left out, so forecasts don’t change on intraday noise.
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
                  <dt className="text-xs text-ink-3">Charts &amp; forecasts</dt>
                  <dd className="mt-0.5 text-ink-2">Hourly, daily and weekly candles with Kronos forecasts</dd>
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
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#2a78d6]" />
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
          <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-white hover:opacity-90">
            Contact us <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
