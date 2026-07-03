'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function Header() {
  const [authStatus, setAuthStatus] = useState<{
    connected: boolean;
    expired: boolean;
  }>({ connected: false, expired: true });

  useEffect(() => {
    checkAuth();
    const interval = setInterval(checkAuth, 60000);
    return () => clearInterval(interval);
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/token');
      const data = await res.json();
      if (data.success) {
        setAuthStatus(data.data);
      }
    } catch {
      // Ignore
    }
  }

  const isConnected = authStatus.connected && !authStatus.expired;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-sm">
      <div>
        <h2 className="text-xl font-bold leading-tight tracking-tight text-card-foreground">
          Stock Pattern Scanner
        </h2>
        <p className="mt-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Nifty 500 &mdash; All 25 Patterns &mdash; 5-7 Day Swing
        </p>
      </div>

      <div className="flex items-center gap-4">
        {/* Auth Status */}
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] font-medium ${
            isConnected
              ? 'border-green-500/20 bg-green-500/10 text-green-500'
              : 'border-red-500/20 bg-red-500/10 text-red-500'
          }`}
        >
          {isConnected ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
          {isConnected ? 'Upstox Connected' : 'Not Connected'}
        </div>

        <button
          onClick={checkAuth}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
