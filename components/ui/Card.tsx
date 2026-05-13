import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('bg-surface border border-line rounded-lg shadow-1 overflow-hidden', className)}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ children, className, title, subtitle, action }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between px-5 py-3.5 border-b border-line-soft gap-3', className)}>
      <div className="flex flex-col gap-0.5">
        {title && <h3 className="text-[13.5px] font-semibold text-ink tracking-tight">{title}</h3>}
        {subtitle && <p className="text-[12px] text-ink-3">{subtitle}</p>}
        {children}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
  flush?: boolean;
}

export function CardBody({ children, className, flush }: CardBodyProps) {
  return (
    <div className={cn(!flush && 'p-5', className)}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn('px-5 py-3.5 border-t border-line-soft bg-surface-soft/50', className)}>
      {children}
    </div>
  );
}
