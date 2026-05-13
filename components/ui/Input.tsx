'use client';
import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col">
        {label && (
          <label htmlFor={inputId} className="text-[13px] font-medium text-ink-2 mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'bg-white border border-line rounded-[8px] h-9 px-3 text-[13.5px] text-ink-1 placeholder:text-ink-4 transition-all',
            'focus:outline-none focus:border-accent focus:ring-0 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]',
            error ? 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(220,38,38,0.14)]' : '',
            props.disabled && 'cursor-not-allowed bg-surface-sunken text-ink-3',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-[12px] text-danger">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="mt-1 text-[12px] text-ink-3">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
