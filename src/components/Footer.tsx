import Link from "next/link";
import { CONTACT } from "@/lib/site";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-3 md:grid-cols-5 md:px-6">
        <div className="space-y-3 sm:col-span-3 md:col-span-2">
          <Logo />
          <p className="max-w-sm text-sm leading-relaxed text-ink-2">
            Live Indian and US markets with AI forecasts and an honest track record next to every one.
          </p>
        </div>
        <FooterColumn
          title="Product"
          links={[
            { href: "/markets", label: "Markets" },
            { href: "/fno", label: "Futures & options" },
            { href: "/#accuracy", label: "Accuracy" },
            { href: "/signup", label: "Create an account" },
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            { href: "/about", label: "About us" },
            { href: "/contact", label: "Contact us" },
            { href: `mailto:${CONTACT.email}`, label: CONTACT.email },
            { href: `tel:${CONTACT.phone}`, label: CONTACT.phoneDisplay },
          ]}
        />
        <FooterColumn
          title="Data"
          links={[
            { href: "https://finance.yahoo.com", label: "Prices: Yahoo Finance" },
            { href: "https://upstox.com/developer/api-documentation/", label: "Indian F&O: Upstox" },
            { href: "/about#model", label: "Forecasts: CandleTrade AI" },
            { href: "https://www.highcharts.com", label: "Charts: Highcharts" },
          ]}
        />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-ink-3 md:flex-row md:justify-between md:px-6">
          <p>© {new Date().getFullYear()} CandleTrade</p>
          <p className="max-w-3xl md:text-right">
            CandleTrade is a research tool, not investment advice, and never places trades. Forecasts are probabilities
            and are often wrong; prices may be delayed. Trade only with money you can afford to lose.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            {l.href.startsWith("mailto:") || l.href.startsWith("tel:") ? (
              <a href={l.href} className="break-all text-ink-2 hover:text-ink">
                {l.label}
              </a>
            ) : l.href.startsWith("http") ? (
              <a href={l.href} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-ink">
                {l.label}
              </a>
            ) : (
              <Link href={l.href} className="text-ink-2 hover:text-ink">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
