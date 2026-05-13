'use client';
import { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col">
        {label && (
          <label htmlFor={selectId} className="text-[13px] font-medium text-ink-2 mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'bg-white border border-line rounded-[8px] h-9 px-3 text-[13.5px] text-ink-1 transition-all appearance-none',
            'focus:outline-none focus:border-accent focus:ring-0 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]',
            error ? 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(220,38,38,0.14)]' : '',
            props.disabled && 'cursor-not-allowed bg-surface-sunken text-ink-3',
            className
          )}
          aria-invalid={!!error}
          {...props}
        >
          {options != null ? (
            <>
              {placeholder && <option value="">{placeholder}</option>}
              {options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </>
          ) : (
            children
          )}
        </select>
        {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
