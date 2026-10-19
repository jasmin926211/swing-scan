"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

/** Plain-language explanations of F&O words, shown from a small ⓘ button next to the term. */
export const GLOSSARY = {
  oi: ["Open interest (OI)", "How many contracts are still open: positions traders have entered and not yet closed. Rising OI means new money is coming in; falling OI means positions are being closed."],
  oi_change: ["Change in OI", "How much open interest rose or fell since the previous trading day. Big increases at one strike show where traders are building positions."],
  pcr: ["Put-call ratio (PCR)", "Put open interest divided by call open interest. Above about 1.2: more puts written, often read as option sellers comfortable with the price holding up. Below about 0.7: more calls written. Extremes are sometimes read the opposite way."],
  max_pain: ["Max pain", "The expiry price at which option buyers, in total, would lose the most (and option sellers keep the most). Some traders expect the price to drift towards it near expiry; it is a tendency, not a rule."],
  support: ["Support (put wall)", "The strike with the most put open interest. Put sellers profit if the price stays above it, so they tend to defend it. It can still break, especially on news or near expiry."],
  resistance: ["Resistance (call wall)", "The strike with the most call open interest. Call sellers profit if the price stays below it, so they tend to defend it. It can still break."],
  buildup: ["Futures build-up", "Reads the futures price change together with the change in open interest: price ↑ OI ↑ long build-up (new buyers), price ↓ OI ↑ short build-up (new sellers), price ↑ OI ↓ short covering (sellers exiting), price ↓ OI ↓ long unwinding (buyers exiting)."],
  atm: ["At the money (ATM)", "The strike closest to the current price."],
  itm: ["In the money (ITM)", "A call below the current price, or a put above it: it already has value if exercised now. Shaded in the table."],
  iv: ["Implied volatility (IV)", "How big a move the option's price assumes, per year. Higher IV means more expensive options."],
  delta: ["Delta", "How much the option's price moves for a 1-point move in the stock, roughly. Also a rough chance of finishing in the money: 0.30 ≈ 30%."],
  lot: ["Lot size", "The number of shares in one contract. Profit and loss per lot = price move × lot size."],
  expiry: ["Expiry", "The date the contract ends. Options lose value faster as expiry gets closer."],
  premium: ["Premium to spot", "How far the futures price is above (or below) the current share price. It mostly reflects interest until expiry."],
  call: ["Call option", "The right to buy at the strike price. Buyers profit if the price rises above strike + premium."],
  put: ["Put option", "The right to sell at the strike price. Buyers profit if the price falls below strike − premium."],
} satisfies Record<string, [string, string]>;
export type TermKey = keyof typeof GLOSSARY;

export function Term({ k, children }: { k: TermKey; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLSpanElement>(null);
  const [title, text] = GLOSSARY[k];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span ref={box} className="relative inline-flex items-center gap-1">
      {children ?? title}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`What is ${title}?`}
        className="rounded-full text-ink-3 transition-colors hover:text-ink focus-visible:text-ink"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-lg border border-line bg-paper p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink-2 shadow-lg"
        >
          <span className="block font-semibold text-ink">{title}</span>
          <span className="mt-1 block">{text}</span>
        </span>
      )}
    </span>
  );
}
