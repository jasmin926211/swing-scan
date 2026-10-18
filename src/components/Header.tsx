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

  function choose(m: MarketId) {
    setMarket(m);
    // A stock page belongs to one market; switching country goes back to that country's list.
    if (pathname !== "/") router.push("/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight">Kronos</span>
          <span className="hidden text-xs text-ink-3 sm:inline">stock forecasts</span>
        </Link>

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
              <span className="mr-1.5">{MARKETS[m].flag}</span>
              {MARKETS[m].name}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
