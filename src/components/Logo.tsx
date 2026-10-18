import Link from "next/link";

/** CandleTrade mark: three candles, the last one stepping up. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2" aria-label="CandleTrade home">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect width="22" height="22" rx="6" fill="#0b0b0b" />
        <line x1="6" y1="6" x2="6" y2="16" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1" />
        <rect x="4.5" y="8.5" width="3" height="5" rx="0.75" fill="#ffffff" fillOpacity="0.55" />
        <line x1="11" y1="5" x2="11" y2="15" stroke="#e34948" strokeWidth="1" />
        <rect x="9.5" y="7" width="3" height="6" rx="0.75" fill="#e34948" />
        <line x1="16" y1="3.5" x2="16" y2="13.5" stroke="#1baf7a" strokeWidth="1" />
        <rect x="14.5" y="5" width="3" height="6.5" rx="0.75" fill="#1baf7a" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">CandleTrade</span>
    </Link>
  );
}
