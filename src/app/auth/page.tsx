'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Shield,
  CheckCircle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Database,
} from 'lucide-react';

function AuthContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');

  const [authStatus, setAuthStatus] = useState<{
    connected: boolean;
    expired: boolean;
    expiresAt?: string;
  }>({ connected: false, expired: true });
  const [instrumentCount, setInstrumentCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    checkAuth();
    checkInstruments();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/token');
      const data = await res.json();
      if (data.success) setAuthStatus(data.data);
    } catch {
      // Ignore
    }
  }

  async function checkInstruments() {
    try {
      const res = await fetch('/api/instruments/sync');
      const data = await res.json();
      if (data.success) setInstrumentCount(data.data.count);
    } catch {
      // Ignore
    }
  }

  async function syncInstruments() {
    setSyncing(true);
    try {
      const res = await fetch('/api/instruments/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setInstrumentCount(data.data.synced);
      }
    } catch {
      // Ignore
    } finally {
      setSyncing(false);
    }
  }

  const isConnected = authStatus.connected && !authStatus.expired;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Data Source
        </div>
        <h2 className="text-2xl font-bold text-card-foreground">Upstox Authentication</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your Upstox account to fetch historical stock data
        </p>
      </div>

      {/* Status Messages */}
      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-green-500">
          <CheckCircle className="h-5 w-5" />
          <p className="text-sm font-medium">Successfully connected to Upstox!</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-500">
          <XCircle className="h-5 w-5" />
          <p className="text-sm font-medium">
            Authentication failed: {error.replace(/_/g, ' ')}
          </p>
        </div>
      )}

      {/* Connection Status Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-full p-3 ${
              isConnected ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}
          >
            <Shield
              className={`h-6 w-6 ${isConnected ? 'text-green-500' : 'text-red-500'}`}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-card-foreground">
              {isConnected ? 'Connected' : 'Not Connected'}
            </h3>
            {authStatus.expiresAt && (
              <p className="font-mono text-[11px] text-muted-foreground">
                Token expires: {new Date(authStatus.expiresAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {/* Step 1: Setup env */}
          <div className="rounded-lg border border-border bg-background p-4">
            <h4 className="font-medium text-foreground">Step 1: Configure API Keys</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your Upstox API credentials to <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]">.env.local</code>:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-secondary p-3 font-mono text-[11px] text-foreground">
{`UPSTOX_CLIENT_ID="your_client_id"
UPSTOX_CLIENT_SECRET="your_client_secret"
UPSTOX_REDIRECT_URI="http://localhost:3000/api/auth/callback"`}
            </pre>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              Get credentials from{' '}
              <a
                href="https://account.upstox.com/developer/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Upstox Developer Portal
                <ExternalLink className="ml-1 inline h-3 w-3" />
              </a>
            </p>
          </div>

          {/* Step 2: Connect */}
          <div className="rounded-lg border border-border bg-background p-4">
            <h4 className="font-medium text-foreground">Step 2: Connect to Upstox</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Click below to authenticate with Upstox OAuth2. You&apos;ll be redirected to Upstox login.
            </p>
            <a
              href="/api/auth/connect"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-mono text-xs font-medium uppercase tracking-[0.05em] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Shield className="h-4 w-4" />
              {isConnected ? 'Reconnect to Upstox' : 'Connect to Upstox'}
            </a>
          </div>

          {/* Step 3: Sync Instruments */}
          <div className="rounded-lg border border-border bg-background p-4">
            <h4 className="font-medium text-foreground">Step 3: Sync Stock List</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Load the Nifty 500 stock list into the database for scanning.
              Currently: <strong className="font-mono text-foreground">{instrumentCount}</strong> stocks loaded.
            </p>
            <button
              onClick={syncInstruments}
              disabled={syncing}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 font-mono text-xs font-medium text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              {syncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              {syncing ? 'Syncing...' : 'Sync Instruments'}
            </button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-border/50 bg-card/50 p-4">
        <p className="font-mono text-[11px] text-muted-foreground">
          <strong>Note:</strong> Upstox access tokens expire daily at 3:30 AM IST.
          You&apos;ll need to reconnect each day before scanning. The app will show a warning
          when the token is expired.
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
      <AuthContent />
    </Suspense>
  );
}
