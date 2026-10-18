"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { getUpstoxStatus, upstoxLoginUrl, type UpstoxStatus } from "@/lib/api";

/** Indian F&O prices come from Upstox, whose login lasts until 03:30 IST the next day. */
export function UpstoxConnect({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<UpstoxStatus | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUpstoxStatus().then(setStatus).catch((e) => setError((e as Error).message));
  }, []);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      window.location.href = (await upstoxLoginUrl(key)).url; // Upstox redirects back to /fno?connected=1
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!status) return null;
  if (status.connected) {
    return (
      <p className={clsx("flex items-center gap-2 text-xs text-ink-3", !compact && "rounded-xl border border-line px-4 py-3")}>
        <span className="h-1.5 w-1.5 rounded-full bg-up" />
        Upstox connected for live Indian F&amp;O prices until{" "}
        {status.expires_at && new Date(status.expires_at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
      </p>
    );
  }
  return (
    <section className="rounded-xl border border-line p-4">
      <h2 className="text-sm font-semibold">Connect Upstox for live Indian F&amp;O prices</h2>
      <p className="mt-0.5 text-xs text-ink-3">
        Futures quotes and option chains for NSE come from Upstox. The login lasts until 03:30 IST, so connect once each
        trading day. CandleTrade only reads prices with it and never places orders.
      </p>
      {status.configured ? (
        <form onSubmit={connect} className="mt-3 flex flex-wrap gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Admin key (ADMIN_KEY in backend/.env)"
            autoComplete="current-password"
            className="min-w-[260px] flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink-3"
          />
          <button disabled={busy || !key} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {busy ? "Opening Upstox…" : "Connect Upstox"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-ink-2">
          Set <code className="rounded bg-wash px-1">UPSTOX_CLIENT_ID</code>, <code className="rounded bg-wash px-1">UPSTOX_CLIENT_SECRET</code>{" "}
          and <code className="rounded bg-wash px-1">ADMIN_KEY</code> in <code className="rounded bg-wash px-1">backend/.env</code>, then restart the backend.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-down">{error}</p>}
    </section>
  );
}
