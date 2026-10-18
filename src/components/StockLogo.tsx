"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { MarketId } from "@/lib/api";

// Symbols with no logo, so a list doesn't ask again for each one as rows re-render.
const missing = new Set<string>();

/** Company logo from our API (cached on the server); the stock's initials until it loads or when there's none.
 *  Logos sit on a white tile in both themes, since most are drawn for a white background. */
export function StockLogo(props: { market: MarketId; symbol: string; size?: number; className?: string }) {
  // Keyed by stock, so moving to another stock starts fresh instead of keeping the last one's state.
  return <Logo key={`${props.market}:${props.symbol}`} {...props} />;
}

function Logo({ market, symbol, size = 32, className }: { market: MarketId; symbol: string; size?: number; className?: string }) {
  const key = `${market}:${symbol}`;
  const img = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "none">(missing.has(key) ? "none" : "loading");
  // A cached image can finish loading before React attaches onLoad (e.g. during hydration).
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth > 0) setState("ok");
  }, []);
  const initials = symbol.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase();
  return (
    <span
      className={clsx(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line font-semibold",
        state === "ok" ? "bg-white" : "bg-wash text-ink-2",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      aria-hidden
    >
      {state !== "ok" && initials}
      {state !== "none" && (
        // eslint-disable-next-line @next/next/no-img-element -- a small same-origin PNG; no resizing needed
        <img
          ref={img}
          src={`/api/public/logos/${market}/${encodeURIComponent(symbol)}`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onLoad={() => setState("ok")}
          onError={() => {
            missing.add(key);
            setState("none");
          }}
          className={clsx("absolute inset-0 h-full w-full object-contain p-[6%] transition-opacity duration-300", state === "ok" ? "opacity-100" : "opacity-0")}
        />
      )}
    </span>
  );
}
