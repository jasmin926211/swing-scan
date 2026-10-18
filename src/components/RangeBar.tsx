import type { MarketId } from "@/lib/api";
import { price } from "@/lib/format";

/** Where `value` sits between `low` and `high` (day range or 52-week range). */
export function RangeBar({
  low,
  high,
  value,
  market,
  labels = false,
}: {
  low?: number | null;
  high?: number | null;
  value?: number | null;
  market: MarketId;
  labels?: boolean;
}) {
  if (low == null || high == null || value == null) return <span className="text-ink-3">—</span>;
  const pos = high > low ? Math.min(1, Math.max(0, (value - low) / (high - low))) : 0.5;
  return (
    <div className="min-w-[110px]" title={`${price(low, market)} – ${price(high, market)}`}>
      <div className="relative h-1 rounded-full bg-line">
        <span
          className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded-full bg-ink"
          style={{ left: `calc(${pos * 100}% - 1px)` }}
        />
      </div>
      {labels && (
        <div className="tabular mt-1.5 flex justify-between text-xs text-ink-3">
          <span>{price(low, market)}</span>
          <span>{price(high, market)}</span>
        </div>
      )}
    </div>
  );
}
