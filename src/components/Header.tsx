"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import clsx from "clsx";
import { Activity, ScrollText } from "lucide-react";
import type { MarketId } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MARKETS } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const PUBLIC_PAGES = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact us" },
];

export function Header() {
  const { user, signedIn } = useAuth();
  const pathname = usePathname();
  const inApp = ["/markets", "/stock", "/fno", "/pulse", "/fundamentals"].some((p) => pathname.startsWith(p));

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-2 sm:gap-6">
          <Logo href="/" compact={signedIn} />
          {signedIn ? (
            <nav className="flex gap-0.5 text-sm sm:gap-1">
              <NavLink href="/markets" active={pathname.startsWith("/markets") || pathname.startsWith("/stock")}>
                Markets
              </NavLink>
              <NavLink href="/fno" active={pathname.startsWith("/fno")}>
                F&amp;O
              </NavLink>
              <NavLink href="/fundamentals" active={pathname.startsWith("/fundamentals")}>
                <ScrollText className="h-4 w-4 sm:hidden" aria-label="Fundamentals" />
                <span className="hidden sm:inline">Fundamentals</span>
              </NavLink>
              <NavLink href="/pulse" active={pathname.startsWith("/pulse")}>
                {/* Icons on phones: the header has no room for more words there. */}
                <Activity className="h-4 w-4 sm:hidden" aria-label="Pulse" />
                <span className="hidden sm:inline">Pulse</span>
              </NavLink>
            </nav>
          ) : (
            <nav className="hidden gap-1 text-sm md:flex">
              {PUBLIC_PAGES.map((p) => (
                <NavLink key={p.href} href={p.href} active={pathname === p.href}>
                  {p.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-0.5 sm:gap-3">
          {inApp && signedIn && <CountrySwitch />}
          <ThemeToggle />
          {user ? (
            <UserMenu />
          ) : signedIn ? (
            // Signed in, account details still loading: hold the avatar's place so nothing shifts.
            <span className="h-8 w-8 animate-pulse rounded-full bg-wash" aria-hidden />
          ) : (
            <SignedOutActions />
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={clsx("flex items-center rounded-md px-1.5 py-1 transition-colors sm:px-2.5", active ? "bg-wash font-medium text-ink" : "text-ink-2 hover:text-ink")}
    >
      {children}
    </Link>
  );
}

function SignedOutActions() {
  return (
    <div className="flex items-center gap-1 text-sm">
      <Link href="/signin" className="rounded-md px-3 py-1.5 text-ink-2 hover:text-ink">
        Sign in
      </Link>
      <Link href="/signup" className="rounded-lg bg-ink px-3.5 py-1.5 font-medium text-paper hover:opacity-90">
        Get started
      </Link>
    </div>
  );
}

function CountrySwitch() {
  const { market, setMarket } = useMarket();
  const router = useRouter();
  const pathname = usePathname();
  const onFno = pathname.startsWith("/fno");
  const onPulse = pathname.startsWith("/pulse");
  const onFundamentals = pathname.startsWith("/fundamentals");

  function choose(m: MarketId) {
    setMarket(m);
    // A stock or contract page belongs to one market; switching country goes back to that country's list.
    const home = onFno ? "/fno" : onPulse ? "/pulse" : onFundamentals ? "/fundamentals" : "/markets";
    if (pathname !== home) router.push(home);
  }

  return (
    <div role="radiogroup" aria-label="Country" className="flex rounded-lg border border-line p-0.5 text-sm">
      {(Object.keys(MARKETS) as MarketId[]).map((m) => (
        <button
          key={m}
          role="radio"
          aria-checked={market === m}
          onClick={() => choose(m)}
          className={clsx("rounded-md px-1.5 py-1 transition-colors sm:px-3", market === m ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}
        >
          <span className="mr-1.5 hidden sm:inline">{MARKETS[m].flag}</span>
          {MARKETS[m].name}
        </button>
      ))}
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!user) return null;
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-wash text-xs font-semibold text-ink hover:bg-line"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-paper p-1 shadow-sm">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-ink-3">{user.email}</p>
          </div>
          <div className="my-1 border-t border-line" />
          {PUBLIC_PAGES.map((p) => (
            <Link key={p.href} href={p.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-wash">
              {p.href === "/" ? "CandleTrade home" : p.label}
            </Link>
          ))}
          <button onClick={signOut} className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-wash">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
