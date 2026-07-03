'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ScanSearch,
  Search,
  BookOpen,
  Settings,
  Shield,
  TrendingUp,
  Wallet,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/scanner', label: 'Scanner', icon: ScanSearch },
  { href: '/analyze', label: 'Analyze', icon: Search },
  { href: '/patterns', label: 'Patterns', icon: BookOpen },
  { href: '/invest', label: 'Invest', icon: Wallet },
  { href: '/net-new-high', label: 'Net New High', icon: BarChart3 },
  { href: '/auth', label: 'Upstox Auth', icon: Shield },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/15">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-[17px] font-bold leading-none tracking-tight text-card-foreground">SwingScan</h1>
          <p className="mt-1 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Pattern Detection</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-6 space-y-1 px-3">
        <div className="mb-3 px-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
          Navigation
        </div>
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all',
                isActive
                  ? 'border-primary/20 bg-primary/10 text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.4 : 2} />
              <span className={cn('font-mono text-xs tracking-[0.02em]', isActive ? 'font-semibold' : 'font-medium')}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-border p-4">
        <div className="space-y-1 font-mono text-[10px] text-muted-foreground/80">
          <p className="font-medium uppercase tracking-[0.2em]">Auto-scan: 3:30 PM IST</p>
          <p className="tracking-[0.02em]">Nifty 500 Stocks</p>
        </div>
      </div>
    </aside>
  );
}
