'use client';

import { useState } from 'react';
import { Settings, Clock, Bell, Database, Save } from 'lucide-react';

export default function SettingsPage() {
  const [scanHour, setScanHour] = useState(15);
  const [scanMinute, setScanMinute] = useState(30);
  const [autoScan, setAutoScan] = useState(true);
  const [maxResults, setMaxResults] = useState(10);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // TODO: Save to AppSettings table
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Configuration
        </div>
        <h2 className="text-2xl font-bold text-card-foreground">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure scanner behavior and preferences
        </p>
      </div>

      {/* Scan Schedule */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-card-foreground">
          <Clock className="h-5 w-5 text-primary" />
          Scan Schedule
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Auto-Scan Enabled</label>
              <p className="font-mono text-[11px] text-muted-foreground">
                Automatically scan after market close
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoScan}
              onClick={() => setAutoScan(!autoScan)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-0 transition-colors ${
                autoScan ? 'bg-primary' : 'bg-secondary'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  autoScan ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Scan Time (IST)</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={23}
                value={scanHour}
                onChange={(e) => setScanHour(parseInt(e.target.value))}
                className="w-20 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
              />
              <span className="text-muted-foreground">:</span>
              <input
                type="number"
                min={0}
                max={59}
                value={scanMinute}
                onChange={(e) => setScanMinute(parseInt(e.target.value))}
                className="w-20 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
              />
              <span className="font-mono text-xs text-muted-foreground">IST (weekdays only)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Display Settings */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-card-foreground">
          <Bell className="h-5 w-5 text-purple-500" />
          Display Settings
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Top Results Count</label>
            <p className="font-mono text-[11px] text-muted-foreground">
              Number of top signals shown on dashboard
            </p>
            <input
              type="number"
              min={5}
              max={50}
              value={maxResults}
              onChange={(e) => setMaxResults(parseInt(e.target.value))}
              className="mt-2 w-20 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Database */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-card-foreground">
          <Database className="h-5 w-5 text-yellow-500" />
          Database
        </h3>

        <div className="space-y-3 font-mono text-xs text-muted-foreground">
          <p>Database: SQLite (local file)</p>
          <p>Location: prisma/dev.db</p>
          <p>
            Run <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">npx prisma studio</code> to browse data
          </p>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-mono text-xs font-medium uppercase tracking-[0.05em] text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Save className="h-4 w-4" />
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
