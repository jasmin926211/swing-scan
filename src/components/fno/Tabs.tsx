"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export type Tab<T extends string> = { id: T; label: string; badge?: string | number };

/** Accessible tabs (arrow keys move between them). The chosen tab is kept in the URL hash so it can be shared and
 *  survives a reload. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: Tab<T>[]; value: T; onChange: (id: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function key(e: React.KeyboardEvent, i: number) {
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (next == null) return;
    e.preventDefault();
    const j = (next + tabs.length) % tabs.length;
    onChange(tabs[j].id);
    refs.current[j]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => key(e, i)}
          className={clsx(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
            value === t.id ? "border-ink font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink",
          )}
        >
          {t.label}
          {t.badge != null && <span className="tabular ml-1.5 text-xs text-ink-3">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: boolean; children: React.ReactNode }) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="space-y-4 pt-4">
      {children}
    </div>
  );
}

/** Tab state kept in the URL hash (#chain), so links and reloads open the same tab. */
export function useHashTab<T extends string>(ids: readonly T[], fallback: T): [T, (t: T) => void] {
  const [tab, setTab] = useState<T>(fallback);
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as T;
      setTab(ids.includes(h) ? h : fallback);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [ids, fallback]);
  function change(t: T) {
    setTab(t);
    window.history.replaceState(null, "", t === fallback ? window.location.pathname + window.location.search : `#${t}`);
  }
  return [tab, change];
}
