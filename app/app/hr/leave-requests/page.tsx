'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import type { LeaveRequest, LeaveRequestStatus } from '@/types';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { Pagination } from '@/components/ui/Pagination';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

interface PaginatedRequests {
  data: LeaveRequest[];
  total: number;
  page: number;
  limit: number;
}

export default function LeaveRequestsPage() {
  const [data, setData] = useState<PaginatedRequests | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | ''>('');
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ 
        page: String(page),
        pageSize: String(pageSize)
      });
      if (statusFilter) params.set('status', statusFilter);
      const res = await get<PaginatedRequests>(`/api/hr/leave-requests?${params}`);
      setData(res);
    } finally { setLoading(false); }
  }, [page, pageSize, statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  const tabs: { label: string; value: LeaveRequestStatus | '' }[] = [
    { label: 'ทั้งหมด', value: '' },
    { label: 'รออนุมัติ', value: 'submitted' },
    { label: 'อนุมัติแล้ว', value: 'approved' },
    { label: 'ปฏิเสธ', value: 'rejected' },
  ];

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-5">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
            รายการลา / Leave Requests
          </h1>
          <p className="text-[13.5px] text-stone-500">
            {loading ? '—' : (data?.total ?? 0).toLocaleString('th-TH')} รายการ
          </p>
        </div>
        <Link href="/app/hr/leave-requests/new" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors">
          + สร้างใบลา
        </Link>
      </div>

      <div className="flex border-b border-stone-200 gap-6">
        {tabs.map((t) => (
          <button
            key={t.label}
            onClick={() => { setStatusFilter(t.value); setPage(1); }}
            className={`pb-3 text-[14px] font-medium transition-colors relative ${
              statusFilter === t.value ? 'text-stone-950' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            {t.label}
            {statusFilter === t.value && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-stone-950 rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {[
                  { h: 'เลขที่คำขอ', sm: false },
                  { h: 'พนักงาน', sm: false },
                  { h: 'ประเภทการลา', sm: false },
                  { h: 'วันที่ลา', sm: false },
                  { h: 'จำนวนวัน', sm: true },
                  { h: 'สถานะ', sm: false },
                  { h: '', sm: false },
                ].map(({ h, sm }, i) => (
                  <th key={i} className={`text-left py-2.5 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-400 bg-stone-50 border-y border-stone-200 first:pl-5 last:pr-5 ${sm ? 'hidden lg:table-cell' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-stone-400">กำลังโหลด...</td></tr>
              ) : !data || data.data.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-stone-400">ไม่พบรายการลา</td></tr>
              ) : data.data.map((r) => (
                <tr key={r.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-default transition-colors">
                  <td className="py-0 h-12 px-3.5 pl-5 font-mono text-stone-600">{r.request_number}</td>
                  <td className="py-0 h-12 px-3.5 font-medium text-stone-900">
                    <div>{r.employee_name_th}</div>
                    <div className="text-[11px] text-stone-400 font-normal">{r.employee_name_en}</div>
                  </td>
                  <td className="py-0 h-12 px-3.5 text-stone-600">{r.leave_type_name_th}</td>
                  <td className="py-0 h-12 px-3.5 text-stone-500 whitespace-nowrap">
                    {formatDate(r.start_date)} - {formatDate(r.end_date)}
                  </td>
                  <td className="py-0 h-12 px-3.5 text-stone-600 hidden lg:table-cell">{Number(r.days_requested).toFixed(1)} วัน</td>
                  <td className="py-0 h-12 px-3.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-0 h-12 px-3.5 pr-5 text-right">
                    <Link href={`/app/hr/leave-requests/${r.id}`} className="text-stone-300 hover:text-emerald-600 transition-colors inline-flex h-8 w-8 items-center justify-center">
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
