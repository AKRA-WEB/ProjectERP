import { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TableProps {
  children: ReactNode;
  className?: string;
  loading?: boolean;
  headers?: string[];
}

export function Table({ children, className, loading, headers }: TableProps) {
  // If high-level props are provided, use them
  if (headers || loading !== undefined) {
    return (
      <div className={cn('w-full overflow-x-auto bg-surface', className)}>
        <table className="w-full border-collapse text-[13px]">
          {headers && (
            <Thead>
              <tr>
                {headers.map((h, i) => (
                  <Th key={i} className={cn(i === headers.length - 1 && 'text-right')}>
                    {h}
                  </Th>
                ))}
              </tr>
            </Thead>
          )}
          <Tbody>
            {loading ? (
              <tr>
                <td colSpan={headers?.length || 10} className="py-20 text-center text-ink-3">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
                    <span>กำลังโหลดข้อมูล...</span>
                  </div>
                </td>
              </tr>
            ) : (
              children
            )}
          </Tbody>
        </table>
      </div>
    );
  }

  // Otherwise, behave as a simple wrapper for low-level components
  return (
    <div className={cn('w-full overflow-x-auto bg-surface', className)}>
      <table className="w-full border-collapse text-[13px]">
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="bg-surface-soft border-y border-line">{children}</thead>;
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line-soft">{children}</tbody>;
}

export function Th({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-5 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-[0.04em] text-ink-3 whitespace-nowrap',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-5 py-4 text-ink-1 align-middle border-b border-line-soft', className)}
      {...props}
    >
      {children}
    </td>
  );
}
