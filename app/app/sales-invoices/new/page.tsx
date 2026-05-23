'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { get, post, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Link from 'next/link';
import type { SalesOrder, SalesInvoice } from '@/types';
import { OverridePinModal } from '@/components/auth/OverridePinModal';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function NewSalesInvoicePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  
  // Data
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [soId, setSoId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const [overrideToken, setOverrideToken] = useState<string | null>(null);
  const [overrideReasonCode, setOverrideReasonCode] = useState<string | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  useEffect(() => {
    // Fetch confirmed/delivered SOs that are not yet fully invoiced
    get<{ data: SalesOrder[] }>('/api/sales-orders?limit=1000') // Simplification
      .then(res => {
        const available = res.data.filter(so => ['confirmed', 'partially_delivered', 'fully_delivered'].includes(so.status));
        setSalesOrders(available);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e?: React.FormEvent, overrideTok?: string, overrideReason?: string) {
    if (e) e.preventDefault();
    if (!soId) return alert('กรุณาเลือกใบสั่งขายอ้างอิง');

    setSubmitting(true);
    try {
      const tok = overrideTok || overrideToken || undefined;
      const reason = overrideReason || overrideReasonCode || undefined;
      const res = await post<SalesInvoice>('/api/sales-invoices', {
        so_id: soId,
        invoice_date: invoiceDate,
        notes: notes || undefined,
        override_token: tok,
        reason_code: reason,
      });
      router.push(`/app/sales-invoices/${res.id}`);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 409) {
        const details = error.details as { code?: string } | undefined;
        if (details?.code === 'MIN_PRICE_VIOLATION') {
          setSubmitting(false);
          setIsOverrideModalOpen(true);
          return;
        }
      }
      alert(error instanceof Error ? error.message : 'Failed to create Invoice');
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-center">Loading data...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/app/sales-invoices" className="text-stone-400 hover:text-stone-600">←</Link>
        <h1 className="text-2xl font-semibold text-stone-900">สร้างใบแจ้งหนี้ / New Invoice</h1>
      </div>

      <form onSubmit={handleSubmit} className={`${CARD} p-6 space-y-6`}>
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 text-sm">
          <strong>หมายเหตุ:</strong> ในเวอร์ชั่นนี้จะทำการดึงยอดเงินทั้งหมดจากใบสั่งขายมาออกใบแจ้งหนี้โดยอัตโนมัติ
        </div>

        <div className="space-y-4">
          <Select 
            label="อ้างอิงใบสั่งขาย / Select Sales Order" 
            value={soId} 
            onChange={e => setSoId(e.target.value)} 
            required
          >
            <option value="">-- เลือกใบสั่งขาย --</option>
            {salesOrders.map(so => (
              <option key={so.id} value={so.id}>
                {so.so_number} - {so.customer_name_th} ({so.status})
              </option>
            ))}
          </Select>

          <Input 
            label="วันที่ออกเอกสาร / Invoice Date" 
            type="date" 
            value={invoiceDate} 
            onChange={e => setInvoiceDate(e.target.value)} 
            required 
          />

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">หมายเหตุ / Notes</label>
            <textarea
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-stone-100">
          <Link href="/app/sales-invoices">
            <Button type="button" variant="outline" disabled={submitting}>ยกเลิก / Cancel</Button>
          </Link>
          <Button type="submit" loading={submitting}>สร้างเอกสาร / Create Invoice</Button>
        </div>
      </form>

      <OverridePinModal
        isOpen={isOverrideModalOpen}
        action="min_price_override"
        onSuccess={(token, reasonCode) => {
          setIsOverrideModalOpen(false);
          setOverrideToken(token);
          setOverrideReasonCode(reasonCode);
          handleSubmit(undefined, token, reasonCode);
        }}
        onClose={() => setIsOverrideModalOpen(false)}
      />
    </div>
  );
}
