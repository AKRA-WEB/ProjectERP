'use client';

interface TabsProps {
  children: React.ReactNode;
}

export function Tabs({ children }: TabsProps) {
  return (
    <div className="flex border-b border-line mb-[var(--gap-section)]">
      {children}
    </div>
  );
}

interface TabProps {
  active?: boolean;
  onClick?: () => void;
  count?: number;
  children: React.ReactNode;
}

export function Tab({ active, onClick, count, children }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px inline-flex items-center gap-1.5 transition-colors ${
        active ? 'text-ink border-ink' : 'text-ink-3 border-transparent hover:text-ink-1'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className="font-mono text-[10.5px] px-[5px] py-px bg-surface-sunken text-ink-3 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}
