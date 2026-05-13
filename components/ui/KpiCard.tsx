'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  subValue?: ReactNode;
  sparkline?: ReactNode;
  href?: string;
  hrefLabel?: string;
  className?: string;
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  subValue,
  sparkline,
  href,
  hrefLabel = 'ดูทั้งหมด →',
  className,
  loading = false,
}: KpiCardProps) {
  return (
    <div className={cn(
      'p-[22px] flex flex-col gap-2 relative min-h-[140px]',
      className
    )}>
      <div className="text-[12px] text-ink-3 font-medium uppercase tracking-wider">{label}</div>
      
      <div className="flex-1">
        <div className="text-[28px] font-semibold tracking-tight text-ink leading-[1.1] tabular-nums">
          {loading ? (
            <div className="h-8 w-24 bg-surface-sunken animate-pulse rounded" />
          ) : (
            value ?? '—'
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
          className="text-[11.5px] font-medium text-accent-ink hover:underline mt-auto pt-2"
        >
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}

export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      'bg-white border border-line rounded-lg shadow-1 overflow-hidden grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-line-soft',
      className
    )}>
      {children}
    </div>
  );
}
