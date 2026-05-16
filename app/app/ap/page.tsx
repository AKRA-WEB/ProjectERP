'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/format';
import { StatusBadge } from '@/components/ui';
import type { ApInvoice } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

const TABS = [
  { id: '', label: 'ทั้งหมด' },
  { id: 'false', label: 'ค้างชำระ' },
  { id: 'true', label: 'ชำระแล้ว' },
];

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function ApInvoicesPage() {
  const [data, setData] = useState<{ invoices: ApInvoice[]; total: number; total_pages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [isPaid, setIsPaid] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (isPaid) params.set('is_paid', isPaid);
      const res = await get<{ invoices: ApInvoice[]; total: number; total_pages: number }>(`/api/ap/invoices?${params}`);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, isPaid]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              เจ้าหนี้การค้า / Accounts Payable
            </h1>
            <p className="text-[13.5px] text-stone-500">
              AP Invoices · {loading ? '—' : (data?.total ?? 0).toLocaleString('th-TH')} รายการ
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app/ap/aging"
              transitionTypes={['nav-forward']}
              className="h-8 px-3 rounded-[7px] text-[13px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)] inline-flex items-center gap-1.5"
            >
              รายงานอายุหนี้
            </Link>
            <Link
              href="/app/ap/payments/new"
              transitionTypes={['nav-forward']}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors"
            >
              + บันทึกการชำระเงิน
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-stone-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setIsPaid(t.id); setPage(1); }}
              className={`px-3.5 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors ${
                isPaid === t.id
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
                {['เลขที่ใบแจ้งหนี้', 'Vendor', 'วันที่รับ', 'วันครบกำหนด', 'ยอดรวม', 'ชำระแล้ว', 'คงเหลือ', 'สถานะ', ''].map((h, i) => (
                  <th key={i} className={`text-left py-2.5 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-400 bg-stone-50 border-b border-y border-stone-200 first:pl-5 last:pr-5 ${[4, 5, 6].includes(i) ? 'text-right' : ''} ${[2, 3, 5, 6].includes(i) ? 'hidden lg:table-cell' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center text-[13px] text-stone-400">กำลังโหลด...</td></tr>
              ) : data?.invoices.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-[13px] text-stone-400">ไม่พบรายการ</td></tr>
              ) : data?.invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-default transition-colors group"
                >
                  <td className="py-0 h-11 px-3.5 pl-5 font-mono text-[12.5px] text-stone-700 font-medium">
                    <Link href={`/app/ap/${inv.id}`} transitionTypes={['nav-forward']} className="hover:text-blue-600 hover:underline">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="py-0 h-11 px-3.5">
                    <div className="font-medium text-stone-900">{inv.vendor_name_th}</div>
                    <div className="text-[11px] text-stone-400 font-mono">{inv.vendor_code}</div>
                  </td>
                  <td className="py-0 h-11 px-3.5 text-stone-500 font-mono text-[12.5px] hidden lg:table-cell">{formatDate(inv.invoice_date)}</td>
                  <td className="py-0 h-11 px-3.5 text-stone-500 font-mono text-[12.5px] hidden lg:table-cell">{formatDate(inv.due_date)}</td>
                  <td className="py-0 h-11 px-3.5 text-right font-mono tabular-nums text-stone-900 font-medium">{formatCurrency(inv.amount)}</td>
                  <td className="py-0 h-11 px-3.5 text-right font-mono tabular-nums text-emerald-700 hidden lg:table-cell">{formatCurrency(inv.paid_amount)}</td>
                  <td className="py-0 h-11 px-3.5 text-right font-mono tabular-nums text-red-600 hidden lg:table-cell font-medium">{formatCurrency(inv.outstanding_amount)}</td>
                  <td className="py-0 h-11 px-3.5">
                    {inv.is_paid ? (
                      <StatusBadge status="paid" labelOverride="ชำระแล้ว" />
                    ) : inv.overdue_days > 0 ? (
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status="rejected" labelOverride="ค้างชำระ" />
                        <span className="text-[10px] text-red-500 font-medium whitespace-nowrap">เกินกำหนด {inv.overdue_days} วัน</span>
                      </div>
                    ) : (
                      <StatusBadge status="processing" labelOverride="ยังไม่ครบกำหนด" />
                    )}
                  </td>
                  <td className="py-0 h-11 px-3.5 pr-5 text-stone-300 group-hover:text-stone-400 text-right">
                    <Link href={`/app/ap/${inv.id}`} transitionTypes={['nav-forward']}>
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
