'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/format';
import type { ApPayment } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { useSession } from 'next-auth/react';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function ApPaymentsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [data, setData] = useState<{ payments: ApPayment[]; total: number; total_pages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      const res = await get<{ payments: ApPayment[]; total: number; total_pages: number }>(`/api/ap/payments?${params}`);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  return (
    <DirectionalTransition>
    <div className="max-w-[1440px] mx-auto pb-12 space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
            รายการชำระเจ้าหนี้ / AP Payments
          </h1>
          <p className="text-[13.5px] text-stone-500">
            AP Payments Log · {loading ? '—' : (data?.total ?? 0).toLocaleString('th-TH')} รายการ
          </p>
        </div>
        {role !== 'auditor' && (
          <div className="flex items-center gap-2">
            <Link
              href="/app/ap/payments/new"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors"
            >
              + บันทึกการชำระเงิน
            </Link>
          </div>
        )}
      </div>

      {/* Table card */}
      <div className={CARD}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {['เลขที่ชำระ', 'Vendor', 'วันที่ชำระ', 'ยอดชำระ', 'อ้างอิงธนาคาร', 'ผู้บันทึก', ''].map((h, i) => (
                <th key={i} className={`text-left py-2.5 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-600 bg-stone-50 border-b border-y border-stone-200 first:pl-5 last:pr-5 ${i === 3 ? 'text-right' : ''} ${[2, 4, 5].includes(i) ? 'hidden lg:table-cell' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-stone-600">กำลังโหลด...</td></tr>
            ) : data?.payments.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-stone-600">ไม่พบรายการ</td></tr>
            ) : data?.payments.map((pmt) => (
              <tr
                key={pmt.id}
                className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-default transition-colors group"
              >
                <td className="py-0 h-11 px-3.5 pl-5 font-mono text-[12.5px] text-stone-700 font-medium">
                  <Link href={`/app/ap/payments/${pmt.id}`} className="hover:text-blue-600 hover:underline">
                    {pmt.payment_number}
                  </Link>
                </td>
                <td className="py-0 h-11 px-3.5">
                  <div className="font-medium text-stone-900">{pmt.vendor_name_th}</div>
                </td>
                <td className="py-0 h-11 px-3.5 text-stone-500 font-mono text-[12.5px] hidden lg:table-cell">{formatDate(pmt.payment_date)}</td>
                <td className="py-0 h-11 px-3.5 text-right font-mono tabular-nums text-emerald-700 font-semibold">{formatCurrency(pmt.total_amount)}</td>
                <td className="py-0 h-11 px-3.5 text-stone-500 truncate max-w-[200px] hidden lg:table-cell">{pmt.bank_ref || '—'}</td>
                <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell">{pmt.paid_by_name}</td>
                <td className="py-0 h-11 px-3.5 pr-5 text-stone-300 group-hover:text-stone-600 text-right">
                  <Link href={`/app/ap/payments/${pmt.id}`} transitionTypes={['nav-forward']}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
              className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none text-[13px]">
              ← ก่อนหน้า
            </button>
            <button onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))} disabled={page === data.total_pages}
              className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none text-[13px]">
              ถัดไป →
            </button>
          </div>
        </div>
      )}
    </div>
    </DirectionalTransition>
  );
}
