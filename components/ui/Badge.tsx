import { cn } from '@/lib/utils';

// Semantic variants matching อรุณ pill design
type BadgeVariant = 'ok' | 'warn' | 'danger' | 'info' | 'muted' | 'purple' | 
                   'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'orange' | 'emerald' | 'amber' | 'stone';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  ok:      'text-accent-ink border-accent-line bg-accent-soft',
  warn:    'text-amber-700  border-amber-300   bg-amber-50',
  danger:  'text-red-700    border-red-200     bg-red-50',
  info:    'text-blue-700   border-blue-200    bg-blue-50',
  muted:   'text-ink-2      border-line        bg-surface-soft',
  purple:  'text-violet-700 border-violet-200  bg-violet-50',
  // Legacy mappings
  gray:    'text-ink-2      border-line        bg-surface-soft',
  blue:    'text-blue-700   border-blue-200    bg-blue-50',
  green:   'text-accent-ink border-accent-line bg-accent-soft',
  yellow:  'text-amber-700  border-amber-300   bg-amber-50',
  red:     'text-red-700    border-red-200     bg-red-50',
  orange:  'text-amber-700  border-amber-300   bg-amber-50',
  emerald: 'text-accent-ink border-accent-line bg-accent-soft',
  amber:   'text-amber-700  border-amber-300   bg-amber-50',
  stone:   'text-ink-2      border-line        bg-surface-soft',
};

export function Badge({ variant = 'muted', children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-[5px] px-2 py-[2px] text-[11.5px] font-medium rounded-full border whitespace-nowrap',
      'before:content-[""] before:w-[6px] before:h-[6px] before:rounded-full before:bg-current before:flex-shrink-0',
      variantClasses[variant],
      className
    )}>
      {children}
    </span>
  );
}

