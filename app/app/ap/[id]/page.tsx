'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/format';
import { StatusBadge } from '@/components/ui';
import type { ApInvoice } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

interface Allocation {
  id: string;
  payment_id: string;
  payment_number: string;
  payment_date: string;
  bank_ref: string | null;
  allocated_amount: number;
}

interface Variance {
  id: string;
  variance_type: string;
  po_value: number | string;
  gr_value: number | string;
  invoice_value: number | string;
  created_at: string;
}

interface ApInvoiceDetail extends ApInvoice {
  allocations: Allocation[];
  match_status: 'pending' | 'matched' | 'mismatched';
  variances: Variance[];
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function ApInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<ApInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<ApInvoiceDetail>(`/api/ap/invoices/${id}`);
      setInvoice(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  if (loading) return <div className="py-16 text-center text-stone-600">กำลังโหลด...</div>;
  if (!invoice) return <div className="py-16 text-center text-stone-600">ไม่พบข้อมูลใบแจ้งหนี้</div>;

  return (
    <DirectionalTransition>
    <div className="max-w-4xl mx-auto pb-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button className="text-sm text-stone-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
          <h1 className="text-2xl font-bold text-stone-900 font-mono">
            {invoice.invoice_number}
          </h1>
          <p className="text-sm text-stone-500">AP Invoice Detail</p>
        </div>
        <div className="flex items-center gap-3">
          {invoice.match_status === 'matched' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              ✓ Matched (3-Way)
            </span>
          ) : invoice.match_status === 'mismatched' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
              ⚠️ Mismatched (3-Way)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
              ⏳ Pending Match
            </span>
          )}

