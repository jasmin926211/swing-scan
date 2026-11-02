"use client";

import { useState } from "react";
import Link from "next/link";
import { resetPassword } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Set a new password with the site's admin key: there's no email service to send reset links yet. */
export function ResetPasswordForm() {
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("The two passwords don't match");
    setBusy(true);
    setError(null);
    try {
      setUser(await resetPassword(email, adminKey, password));
      window.location.href = "/markets"; // signed in with the new password; full load so the proxy sees the cookie
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 text-sm text-ink-2">
        Enter your account&apos;s email, the site&apos;s admin key and a new password. Every other device signed in to this account is
        signed out.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Email">
          <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Admin key" hint="ADMIN_KEY on the server">
          <input required type="password" autoComplete="off" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} className={INPUT} />
        </Field>
        <Field label="New password" hint="At least 8 characters">
          <input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
        </Field>
        <Field label="New password again">
          <input required type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={INPUT} />
        </Field>
        {error && <p className="text-sm text-down">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-60">
          {busy ? "Please wait…" : "Set new password"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-2">
        Remembered it?{" "}
        <Link href="/signin" className="font-medium text-ink hover:underline">
          Sign in
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
