'use client';

interface PaginationProps {
  page?: number;
  currentPage?: number; // Alias for page
  totalPages: number;
  onPageChange: (page: number) => void;
  limit?: number;
  onLimitChange?: (limit: number) => void;
}

export function Pagination({ page, currentPage, totalPages, onPageChange, limit, onLimitChange }: PaginationProps) {
  const activePage = page ?? currentPage ?? 1;

  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (activePage <= 4) return i + 1 <= 5 ? i + 1 : totalPages - (6 - i);
    if (activePage >= totalPages - 3) return i < 2 ? i + 1 : totalPages - (6 - i);
    return i === 0 ? 1 : i === 6 ? totalPages : activePage - 2 + i;
  });

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      {onLimitChange && (
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="rounded-[7px] border border-line px-2 py-1 text-[13px] text-ink-2 bg-white"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => onPageChange(activePage - 1)}
          disabled={activePage <= 1}
          className="rounded-[7px] px-2 py-1 text-sm text-ink-3 hover:bg-surface-sunken disabled:opacity-40"
        >
          ←
        </button>
        {pages.map((p, i) => (
          <button
            key={i}
            onClick={() => onPageChange(p)}
            className={`rounded-[7px] px-3 py-1 text-sm transition-colors ${
              p === activePage ? 'bg-ink text-white shadow-1' : 'text-ink-2 hover:bg-surface-sunken'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(activePage + 1)}
          disabled={activePage >= totalPages}
          className="rounded-[7px] px-2 py-1 text-sm text-ink-3 hover:bg-surface-sunken disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  );
}