          {invoice.is_paid ? (
            <StatusBadge status="paid" labelOverride="ชำระแล้ว" />
          ) : invoice.overdue_days > 0 ? (
            <StatusBadge status="rejected" labelOverride="ค้างชำระ" />
          ) : (
            <StatusBadge status="processing" labelOverride="ยังไม่ครบกำหนด" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Summary */}
        <div className="md:col-span-2 space-y-6">
          {/* Main Info */}
          <div className={`${CARD} p-6`}>
            <h2 className="text-[15px] font-semibold text-stone-800 mb-4 pb-4 border-b border-stone-100">ข้อมูลใบแจ้งหนี้</h2>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-xs text-stone-600 mb-1">ผู้จำหน่าย / Vendor</p>
                <Link href={`/app/vendors/${invoice.vendor_id}`} className="text-sm font-medium text-blue-600 hover:underline font-mono">
                  [{invoice.vendor_code}] {invoice.vendor_name_th}
                </Link>
              </div>
              <div>
                <p className="text-xs text-stone-600 mb-1">วันที่รับใบแจ้งหนี้</p>
                <p className="text-sm font-medium">{formatDate(invoice.invoice_date)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-600 mb-1">วันครบกำหนด / Due Date</p>
                <p className={`text-sm font-medium ${invoice.overdue_days > 0 && !invoice.is_paid ? 'text-red-600' : ''}`}>
                  {formatDate(invoice.due_date)}
                  {invoice.overdue_days > 0 && !invoice.is_paid && (
                    <span className="ml-2 text-[11px] font-bold text-red-500 uppercase tracking-wider">(เกินกำหนด {invoice.overdue_days} วัน)</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-600 mb-1">อ้างอิงเอกสาร</p>
                <div className="flex gap-3">
                  {invoice.po_number && (
                    <Link href={`/app/purchase-orders/${invoice.po_id}`} className="text-[12px] font-mono text-stone-600 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded">
                      PO: {invoice.po_number}
                    </Link>
                  )}
                  {invoice.grn_number && (
                    <Link href={`/app/grn/${invoice.grn_id}`} className="text-[12px] font-mono text-stone-600 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded">
                      GRN: {invoice.grn_number}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>


          {/* Variance Warning & Card */}
          {invoice.variances && invoice.variances.length > 0 && (
            <div className={`${CARD} border-red-200 bg-red-50/10 overflow-hidden`}>
              <div className="p-6 pb-2 border-b border-red-100 bg-red-50/20 flex justify-between items-center">
                <h2 className="text-[15px] font-semibold text-red-950 flex items-center gap-2">
                  <span>⚠️ รายการผลต่างความต่าง (3-Way Match Variance)</span>
                </h2>
                <span className="text-xs font-mono font-bold text-red-600 bg-red-100/50 px-2 py-0.5 rounded">
                  STRICT BLOCK
                </span>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-xs text-red-700 leading-relaxed">
                  ระบบตรวจพบความแตกต่างระหว่างยอดเงินในใบแจ้งหนี้ (Invoice Amount) และยอดเงินรับจาก Goods Receipt Note (GRN Total) 
                  การชำระเงินถูกระงับจนกว่าจะได้รับการแก้ไขหรืออนุมัติความคลาดเคลื่อนนี้
                </p>
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-stone-50 border-y border-stone-200">
                      <th className="text-left py-2.5 px-4 font-medium text-stone-500">ประเภทความต่าง</th>
                      <th className="text-right py-2.5 px-4 font-medium text-stone-500">ยอด PO</th>
                      <th className="text-right py-2.5 px-4 font-medium text-stone-500">ยอด GR (รับสินค้า)</th>
                      <th className="text-right py-2.5 px-4 font-medium text-stone-500">ยอดใน Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.variances.map((v) => (
                      <tr key={v.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                        <td className="py-3 px-4 text-stone-800 font-medium">
                          {v.variance_type === 'header_amount' ? 'ยอดรวมเอกสาร (Header Amount)' : v.variance_type}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-stone-500">{formatCurrency(v.po_value)}</td>
                        <td className="py-3 px-4 text-right font-mono text-stone-500 font-semibold">{formatCurrency(v.gr_value)}</td>
                        <td className="py-3 px-4 text-right font-mono text-red-600 font-bold">{formatCurrency(v.invoice_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payment History */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="p-6 pb-2">
              <h2 className="text-[15px] font-semibold text-stone-800">ประวัติการชำระเงิน</h2>
            </div>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-stone-50 border-y border-stone-200">
                  <th className="text-left py-2.5 px-6 font-medium text-stone-500">เลขที่ชำระ</th>
                  <th className="text-left py-2.5 px-4 font-medium text-stone-500">วันที่</th>
                  <th className="text-left py-2.5 px-4 font-medium text-stone-500">อ้างอิง</th>
                  <th className="text-right py-2.5 px-6 font-medium text-stone-500">จำนวนที่ตัดจ่าย</th>
                </tr>
              </thead>
              <tbody>
                {invoice.allocations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-stone-600 italic">ยังไม่มีประวัติการชำระเงิน</td>
                  </tr>
                ) : invoice.allocations.map((alloc) => (
                  <tr key={alloc.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                    <td className="py-3 px-6 font-mono text-blue-600">
                      <Link href={`/app/ap/payments/${alloc.payment_id}`} className="hover:underline">
                        {alloc.payment_number}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-stone-500">{formatDate(alloc.payment_date)}</td>
                    <td className="py-3 px-4 text-stone-500 truncate max-w-[150px]">{alloc.bank_ref || '—'}</td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums font-medium text-emerald-700">{formatCurrency(alloc.allocated_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Totals & Action */}
        <div className="space-y-6">
          <div className={`${CARD} p-6 bg-stone-50/50`}>
            <h3 className="text-xs font-bold text-stone-600 uppercase tracking-widest mb-4">ยอดเงิน</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-500">ยอดรวมทั้งสิ้น</span>
                <span className="font-mono font-medium text-stone-900">{formatCurrency(invoice.amount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-500">ชำระแล้ว</span>
                <span className="font-mono font-medium text-emerald-600">{formatCurrency(invoice.paid_amount)}</span>
              </div>
              <div className="pt-3 border-t border-stone-200 flex justify-between items-center">
                <span className="text-stone-900 font-semibold">ยอดค้างชำระ</span>
                <span className={`font-mono text-lg font-bold ${invoice.outstanding_amount > 0 ? 'text-red-600' : 'text-stone-600'}`}>
                  {formatCurrency(invoice.outstanding_amount)}
                </span>
              </div>
            </div>

            {!invoice.is_paid && (
              <div className="mt-8 space-y-2">
                {invoice.match_status === 'matched' ? (
                  <Link
                    href={`/app/ap/payments/new?vendor_id=${invoice.vendor_id}`}
                    className="block w-full text-center h-10 px-4 rounded-[8px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors pt-2.5"
                  >
                    ชำระเงิน →
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <button
                      disabled
                      className="w-full h-10 px-4 rounded-[8px] bg-stone-200 text-stone-400 text-[13px] font-medium cursor-not-allowed border border-stone-300/40"
                    >
                      ชำระเงิน (ถูกระงับ 3-Way)
                    </button>
                    <p className="text-[11px] text-red-500 font-medium text-center">
                      ⚠️ เอกสารมีผลต่าง (Mismatch) หรือยังตรวจรับไม่สมบูรณ์
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 bg-blue-50 border border-blue-100 rounded-[10px]">
            <h4 className="text-[13px] font-semibold text-blue-900 mb-2">ข้อมูลบัญชีผู้จำหน่าย</h4>
            <p className="text-[12px] text-blue-700 leading-relaxed mb-3">ตรวจสอบเลขบัญชีธนาคารก่อนทำการโอนเงินผ่านระบบ iBanking</p>
            <Link href={`/app/vendors/${invoice.vendor_id}`} className="text-[12px] font-medium text-blue-800 hover:underline">
              ดูข้อมูลธนาคารผู้จำหน่าย →
            </Link>
          </div>
        </div>
      </div>
    </div>
    </DirectionalTransition>
  );
}
