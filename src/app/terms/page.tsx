import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Terms of use — CandleTrend",
  description: "The terms for using CandleTrend: a research tool, not investment advice; data without guarantees; your own decisions and risk.",
};

const UPDATED = "3 November 2026";

const TERMS: [string, string[]][] = [
  ["Research, not advice", [
    "CandleTrend is a research and education tool. Nothing on it is investment advice, a research report, a recommendation to buy, sell or hold any security, or a price target.",
    "CandleTrend and its operators are not registered with SEBI as an investment adviser or research analyst, or with any other regulator as an adviser, broker or dealer.",
    "Patterns, ranges, forecasts, screens and the paper portfolio describe how methods behaved on past data. Past results don't guarantee future ones, and every method shown loses on many trades.",
    "Check any decision with a registered adviser if you need advice for your situation.",
  ]],
  ["Your decisions and risk", [
    "You decide every trade and place it yourself with your broker. CandleTrend never places, changes or cancels orders and never holds your money.",
    "Trading, and futures and options above all, can lose more than you expect, quickly. Only trade with money you can afford to lose.",
  ]],
  ["Data without guarantees", [
    "Prices, filings, fundamentals and other data come from third parties (Yahoo Finance, NSE, BSE, Nasdaq, Upstox and others). They can be delayed, incomplete or wrong, and some features stop when a source is unavailable.",
    "Always check the live price and details with your broker before trading.",
  ]],
  ["Your account", [
    "Keep your password private; you are responsible for activity on your account. Give accurate details when you sign up.",
    "Don't misuse the service: no automated scraping, reselling or republishing its data, attempts to break its security, or use that breaks the law.",
    "We may suspend accounts that break these terms, and we may change or stop features at any time.",
  ]],
  ["Liability", [
    "The service is provided as it is, without warranties of any kind. To the extent the law allows, we are not liable for any trading loss, lost profit or other loss arising from using, or being unable to use, CandleTrend or its data.",
  ]],
  ["Changes", [
    "We may update these terms; the date above shows the latest version. Using CandleTrend after a change means you accept the new terms.",
  ]],
];

export default function Terms() {
  return (
    <main>
      <PageHero eyebrow="Terms of use" title="Using CandleTrend" intro={`Please read these before using the site. Last updated ${UPDATED}.`} />
      {TERMS.map(([title, items]) => (
        <Section key={title} eyebrow="Terms" title={title}>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
            {items.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </Section>
      ))}
      <Section eyebrow="Questions" title="Contact">
        <p className="text-sm text-ink-2">
          Questions about these terms: use the <Link href="/contact" className="text-accent hover:underline">contact page</Link>. How we handle
          personal data is in the <Link href="/privacy" className="text-accent hover:underline">privacy policy</Link>.
        </p>
      </Section>
    </main>
  );
}
