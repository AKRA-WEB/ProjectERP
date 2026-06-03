'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { get } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { SessionUser } from '@/lib/authz';
import type { PaginatedResponse, PickList } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

const PICK_STATUSES: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'ฉบับร่าง',   cls: 'muted' },
  open:      { label: 'รอการหยิบ',   cls: 'info' },
  picking:   { label: 'กำลังหยิบ',   cls: 'warn' },
  completed: { label: 'หยิบครบแล้ว', cls: 'ok' },
  cancelled: { label: 'ยกเลิก',      cls: 'danger' },
};

const PILL_COLORS: Record<string, string> = {
  ok:     'text-emerald-700 border-emerald-200 bg-emerald-50',
  warn:   'text-amber-700 border-amber-300 bg-amber-50',
  danger: 'text-red-700 border-red-200 bg-red-50',
  info:   'text-blue-700 border-blue-200 bg-blue-50',
  muted:  'text-stone-500 border-stone-200 bg-stone-50',
};

function Pill({ status }: { status: string }) {
  const s = PICK_STATUSES[status] ?? { label: status, cls: 'muted' };
  return (
    <span className={`inline-flex items-center gap-[5px] px-2 py-[2px] text-[11.5px] font-medium rounded-full border leading-[1.5] whitespace-nowrap before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-current ${PILL_COLORS[s.cls]}`}>
      {s.label}
    </span>
  );
}

const TABS = [
  { id: '',          label: 'ทั้งหมด' },
  { id: 'open',      label: 'รอการหยิบ' },
  { id: 'picking',   label: 'กำลังหยิบ' },
  { id: 'completed', label: 'สำเร็จ' },
];

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function PickingPage() {
  const { data: session } = useSession();
  const currentUser = session?.user as unknown as SessionUser;
  const [data, setData] = useState<PaginatedResponse<PickList> | null>(null);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPickLists = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (tab) params.set('status', tab);
      
      // If staff, only show their assigned pick lists
      if (currentUser.role === 'staff') {
        params.set('assigned_to', currentUser.id);
      }

      const res = await get<PaginatedResponse<PickList>>(`/api/pick-lists?${params}`);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch pick lists:', err);
    } finally {
      setLoading(false);
    }
  }, [page, tab, currentUser]);

  useEffect(() => {
    fetchPickLists();
  }, [fetchPickLists]);

  const canCreate = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              รายการหยิบสินค้า
            </h1>
            <p className="text-[13.5px] text-stone-500">
              Pick Lists · {loading ? '—' : (data?.total ?? 0).toLocaleString('th-TH')} รายการ
            </p>
          </div>
          {canCreate && (
            <Link
              href="/app/picking/new"
              transitionTypes={['nav-forward']}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors"
            >
              + สร้างรายการหยิบ
            </Link>
          )}
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
                  { h: 'เลขรายการหยิบ', sm: false },
                  { h: 'อ้างอิง SO',     sm: true },
                  { h: 'คลังสินค้า',    sm: true },
                  { h: 'ผู้รับผิดชอบ',    sm: true },
                  { h: 'สถานะ',         sm: false },
                  { h: 'วันที่สร้าง',    sm: true },
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
              ) : data?.data.map((pl) => (
                <tr key={pl.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-default transition-colors">
                  <td className="py-0 h-11 px-3.5 pl-5 font-mono text-[12.5px] font-medium text-stone-700">{pl.pick_number}</td>
                  <td className="py-0 h-11 px-3.5 text-blue-600 font-mono text-[12.5px] hidden lg:table-cell">
                    {pl.sales_order_id ? (
                      <Link href={`/app/sales-orders/${pl.sales_order_id}`} transitionTypes={['nav-forward']} className="hover:underline">{pl.so_number}</Link>
                    ) : '—'}
                  </td>
                  <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell">{pl.warehouse_name}</td>
                  <td className="py-0 h-11 px-3.5 text-stone-700 hidden lg:table-cell">{pl.assigned_to_name || '—'}</td>
                  <td className="py-0 h-11 px-3.5"><Pill status={pl.status} /></td>
                  <td className="py-0 h-11 px-3.5 text-stone-400 font-mono text-[12.5px] hidden lg:table-cell">{formatDate(pl.created_at)}</td>
                  <td className="py-0 h-11 px-3.5 pr-5">
                    <Link href={`/app/picking/${pl.id}`} transitionTypes={['nav-forward']} className="text-stone-300 hover:text-emerald-600 transition-colors">
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
