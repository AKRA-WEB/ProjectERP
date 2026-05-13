'use client';
import { InputHTMLAttributes, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
  debounceMs?: number;
}

export function SearchInput({ 
  onSearch, 
  debounceMs = 300, 
  className, 
  value: controlledValue,
  onChange: controlledOnChange,
  ...props 
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState('');
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!onSearch) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(String(value)), debounceMs);
    return () => clearTimeout(timer.current);
  }, [value, debounceMs, onSearch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (controlledOnChange) {
      controlledOnChange(e);
    } else {
      setInternalValue(e.target.value);
    }
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={handleChange}
        className={cn(
          'w-full rounded-[7px] border border-line py-2 pl-9 pr-3 text-[13px] bg-white text-ink-1 shadow-sm focus:outline-none focus:border-accent focus:ring-0 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]',
          className
        )}
        {...props}
      />
    </div>
  );
}

