"use client";

import { useEffect, useState } from "react";
import type { MarketId, StockFilters } from "@/lib/api";
import { MARKETS } from "@/lib/format";

type Props = {
  market: MarketId;
  filters: StockFilters;
  onChange: (patch: Partial<StockFilters>) => void;
  sectors: string[];
  exchanges: string[];
};

// Value-traded floors per market (today's price × volume).
const TURNOVER: Record<MarketId, { label: string; value: number }[]> = {
  in: [{ label: "₹1 Cr+", value: 1e7 }, { label: "₹10 Cr+", value: 1e8 }, { label: "₹100 Cr+", value: 1e9 }],
  us: [{ label: "$1M+", value: 1e6 }, { label: "$10M+", value: 1e7 }, { label: "$100M+", value: 1e8 }],
};
const REL_VOLUME = [1.5, 2, 3, 5];
const WEEK52 = [
  { label: "Within 5% of 52-week high", key: "near_high", value: 5 },
  { label: "Within 10% of 52-week high", key: "near_high", value: 10 },
  { label: "Within 5% of 52-week low", key: "near_low", value: 5 },
  { label: "Within 10% of 52-week low", key: "near_low", value: 10 },
] as const;

/** Screening filters: everything here narrows the list before you pick stocks to forecast. */
export function FilterPanel({ market, filters, onChange, sectors, exchanges }: Props) {
  const week52 = WEEK52.findIndex((w) => filters[w.key] === w.value);
  const currency = MARKETS[market].currency === "INR" ? "₹" : "$";

  return (
    <div className="grid gap-x-6 gap-y-4 border-b border-line bg-wash/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Sector">
        <select value={filters.sector ?? ""} onChange={(e) => onChange({ sector: e.target.value })} className={INPUT}>
          <option value="">All sectors</option>
          {sectors.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label="Exchange">
        <select value={filters.exchange ?? ""} onChange={(e) => onChange({ exchange: e.target.value })} className={INPUT}>
          <option value="">All exchanges</option>
          {exchanges.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Range label={`Price (${currency})`} min={filters.min_price} max={filters.max_price}
        onMin={(min_price) => onChange({ min_price })} onMax={(max_price) => onChange({ max_price })} />
      <Range label="Change today (%)" min={filters.min_change} max={filters.max_change} allowNegative
        onMin={(min_change) => onChange({ min_change })} onMax={(max_change) => onChange({ max_change })} />

      <Field label="Value traded today">
        <select
          value={filters.min_turnover ?? ""}
          onChange={(e) => onChange({ min_turnover: e.target.value ? Number(e.target.value) : null })}
          className={INPUT}
        >
          <option value="">Any</option>
          {TURNOVER[market].map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Volume vs 3-month average">
        <select
          value={filters.min_rel_volume ?? ""}
          onChange={(e) => onChange({ min_rel_volume: e.target.value ? Number(e.target.value) : null })}
          className={INPUT}
        >
          <option value="">Any</option>
          {REL_VOLUME.map((r) => (
            <option key={r} value={r}>
              {r}× or more
            </option>
          ))}
        </select>
      </Field>
      <Field label="52-week range">
        <select
          value={week52}
          onChange={(e) => {
            const w = WEEK52[Number(e.target.value)];
            onChange({ near_high: w?.key === "near_high" ? w.value : null, near_low: w?.key === "near_low" ? w.value : null });
          }}
          className={INPUT}
        >
          <option value={-1}>Anywhere</option>
          {WEEK52.map((w, i) => (
            <option key={w.label} value={i}>
              {w.label}
            </option>
          ))}
        </select>
      </Field>
      <Range label="P/E ratio" min={filters.min_pe} max={filters.max_pe} onMin={(min_pe) => onChange({ min_pe })} onMax={(max_pe) => onChange({ max_pe })} />

      <Field label="Validated pattern (active)">
        <select value={filters.pattern ?? ""} onChange={(e) => onChange({ pattern: e.target.value as StockFilters["pattern"] })} className={INPUT}>
          <option value="">Any or none</option>
          <option value="any">Has a validated pattern</option>
          <option value="bull">Bullish pattern</option>
          <option value="bear">Bearish pattern</option>
        </select>
      </Field>
      {market === "in" && (
        <Field label="F&O build-up (last trading day)">
          <select value={filters.buildup ?? ""} onChange={(e) => onChange({ buildup: e.target.value as StockFilters["buildup"] })} className={INPUT}>
            <option value="">Any</option>
            <option value="long_buildup">Long build-up (price ↑, OI ↑)</option>
            <option value="short_buildup">Short build-up (price ↓, OI ↑)</option>
            <option value="short_covering">Short covering (price ↑, OI ↓)</option>
            <option value="long_unwinding">Long unwinding (price ↓, OI ↓)</option>
          </select>
        </Field>
      )}
      <NumberField label="Minimum volume (shares)" value={filters.min_volume} onChange={(min_volume) => onChange({ min_volume })} />
      {market === "in" && (
        <label className="flex items-end gap-2 pb-2 text-sm text-ink-2">
          <input type="checkbox" checked={!!filters.fo} onChange={(e) => onChange({ fo: e.target.checked })} className="mb-0.5 accent-ink" />
          Only F&amp;O stocks
        </label>
      )}
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-ink-3";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-ink-3">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

/** A number box that applies its value after a short pause in typing. */
function DebouncedNumber({ value, onChange, placeholder, allowNegative }: {
  value: number | null | undefined; onChange: (v: number | null) => void; placeholder: string; allowNegative?: boolean;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => setText(value == null ? "" : String(value)), [value]);
  useEffect(() => {
    const t = setTimeout(() => {
      const v = text.trim() === "" ? null : Number(text);
      if (v !== (value ?? null) && (v === null || Number.isFinite(v))) onChange(v);
    }, 450);
    return () => clearTimeout(t);
  }, [text]); // only typing triggers an update; external value changes resync the text above
  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value.replace(allowNegative ? /[^0-9.-]/g : /[^0-9.]/g, ""))}
      className={INPUT}
    />
  );
}

/** Each end updates only its own filter, so typing in both boxes quickly can't overwrite the other. */
function Range({ label, min, max, onMin, onMax, allowNegative }: {
  label: string; min?: number | null; max?: number | null; onMin: (v: number | null) => void; onMax: (v: number | null) => void; allowNegative?: boolean;
}) {
  return (
    <Field label={label}>
      <span className="flex items-center gap-2">
        <DebouncedNumber value={min} placeholder="Min" allowNegative={allowNegative} onChange={onMin} />
        <span className="text-ink-3">–</span>
        <DebouncedNumber value={max} placeholder="Max" allowNegative={allowNegative} onChange={onMax} />
      </span>
    </Field>
  );
}

function NumberField({ label, value, onChange }: { label: string; value?: number | null; onChange: (v: number | null) => void }) {
  return (
    <Field label={label}>
      <DebouncedNumber value={value} placeholder="Any" onChange={onChange} />
    </Field>
  );
}
