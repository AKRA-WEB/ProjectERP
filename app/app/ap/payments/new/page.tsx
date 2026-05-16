'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import { Button } from '@/components/ui';
import type { PaginatedResponse, ApInvoice } from '@/types';

interface Vendor { id: string; code: string; name_th: string; }

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';
const FIELD_CLS = 'bg-white border border-stone-200 rounded-[7px] px-3 py-[7px] text-[13px] text-stone-900 outline-none transition-all focus:border-stone-400 focus:ring-2 focus:ring-stone-400/20 disabled:opacity-50 disabled:bg-stone-50 w-full';
const LABEL_CLS = 'text-[12px] font-medium text-stone-600 mb-1.5 block';

function RecordPaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVendorId = searchParams.get('vendor_id') || '';

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState(initialVendorId);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [bankRef, setBankRef] = useState('');
  const [notes, setNotes] = useState('');
  const [invoices, setInvoices] = useState<ApInvoice[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<PaginatedResponse<Vendor>>('/api/vendors?limit=500').then((r) => setVendors(r.data));
  }, []);

  const fetchUnpaidInvoices = useCallback(async (vId: string) => {
    if (!vId) { setInvoices([]); return; }
    setLoading(true);
    try {
      const res = await get<{ invoices: ApInvoice[] }>(`/api/ap/invoices?vendor_id=${vId}&is_paid=false&limit=100`);
      setInvoices(res.invoices);
      setSelectedInvoices({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (vendorId) fetchUnpaidInvoices(vendorId);
  }, [vendorId, fetchUnpaidInvoices]);

  function toggleInvoice(invId: string, outstanding: number) {
    setSelectedInvoices((prev) => {
      const next = { ...prev };
      if (next[invId] !== undefined) {
        delete next[invId];
      } else {
        next[invId] = outstanding;
      }
      return next;
    });
  }

  function updateAllocatedAmount(invId: string, amount: number, outstanding: number) {
    const safeAmount = Math.max(0, Math.min(amount, outstanding));
    setSelectedInvoices((prev) => ({ ...prev, [invId]: safeAmount }));
  }

  const totalPayment = Object.values(selectedInvoices).reduce((sum, val) => sum + val, 0);

  async function handleSubmit() {
    if (!vendorId) { setError('กรุณาเลือกผู้จำหน่าย'); return; }
    if (Object.keys(selectedInvoices).length === 0) { setError('กรุณาเลือกใบแจ้งหนี้อย่างน้อย 1 ใบ'); return; }
    if (!paymentDate) { setError('กรุณาระบุวันที่ชำระเงิน'); return; }

    setError('');
    setSaving(true);
    try {
      const allocations = Object.entries(selectedInvoices).map(([invId, amount]) => ({
        invoice_id: invId,
        allocated_amount: amount,
      }));

      const res = await post<{ id: string }>(
        '/api/ap/payments',
        {
          vendor_id: vendorId,
          payment_date: paymentDate,
          bank_ref: bankRef || undefined,
          notes: notes || undefined,
          allocations,
        }
      );
      router.push(`/app/ap/payments/${res.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 leading-tight">บันทึกการชำระเงินเจ้าหนี้</h1>
          <p className="text-sm text-stone-500 mt-0.5">Record AP Payment & Invoice Allocation</p>
        </div>
        <button onClick={() => router.back()} className="text-sm text-stone-400 hover:text-stone-700">← ย้อนกลับ</button>
      </div>

      {error && (
        <div className="p-3 rounded-[8px] bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Payment Info */}
        <div className="md:col-span-1 space-y-6">
          <div className={`${CARD} p-6`}>
            <h2 className="text-[14px] font-semibold text-stone-800 mb-4">ข้อมูลการชำระเงิน</h2>
            <div className="space-y-4">
              <div>
                <label className={LABEL_CLS}>ผู้จำหน่าย / Vendor *</label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className={FIELD_CLS}
                  disabled={!!initialVendorId}
                >
                  <option value="">-- เลือกผู้จำหน่าย --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.code} — {v.name_th}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>วันที่ชำระเงิน *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className={FIELD_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>อ้างอิงธนาคาร / Ref.</label>
                <input
                  type="text"
                  placeholder="เลขที่โอน / Reference No."
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                  className={FIELD_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>หมายเหตุ</label>
                <textarea
                  placeholder="หมายเหตุเพิ่มเติม"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${FIELD_CLS} h-20 resize-none`}
                />
              </div>
            </div>
          </div>

          <div className={`${CARD} p-6 bg-stone-900 text-white`}>
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">ยอดชำระรวม</h3>
            <div className="text-3xl font-bold font-mono">
              {formatCurrency(totalPayment)}
            </div>
            <p className="text-[11px] text-stone-400 mt-2 uppercase tracking-wide">Total Allocated Amount</p>
            <div className="mt-6">
              <Button
                onClick={handleSubmit}
                disabled={saving || totalPayment === 0}
                className="w-full bg-white text-stone-950 hover:bg-stone-100"
              >
                {saving ? 'กำลังบันทึก…' : 'ยืนยันการบันทึกชำระ'}
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Invoice Selection */}
        <div className="md:col-span-2 space-y-6">
          <div className={`${CARD} overflow-hidden`}>
            <div className="p-6 border-b border-stone-100 bg-stone-50/50">
              <h2 className="text-[14px] font-semibold text-stone-800 flex items-center justify-between">
                เลือกใบแจ้งหนี้ที่ต้องการชำระ
                {loading && <span className="text-xs font-normal text-stone-400 animate-pulse">กำลังโหลด…</span>}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="w-10 py-2.5 px-4"></th>
                    <th className="text-left py-2.5 px-3 font-medium text-stone-500">เลขที่ใบแจ้งหนี้</th>
                    <th className="text-left py-2.5 px-3 font-medium text-stone-500">วันที่</th>
                    <th className="text-right py-2.5 px-3 font-medium text-stone-500">ยอดค้างชำระ</th>
                    <th className="text-right py-2.5 px-4 font-medium text-stone-500 w-36">จำนวนที่ชำระ</th>
                  </tr>
                </thead>
                <tbody>
                  {!vendorId ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-stone-400 italic">กรุณาเลือกผู้จำหน่ายเพื่อดูรายการใบแจ้งหนี้</td>
                    </tr>
                  ) : loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-stone-400">กำลังดึงข้อมูลใบแจ้งหนี้…</td>
                    </tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-stone-400 italic">ไม่พบใบแจ้งหนี้ที่ค้างชำระสำหรับผู้จำหน่ายรายนี้</td>
                    </tr>
                  ) : invoices.map((inv) => {
                    const isSelected = selectedInvoices[inv.id] !== undefined;
                    return (
                      <tr
                        key={inv.id}
                        className={`border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}
                      >
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleInvoice(inv.id, inv.outstanding_amount)}
                            className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono font-medium text-stone-900">{inv.invoice_number}</div>
                          {inv.overdue_days > 0 && (
                            <span className="text-[10px] text-red-500 font-bold uppercase tracking-tight">เกินกำหนด {inv.overdue_days} วัน</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-stone-500">{formatDate(inv.invoice_date)}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-stone-600">
                          {formatCurrency(inv.outstanding_amount)}
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            max={inv.outstanding_amount}
                            value={selectedInvoices[inv.id] ?? ''}
                            onChange={(e) => updateAllocatedAmount(inv.id, Number(e.target.value), inv.outstanding_amount)}
                            disabled={!isSelected}
                            placeholder="0.00"
                            className="w-full border border-stone-200 rounded-[6px] px-2 py-1 text-[13px] text-right outline-none focus:border-stone-400 tabular-nums disabled:bg-stone-50 disabled:text-stone-300"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RecordPaymentPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-stone-400">กำลังโหลด...</div>}>
      <RecordPaymentPageContent />
    </Suspense>
  );
}
