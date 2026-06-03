'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useT } from '@/lib/i18n';

interface KpiCardProps {
  label: string;
  value: string | number;
  subValue?: ReactNode;
  sparkline?: ReactNode;
  href?: string;
  hrefLabel?: string;
  className?: string;
  loading?: boolean;
  delta?: { value: number; direction: 'up' | 'down' };
}

export function KpiCard({
  label,
  value,
  subValue,
  sparkline,
  href,
  hrefLabel,
  className,
  loading = false,
  delta,
}: KpiCardProps) {
  const t = useT();
  const displayHrefLabel = hrefLabel ?? `${t('action.view_all')} →`;
  return (
    <div className={cn(
      'flex-1 p-[22px] flex flex-col gap-2 relative min-h-[140px]',
      className
    )}>
      <div className="text-[12px] text-ink-3 font-medium uppercase tracking-wider">{label}</div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="text-[28px] font-semibold tracking-[-0.02em] text-ink leading-[1.1] tabular-nums font-sans">
            {loading ? (
              <div className="h-8 w-24 bg-surface-sunken animate-pulse rounded" />
            ) : (
              value ?? '—'
            )}
          </div>
          
          {!loading && delta && (
            <div className={cn(
              "inline-flex items-center gap-1 text-[12px] font-medium tabular-nums",
              delta.direction === 'up' ? 'text-accent-ink' : 'text-danger'
            )}>
              {delta.direction === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(delta.value)}%
            </div>
          )}
        </div>
        
        <div className="text-[11.5px] text-ink-4 mt-1">
          {loading ? (
            <div className="h-4 w-32 bg-surface-sunken animate-pulse rounded mt-2" />
          ) : (
            subValue
          )}
        </div>
      </div>

      {!loading && sparkline && (
        <div className="absolute right-4 top-[18px] opacity-90 pointer-events-none">
          {sparkline}
        </div>
      )}

      {!loading && href && (
        <Link 
          href={href}
          className="text-[11.5px] font-medium text-accent-ink hover:underline mt-auto pt-2 inline-block"
        >
          {displayHrefLabel}
        </Link>
      )}
    </div>
  );
}

export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      'flex flex-col md:flex-row bg-white border border-line rounded-[var(--r-lg)] shadow-1 overflow-hidden md:divide-x divide-y md:divide-y-0 divide-line-soft',
      className
    )}>
      {children}
    </div>
  );
}
