'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  limit?: number;
  onLimitChange?: (limit: number) => void;
}

export function Pagination({ page, totalPages, onPageChange, limit, onLimitChange }: PaginationProps) {
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (page <= 4) return i + 1 <= 5 ? i + 1 : totalPages - (6 - i);
    if (page >= totalPages - 3) return i < 2 ? i + 1 : totalPages - (6 - i);
    return i === 0 ? 1 : i === 6 ? totalPages : page - 2 + i;
  });

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      {onLimitChange && (
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
        >
          ←
        </button>
        {pages.map((p, i) => (
          <button
            key={i}
            onClick={() => onPageChange(p)}
            className={`rounded px-3 py-1 text-sm ${
              p === page ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  );
}
