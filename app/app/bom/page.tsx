'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import type { BomHeader } from '@/types';
import Link from 'next/link';
import { Button, StatusBadge, SearchInput } from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

interface PaginatedBoms {
  data: BomHeader[];
  total: number;
  page: number;
  limit: number;
}

export default function BomListPage() {
  const [data, setData] = useState<PaginatedBoms | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bomType, setBomType] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchBoms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set('search', search); // Note: API needs to support search if added
      if (bomType) params.set('bom_type', bomType);
      if (!showInactive) params.set('is_active', 'true');

      const res = await get<PaginatedBoms>(`/api/bom?${params}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, bomType, showInactive]);

  useEffect(() => {
    fetchBoms();
  }, [fetchBoms]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-5">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
            สูตรการผลิต / Bill of Materials (BOM)
          </h1>
          <p className="text-[13.5px] text-stone-500">
            {loading ? '—' : (data?.total ?? 0).toLocaleString('th-TH')} สูตร
          </p>
        </div>
        <Link href="/app/bom/new">
          <Button>+ สร้าง BOM ใหม่</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-[300px]">
          <SearchInput
            placeholder="ค้นหาสินค้า หรือ เลขที่ BOM..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={bomType}
          onChange={(e) => { setBomType(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-[8px] border border-stone-200 bg-white text-[13px] text-stone-700 outline-none focus:ring-2 focus:ring-stone-950/5 transition-all"
        >
          <option value="">ทุกประเภท</option>
          <option value="manufacturing">การผลิต (Manufacturing)</option>
          <option value="kit">ชุดสินค้า (Kit)</option>
        </select>
        <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 bg-white cursor-pointer hover:bg-stone-50 transition-colors">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => { setShowInactive(e.target.checked); setPage(1); }}
            className="rounded border-stone-300 text-stone-900 focus:ring-stone-950/5"
          />
          <span className="text-[13px] text-stone-600">แสดงสูตรที่ไม่ได้ใช้งาน</span>
        </label>
      </div>

      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="text-left py-3 px-4">เลขที่ BOM</th>
                <th className="text-left py-3 px-4">สินค้า</th>
                <th className="text-left py-3 px-4">ประเภท</th>
                <th className="text-right py-3 px-4">จำนวนผลผลิต</th>
                <th className="text-center py-3 px-4">เวอร์ชัน</th>
                <th className="text-center py-3 px-4">สถานะ</th>
                <th className="text-center py-3 px-4">จำนวนรายการ</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-stone-600">กำลังโหลด...</td></tr>
              ) : !data || data.data.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-stone-600">ไม่พบข้อมูลสูตรการผลิต</td></tr>
              ) : data.data.map((r) => (
                <tr key={r.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors">
                  <td className="py-4 px-4 font-mono font-medium text-stone-600">{r.bom_number}</td>
                  <td className="py-4 px-4">
                    <div className="font-medium text-stone-900">{r.product_name_th}</div>
                    <div className="text-[11px] text-stone-600 font-mono">{r.product_sku}</div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="capitalize">{r.bom_type}</span>
                  </td>
                  <td className="py-4 px-4 text-right font-mono">
                    {Number(r.output_qty).toLocaleString()} {r.uom_code}
                  </td>
                  <td className="py-4 px-4 text-center font-medium">v{r.version}</td>
                  <td className="py-4 px-4 text-center">
                    <StatusBadge status={r.is_active ? 'active' : 'inactive'} />
                  </td>
                  <td className="py-4 px-4 text-center text-stone-500">{r.line_count} รายการ</td>
                  <td className="py-4 px-4 text-right">
                    <Link href={`/app/bom/${r.id}`} className="text-stone-300 hover:text-emerald-600 transition-colors inline-flex h-8 w-8 items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          limit={pageSize}
          onLimitChange={setPageSize}
        />
      )}
    </div>
  );
}
