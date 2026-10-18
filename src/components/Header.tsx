"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import clsx from "clsx";
import type { MarketId } from "@/lib/api";
import { MARKETS } from "@/lib/format";
import { useMarket } from "@/lib/market";

export function Header() {
  const { market, setMarket } = useMarket();
  const router = useRouter();
  const pathname = usePathname();

  const onFno = pathname.startsWith("/fno");

  function choose(m: MarketId) {
    setMarket(m);
    // A stock or contract page belongs to one market; switching country goes back to that country's list.
    const home = onFno ? "/fno" : "/";
    if (pathname !== home) router.push(home);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-5">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
            Kronos
          </Link>
          <nav className="flex gap-1 text-sm">
            {[
              { href: "/", label: "Stocks", active: !onFno },
              { href: "/fno", label: "F&O", active: onFno },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx("rounded-md px-2.5 py-1 transition-colors", l.active ? "bg-wash font-medium text-ink" : "text-ink-2 hover:text-ink")}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div role="radiogroup" aria-label="Country" className="flex rounded-lg border border-line p-0.5 text-sm">
          {(Object.keys(MARKETS) as MarketId[]).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={market === m}
              onClick={() => choose(m)}
              className={clsx(
                "rounded-md px-3 py-1 transition-colors",
                market === m ? "bg-ink text-white" : "text-ink-2 hover:text-ink",
              )}
            >
              <span className="mr-1.5 hidden sm:inline">{MARKETS[m].flag}</span>
              {MARKETS[m].name}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
