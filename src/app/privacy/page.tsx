import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section } from "@/components/marketing";
import { CONTACT } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy — CandleTrend",
  description: "What personal data CandleTrend collects, why, who processes it, how long it's kept and how to ask for it to be corrected or deleted.",
};

const UPDATED = "3 November 2026";

const COLLECT: [string, string][] = [
  ["Your account", "Your name, email address and password. The password is stored only as an Argon2 hash, never in readable form."],
  ["Sign-in sessions", "A random session token in a cookie on your browser; we store only a one-way hash of it, for up to 30 days. Repeated failed sign-ins are counted against the email address for 15 minutes to stop password guessing."],
  ["Messages you send us", "The name, email, topic and message you type in the contact form, your account if you're signed in, and the IP address the message came from (to deal with spam)."],
  ["Settings in your browser", "Choices such as the country, chart options, screen rules and rows per page are saved in your browser's own storage. They never reach our servers."],
  ["Server logs", "Like most websites, our servers record each request's IP address, time and page for a short period, to keep the service running and secure."],
];

const NOT: string[] = [
  "No advertising or analytics trackers, and no third-party cookies.",
  "We don't sell or rent personal data, or share it for marketing.",
  "We don't ask for or store broker logins, bank details or payment information. The Upstox connection on the F&O page belongs to the site operator and only reads prices.",
];

export default function Privacy() {
  return (
    <main>
      <PageHero eyebrow="Privacy policy" title="Your data on CandleTrend" intro={`What we collect, why, and what you can ask us to do with it. Last updated ${UPDATED}.`} />

      <Section eyebrow="What we collect" title="The personal data we hold">
        <dl className="space-y-4">
          {COLLECT.map(([t, b]) => (
            <div key={t}>
              <dt className="font-medium">{t}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink-2">{b}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section eyebrow="Why" title="What we use it for">
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
          <li>To create your account, sign you in and keep it secure (your consent when you create the account).</li>
          <li>To reply to messages you send us.</li>
          <li>To keep the service running, find faults and stop abuse.</li>
        </ul>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
          {NOT.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </Section>

      <Section eyebrow="Who processes it" title="Services that hold data for us">
        <p className="text-sm leading-relaxed text-ink-2">
          The website is hosted on Vercel, our servers run on Oracle Cloud, and account data is stored in a managed Postgres database (Neon).
          They process data only to provide those services to us. Market data comes from Yahoo Finance, NSE and Upstox; when you look at a
          stock, our servers ask them for that stock&apos;s prices, never for anything about you.
        </p>
      </Section>

      <Section eyebrow="How long" title="Keeping and deleting it">
        <p className="text-sm leading-relaxed text-ink-2">
          Account data is kept while your account exists. Sessions expire after 30 days. Messages are kept until they&apos;re dealt with and
          then for up to a year. Server logs are kept for a short period. When you ask us to delete your account, we delete your account
          data and sessions, and remove your name and email from your messages.
        </p>
      </Section>

      <Section eyebrow="Your rights" title="Access, correction, deletion and complaints">
        <p className="text-sm leading-relaxed text-ink-2">
          You can ask for a copy of the personal data we hold about you, ask us to correct or delete it, withdraw your consent (which closes
          your account), or raise a complaint. Write to us through the <Link href="/contact" className="text-accent hover:underline">contact
          page</Link> or at <a href={`mailto:${CONTACT.email}`} className="text-accent hover:underline">{CONTACT.email}</a>, from the email
          address on your account. We aim to reply within 30 days. If you aren&apos;t satisfied with our reply, you may complain to the data
          protection authority where you live (in India, the Data Protection Board).
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">CandleTrend is not meant for anyone under 18.</p>
      </Section>
    </main>
  );
}
