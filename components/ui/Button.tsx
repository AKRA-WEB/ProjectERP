'use client';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:   'bg-ink text-white border border-ink hover:bg-ink-1 shadow-1',
  accent:    'bg-accent text-white border border-accent hover:bg-accent-ink shadow-1',
  secondary: 'bg-white text-ink-1 border border-line hover:bg-surface-soft hover:border-line-strong shadow-1',
  danger:    'bg-red-600 text-white border border-red-600 hover:bg-red-700 shadow-1',
  ghost:     'bg-transparent text-ink-2 border border-transparent hover:bg-surface-sunken',
  outline:   'bg-white text-ink-1 border border-line hover:bg-surface-soft hover:border-line-strong shadow-1', // Alias for secondary
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-[26px] px-[9px] text-[12px] rounded-[6px]',
  md: 'h-8 px-3 text-[13px] rounded-[7px]',
  lg: 'h-10 px-4 text-[14px] rounded-[8px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, disabled, className, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-[7px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
