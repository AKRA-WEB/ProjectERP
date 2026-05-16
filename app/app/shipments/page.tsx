'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { get } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/ui';
import type { PaginatedResponse, Shipment } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

const TABS = [
  { id: '',          label: 'ทั้งหมด' },
  { id: 'shipped',   label: 'จัดส่งแล้ว' },
  { id: 'delivered', label: 'สำเร็จ' },
];

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function ShipmentsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<PaginatedResponse<Shipment> | null>(null);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchShipments = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (tab) params.set('status', tab);
      const res = await get<PaginatedResponse<Shipment>>(`/api/shipments?${params}`);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch shipments:', err);
    } finally {
      setLoading(false);
    }
  }, [page, tab, session]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              รายการจัดส่งสินค้า
            </h1>
            <p className="text-[13.5px] text-stone-500">
              Shipments · {loading ? '—' : (data?.total ?? 0).toLocaleString('th-TH')} รายการ
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-stone-200 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setPage(1); }}
              className={`px-3.5 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'text-stone-950 border-stone-950'
                  : 'text-stone-400 border-transparent hover:text-stone-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table card */}
        <div className={CARD}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {[
                  { h: 'เลขใบจัดส่ง',     sm: false },
                  { h: 'อ้างอิงใบหยิบ',    sm: true },
                  { h: 'คลังสินค้า',      sm: true },
                  { h: 'วันที่จัดส่ง',     sm: true },
                  { h: 'ผู้ส่งสินค้า',      sm: true },
                  { h: 'สถานะ',         sm: false },
                  { h: '',              sm: false },
                ].map(({ h, sm }, i) => (
                  <th key={i} className={`text-left py-2.5 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-400 bg-stone-50 border-y border-stone-200 first:pl-5 last:pr-5 ${sm ? 'hidden lg:table-cell' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-[13px] text-stone-400">กำลังโหลด...</td></tr>
              ) : data?.data.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-[13px] text-stone-400">ไม่พบรายการ</td></tr>
              ) : data?.data.map((s) => (
                <tr key={s.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-default transition-colors">
                  <td className="py-0 h-11 px-3.5 pl-5 font-mono text-[12.5px] font-medium text-stone-700">{s.shipment_number}</td>
                  <td className="py-0 h-11 px-3.5 font-mono text-[12.5px] text-blue-600 hidden lg:table-cell">
                    <Link href={`/app/picking/${s.pick_list_id}`} transitionTypes={['nav-forward']} className="hover:underline">{s.pick_number}</Link>
                  </td>
                  <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell">{s.warehouse_name}</td>
                  <td className="py-0 h-11 px-3.5 text-stone-500 font-mono text-[12.5px] hidden lg:table-cell">{s.ship_date ? formatDate(s.ship_date) : '—'}</td>
                  <td className="py-0 h-11 px-3.5 text-stone-700 hidden lg:table-cell">{s.shipped_by_name || '—'}</td>
                  <td className="py-0 h-11 px-3.5"><StatusBadge status={s.status} /></td>
                  <td className="py-0 h-11 px-3.5 pr-5">
                    <Link href={`/app/shipments/${s.id}`} transitionTypes={['nav-forward']} className="text-stone-300 hover:text-stone-900 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between text-[13px] text-stone-500">
            <span>หน้า {page} จาก {data.total_pages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none">
                ← ก่อนหน้า
              </button>
              <button onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))} disabled={page === data.total_pages}
                className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none">
                ถัดไป →
              </button>
            </div>
          </div>
        )}
      </div>
    </DirectionalTransition>
  );
}
