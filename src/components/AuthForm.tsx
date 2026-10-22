"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn, signUp } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Only same-site paths are allowed as the post-sign-in destination (no open redirects). */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/markets";
}

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const expired = params.has("expired");
  const { setUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignUp = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setUser(isSignUp ? await signUp(name, email, password) : await signIn(email, password));
      window.location.href = next; // full load so the members-only proxy sees the new cookie
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const other = `${isSignUp ? "/signin" : "/signup"}${next !== "/markets" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{isSignUp ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-1 text-sm text-ink-2">
        {isSignUp
          ? "Free. Unlocks every Indian and US stock, tested signals, Market Pulse and F&O analysis."
          : "Sign in to see every stock, the tested signals and F&O analysis."}
      </p>
      {expired && !isSignUp && (
        <p className="mt-4 rounded-lg bg-wash px-3 py-2 text-sm text-ink-2">Your session ended. Please sign in again.</p>
      )}

      <form onSubmit={submit} className="mt-8 space-y-4">
        {isSignUp && (
          <Field label="Name">
            <input required autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
          </Field>
        )}
        <Field label="Email">
          <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Password" hint={isSignUp ? "At least 8 characters" : undefined}>
          <input
            required
            type="password"
            minLength={isSignUp ? 8 : undefined}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
        </Field>
        {error && <p className="text-sm text-down">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-60">
          {busy ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-2">
        {isSignUp ? "Already have an account? " : "New to CandleTrade? "}
        <Link href={other} className="font-medium text-ink hover:underline">
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </main>
  );
}

const INPUT = "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink-3";

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
