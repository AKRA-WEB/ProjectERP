'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/format';
import type { ApPayment } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

interface Allocation {
  id: string;
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_total: number;
  allocated_amount: number;
}

interface ApPaymentDetail extends ApPayment {
  allocations: Allocation[];
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function ApPaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [payment, setPayment] = useState<ApPaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPayment = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<ApPaymentDetail>(`/api/ap/payments/${id}`);
      setPayment(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPayment(); }, [fetchPayment]);

  if (loading) return <div className="py-16 text-center text-stone-400">กำลังโหลด...</div>;
  if (!payment) return <div className="py-16 text-center text-stone-400">ไม่พบข้อมูลการชำระเงิน</div>;

  return (
    <DirectionalTransition>
    <div className="max-w-4xl mx-auto pb-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button className="text-sm text-stone-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
          <h1 className="text-2xl font-bold text-stone-900 font-mono">
            {payment.payment_number}
          </h1>
          <p className="text-sm text-stone-500">AP Payment Detail</p>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">ยอดชำระรวม</p>
          <p className="text-2xl font-bold text-emerald-700 font-mono">{formatCurrency(payment.total_amount)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Summary */}
        <div className="md:col-span-2 space-y-6">
          {/* Main Info */}
          <div className={`${CARD} p-6`}>
            <h2 className="text-[15px] font-semibold text-stone-800 mb-4 pb-4 border-b border-stone-100">ข้อมูลการชำระเงิน</h2>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-xs text-stone-400 mb-1">ผู้จำหน่าย / Vendor</p>
                <Link href={`/app/vendors/${payment.vendor_id}`} className="text-sm font-medium text-blue-600 hover:underline font-mono">
                  {payment.vendor_name_th}
                </Link>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">วันที่ชำระเงิน</p>
                <p className="text-sm font-medium">{formatDate(payment.payment_date)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">อ้างอิงธนาคาร / Ref.</p>
                <p className="text-sm font-medium font-mono">{payment.bank_ref || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">ผู้บันทึกรายการ</p>
                <p className="text-sm font-medium">{payment.paid_by_name}</p>
              </div>
            </div>
            {payment.notes && (
              <div className="mt-4 pt-4 border-t border-stone-50">
                <p className="text-xs text-stone-400 mb-1">หมายเหตุ</p>
                <p className="text-[13px] text-stone-600 leading-relaxed">{payment.notes}</p>
              </div>
            )}
          </div>

          {/* Allocation Details */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="p-6 pb-2">
              <h2 className="text-[15px] font-semibold text-stone-800">รายการใบแจ้งหนี้ที่ชำระ (Allocations)</h2>
            </div>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-stone-50 border-y border-stone-200">
                  <th className="text-left py-2.5 px-6 font-medium text-stone-500">เลขที่ใบแจ้งหนี้</th>
                  <th className="text-left py-2.5 px-4 font-medium text-stone-500">วันที่ใบแจ้งหนี้</th>
                  <th className="text-right py-2.5 px-4 font-medium text-stone-500">ยอดรวมใบแจ้งหนี้</th>
                  <th className="text-right py-2.5 px-6 font-medium text-stone-500">จำนวนที่ชำระครั้งนี้</th>
                </tr>
              </thead>
              <tbody>
                {payment.allocations.map((alloc) => (
                  <tr key={alloc.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                    <td className="py-3 px-6 font-mono text-blue-600">
                      <Link href={`/app/ap/${alloc.invoice_id}`} className="hover:underline">
                        {alloc.invoice_number}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-stone-500">{formatDate(alloc.invoice_date)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-500">{formatCurrency(alloc.invoice_total)}</td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums font-semibold text-stone-900">{formatCurrency(alloc.allocated_amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-stone-50/50 font-bold border-t border-stone-200">
                <tr>
                  <td colSpan={3} className="py-3 px-6 text-right text-stone-500 uppercase tracking-wider text-[11px]">รวมยอดจัดสรร</td>
                  <td className="py-3 px-6 text-right font-mono tabular-nums text-stone-900">{formatCurrency(payment.total_amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Right Column: Audit Trail */}
        <div className="space-y-6">
          <div className={`${CARD} p-6`}>
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">ประวัติการทำรายการ</h3>
            <div className="relative pl-4 border-l border-stone-200 space-y-6">
              <div className="relative">
                <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></div>
                <p className="text-[13px] font-medium text-stone-900 leading-none">บันทึกการชำระเงินสำเร็จ</p>
                <p className="text-[11px] text-stone-400 mt-1">{formatDate(payment.created_at)}</p>
                <p className="text-[11px] text-stone-500 mt-1">โดย {payment.paid_by_name}</p>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => window.print()}
            className="w-full h-10 px-4 rounded-[8px] border border-stone-200 bg-white text-stone-600 text-[13px] font-medium shadow-[0_1px_0_rgba(15,23,42,.03)] hover:bg-stone-50 inline-flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            พิมพ์ใบสำคัญจ่าย
          </button>
        </div>
      </div>
    </div>
    </DirectionalTransition>
  );
}
