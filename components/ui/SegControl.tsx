'use client';

interface SegControlProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}

export function SegControl({ options, value, onChange }: SegControlProps) {
  return (
    <div className="inline-flex bg-surface-sunken border border-line rounded-lg p-0.5 gap-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          className={`h-[26px] px-[11px] rounded-md text-[12.5px] font-medium transition-all ${
            value === opt.value
              ? 'bg-white text-ink shadow-1'
              : 'text-ink-3 hover:text-ink-1'
          }`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
