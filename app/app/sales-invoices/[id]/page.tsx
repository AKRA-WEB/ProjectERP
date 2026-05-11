'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, patch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import type { SalesInvoice } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function SalesInvoiceDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [si, setSi] = useState<SalesInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState('');
  
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const fetchSI = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<SalesInvoice>(`/api/sales-invoices/${id}`);
      setSi(res);
    } catch (error) {
      console.error('Failed to fetch SI:', error);
      router.push('/app/sales-invoices');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchSI();
  }, [fetchSI]);

  async function handleAction(action: string) {
    if (action !== 'void' && !confirm(`Are you sure you want to ${action} this invoice?`)) return;
    setActioning(action);
    try {
      const payload: { action: string; void_reason?: string } = { action };
      if (action === 'void') {
        payload.void_reason = voidReason;
      }

      const res = await patch<SalesInvoice>(`/api/sales-invoices/${id}`, payload);
      setSi(prev => prev ? { ...prev, ...res } : null);
      if (action === 'void') setVoidModalOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : `Failed to ${action}`);
    } finally {
      setActioning('');
    }
  }

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;
  if (!si) return <div className="text-center py-24">Invoice not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/sales-invoices" className="text-stone-400 hover:text-stone-600">←</Link>
          <div>
            <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-3">
              {si.si_number}
              <StatusBadge status={si.status} />
            </h1>
            <p className="text-stone-500 text-sm">ลูกค้า: {si.customer_name_th}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(si.status === 'draft' || si.status === 'issued') && (
            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setVoidModalOpen(true)}>ยกเลิก / Void</Button>
          )}
          {si.status === 'draft' && (
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleAction('issue')} loading={actioning === 'issue'}>ออกใบแจ้งหนี้ / Issue</Button>
          )}
          {si.status === 'issued' && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAction('mark_paid')} loading={actioning === 'mark_paid'}>บันทึกชำระเงินแล้ว / Mark Paid</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className={`${CARD} p-6 space-y-6`}>
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">ข้อมูลเอกสารอ้างอิง / References</h3>
          <div className="space-y-4">
            <div>
              <p className="text-stone-500 text-sm mb-1">อ้างอิงใบสั่งขาย (SO)</p>
              <Link href={`/app/sales-orders/${si.so_id}`} className="font-mono font-medium text-blue-600 hover:underline">{si.so_number}</Link>
            </div>
            {si.delivery_order_id && (
              <div>
                <p className="text-stone-500 text-sm mb-1">อ้างอิงใบส่งสินค้า (DO)</p>
                <Link href={`/app/delivery-orders/${si.delivery_order_id}`} className="font-mono font-medium text-blue-600 hover:underline">{si.do_number}</Link>
              </div>
            )}
            <div>
              <p className="text-stone-500 text-sm mb-1">วันที่ออกเอกสาร</p>
              <p className="font-medium">{new Date(si.invoice_date).toLocaleDateString('th-TH')}</p>
            </div>
            <div>
              <p className="text-stone-500 text-sm mb-1">วันครบกำหนดชำระ</p>
              <p className="font-medium text-amber-600">{new Date(si.due_date).toLocaleDateString('th-TH')}</p>
            </div>
            {si.status === 'void' && (
              <div className="p-3 bg-red-50 text-red-700 rounded border border-red-100 text-sm">
                <strong>เหตุผลที่ยกเลิก:</strong> {si.void_reason}
              </div>
            )}
            {si.paid_at && (
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded border border-emerald-100 text-sm">
                <strong>ชำระเงินเมื่อ:</strong> {new Date(si.paid_at).toLocaleString('th-TH')}
              </div>
            )}
          </div>
        </div>

        <div className={`${CARD} p-6 flex flex-col justify-between`}>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">สรุปยอดเงิน / Totals</h3>
            <div className="flex justify-between text-stone-600">
              <span>มูลค่าสินค้า / Subtotal:</span>
              <span className="font-mono">{formatCurrency(si.subtotal)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>ภาษีมูลค่าเพิ่ม / VAT (7%):</span>
              <span className="font-mono">{formatCurrency(si.vat_amount)}</span>
            </div>
          </div>
          
          <div className="pt-6 border-t border-stone-100 mt-6">
            <div className="flex justify-between items-end">
              <span className="text-lg font-bold text-stone-900">ยอดสุทธิ / Total</span>
              <span className="text-3xl font-mono font-black text-emerald-600">{formatCurrency(si.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={voidModalOpen} onClose={() => setVoidModalOpen(false)} title="ยกเลิกใบแจ้งหนี้ / Void Invoice">
        <div className="space-y-4 pt-2">
          <Input
            label="เหตุผลในการยกเลิก / Reason"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVoidModalOpen(false)} disabled={actioning === 'void'}>ปิด / Close</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => handleAction('void')} loading={actioning === 'void'}>ยืนยันยกเลิก / Confirm Void</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
