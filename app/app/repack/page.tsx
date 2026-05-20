'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import type { RepackOrder, PaginatedResponse } from '@/types';
import Link from 'next/link';
import { Button, StatusBadge, KpiCard, KpiGrid } from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function RepackListPage() {
  const [data, setData] = useState<PaginatedResponse<RepackOrder> | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchRepackOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (status) params.set('status', status);

      const res = await get<PaginatedResponse<RepackOrder>>(`/api/repack?${params}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status]);

  useEffect(() => {
    fetchRepackOrders();
  }, [fetchRepackOrders]);

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
            การแบ่งบรรจุสินค้า (Repack Orders)
          </h1>
          <p className="text-[13.5px] text-stone-500">
            {loading ? '—' : (data?.total ?? 0).toLocaleString('th-TH')} รายการ
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/app/repack/templates">
            <Button variant="outline">สูตรการแบ่ง (Templates)</Button>
          </Link>
          <Link href="/app/repack/new">
            <Button variant="primary">+ สร้างใบแบ่งบรรจุใหม่</Button>
          </Link>
        </div>
      </div>

      <KpiGrid className="mb-6">
        <KpiCard label="รอการดำเนินการ" value={data?.data.filter(r => r.status === 'draft').length || 0} subValue="รายการ" />
        <KpiCard label="แบ่งบรรจุแล้ว" value={data?.data.filter(r => r.status === 'completed').length || 0} subValue="รายการ" />
        <KpiCard label="ทั้งหมด" value={data?.total || 0} subValue="รายการ" />
      </KpiGrid>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-[8px] border border-stone-200 bg-white text-[13px] text-stone-700 outline-none focus:ring-2 focus:ring-stone-950/5 transition-all"
        >
          <option value="">ทุกสถานะ</option>
          <option value="draft">ร่าง (Draft)</option>
          <option value="completed">เสร็จสมบูรณ์ (Completed)</option>
          <option value="void">ยกเลิก (Void)</option>
        </select>
      </div>

      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="text-left py-3 px-4">เลขที่เอกสาร</th>
                <th className="text-left py-3 px-4">สินค้าต้นทาง (ลัง/กระสอบ)</th>
                <th className="text-right py-3 px-4">จำนวนที่แบ่ง</th>
                <th className="text-center py-3 px-4">คลังสินค้า</th>
                <th className="text-center py-3 px-4">สถานะ</th>
                <th className="text-left py-3 px-4">วันที่ทำรายการ</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-stone-600">กำลังโหลด...</td></tr>
              ) : !data || data.data.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-stone-600">ไม่พบรายการแบ่งบรรจุ</td></tr>
              ) : data.data.map((r) => (
                <tr key={r.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors">
                  <td className="py-4 px-4 font-mono font-medium text-stone-600">{r.order_number}</td>
                  <td className="py-4 px-4">
                    <div className="font-medium text-stone-900">{r.source_product_name_th}</div>
                    <div className="text-[11px] text-stone-600 font-mono">{r.source_product_sku}</div>
                  </td>
                  <td className="py-4 px-4 text-right font-mono">
                    {Number(r.source_qty).toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-center text-stone-600">{r.warehouse_name_th}</td>
                  <td className="py-4 px-4 text-center">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-4 px-4 text-stone-500">
                    {formatDate(r.created_at)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <Link href={`/app/repack/${r.id}`} className="text-stone-300 hover:text-emerald-600 transition-colors inline-flex h-8 w-8 items-center justify-center">
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
          totalPages={data.total_pages}
          onPageChange={setPage}
          limit={pageSize}
          onLimitChange={setPageSize}
        />
      )}
    </div>
  );
}
