import { BarChart3 } from "lucide-react";

/** A page section with a small blue eyebrow, a title and an optional intro. */
export function Section({ id, eyebrow, title, intro, children }: { id?: string; eyebrow: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 md:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
      {intro && <p className="mt-3 max-w-3xl leading-relaxed text-ink-2">{intro}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function Stat({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="rounded-xl border border-line p-5">
      <p className="tabular text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm">{label}</p>
      <p className="mt-1 text-xs text-ink-3">{note}</p>
    </div>
  );
}

export function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-wash p-5 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <BarChart3 className="h-4 w-4 text-ink-3" /> {title}
      </p>
      <p className="mt-2 leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

/** Page hero for inner pages (About, Contact). */
export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-16 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">{intro}</p>
      </div>
    </section>
  );
}

export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
