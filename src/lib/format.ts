import type { MarketId } from "./api";

export const MARKETS: Record<MarketId, { name: string; flag: string; currency: string; locale: string; universe: string }> = {
  in: { name: "India", flag: "🇮🇳", currency: "INR", locale: "en-IN", universe: "NSE + BSE" },
  us: { name: "USA", flag: "🇺🇸", currency: "USD", locale: "en-US", universe: "NYSE + Nasdaq" },
};

const DASH = "—";

export function price(v: number | null | undefined, m: MarketId) {
  if (v == null) return DASH;
  return v.toLocaleString(MARKETS[m].locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function money(v: number | null | undefined, m: MarketId) {
  if (v == null) return DASH;
  return v.toLocaleString(MARKETS[m].locale, { style: "currency", currency: MARKETS[m].currency, maximumFractionDigits: 2 });
}

export function signedPct(v: number | null | undefined, digits = 2) {
  if (v == null) return DASH;
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export const pct = (v: number | null | undefined, digits = 1) => (v == null ? DASH : `${(v * 100).toFixed(digits)}%`);

/** 1.2K / 3.4M / 5.6B (US) or 1.2K / 3.4L / 5.6Cr (India). */
export function compact(v: number | null | undefined, m: MarketId) {
  if (v == null) return DASH;
  const units: [number, string][] =
    m === "in"
      ? [[1e7, "Cr"], [1e5, "L"], [1e3, "K"]]
      : [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, unit] of units) {
    const n = v / size;
    if (Math.abs(n) >= 1)
      return `${n.toLocaleString(MARKETS[m].locale, { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 1 })}${unit}`;
  }
  return v.toFixed(0);
}

export const changeColor = (v: number | null | undefined) =>
  v == null || v === 0 ? "text-ink-2" : v > 0 ? "text-up" : "text-down";

const MARKET_STATE: Record<string, string> = {
  REGULAR: "Market open",
  PRE: "Pre-market",
  PREPRE: "Pre-market",
  POST: "After hours",
  POSTPOST: "After hours",
  CLOSED: "Market closed",
};

export const marketStateLabel = (s: string | null | undefined) => (s ? (MARKET_STATE[s] ?? s) : "—");

/** Backend times are exchange-local wall time encoded as UTC epoch ms. */
export function barTime(ms: number, withTime: boolean) {
  return new Date(ms).toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : { year: "numeric" }),
  });
}

/** "2026-10-27" -> "27 Oct 26" */
export const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "2-digit" });
