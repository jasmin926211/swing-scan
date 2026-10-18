"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { CONTACT_TOPICS, sendContact, type ContactMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const EMPTY: ContactMessage = { name: "", email: "", topic: "General question", message: "", website: "" };
const INPUT = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink-3";

export function ContactForm() {
  const { user } = useAuth();
  const [form, setForm] = useState<ContactMessage>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Signed-in visitors don't need to type who they are.
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.name, email: f.email || user.email }));
  }, [user]);

  const set = <K extends keyof ContactMessage>(k: K, v: ContactMessage[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendContact(form);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-line p-8 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-up" />
        <h2 className="mt-3 text-lg font-semibold">Thanks, your message is on its way</h2>
        <p className="mt-1 text-sm text-ink-2">We’ll reply to {form.email}.</p>
        <button
          onClick={() => {
            setForm({ ...EMPTY, name: form.name, email: form.email });
            setSent(false);
          }}
          className="mt-5 text-sm font-medium text-accent hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-line p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input required maxLength={100} autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} className={INPUT} />
        </Field>
        <Field label="Email">
          <input required type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={INPUT} />
        </Field>
      </div>
      <Field label="Topic">
        <select value={form.topic} onChange={(e) => set("topic", e.target.value as ContactMessage["topic"])} className={INPUT}>
          {CONTACT_TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Message" hint={`${form.message.length} / 5000`}>
        <textarea
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          placeholder="For a bug, tell us the stock symbol, the page and what you expected to see."
          className={`${INPUT} resize-y`}
        />
      </Field>
      {/* Spam trap: hidden from people, filled in by bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={(e) => set("website", e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />
      {error && <p className="text-sm text-down">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-3">We can’t give personal investment advice.</p>
        <button disabled={busy} className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
          {busy ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm font-medium">
        {label}
        {hint && <span className="font-normal text-ink-3">{hint}</span>}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
