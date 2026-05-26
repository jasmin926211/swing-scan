import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number | null | undefined): string {
  if (price == null) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(price);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

export function formatSignalStrength(strength: number): {
  label: string;
  color: string;
  className: string;
} {
  if (strength >= 0.8) return { label: 'Very Strong', color: '#22c55e', className: 'text-green-500' };
  if (strength >= 0.6) return { label: 'Strong', color: '#84cc16', className: 'text-lime-500' };
  if (strength >= 0.4) return { label: 'Moderate', color: '#eab308', className: 'text-yellow-500' };
  return { label: 'Weak', color: '#ef4444', className: 'text-red-500' };
}

export function getDirectionColor(direction: string): string {
  if (direction === 'bullish') return 'text-green-500';
  if (direction === 'bearish') return 'text-red-500';
  return 'text-yellow-500';
}

export function getDirectionBg(direction: string): string {
  if (direction === 'bullish') return 'bg-green-500/10 text-green-500 border-green-500/20';
  if (direction === 'bearish') return 'bg-red-500/10 text-red-500 border-red-500/20';
  return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function timeAgo(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
