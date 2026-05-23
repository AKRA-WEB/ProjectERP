'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, patch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatCurrency, formatDatetime } from '@/lib/format';
import Link from 'next/link';
import type { SalesInvoice, InvoiceVersion } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function SalesInvoiceDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [si, setSi] = useState<SalesInvoice | null>(null);
  const [versions, setVersions] = useState<InvoiceVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState('');
  
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const [deltaModalOpen, setVoidDeltaModalOpen] = useState(false);
  const [deltaLines, setDeltaLines] = useState<{ product_id: string; qty_delta: number; price_delta: number }[]>([]);

  const fetchSI = useCallback(async () => {
    setLoading(true);
    try {
      const [res, vRes] = await Promise.all([
        get<SalesInvoice>(`/api/sales-invoices/${id}`),
        get<{ versions: InvoiceVersion[] }>(`/api/sales-invoices/${id}/versions`)
      ]);
      setSi(res);
      setVersions(vRes.versions);
    } catch (error: unknown) {
      console.error('Failed to fetch SI:', error);
      router.push('/app/sales-invoices');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchSI();
  }, [fetchSI]);

  async function handleViewDelta() {
    setActioning('delta');
    try {
      const res = await get<{ delta_lines: { product_id: string; qty_delta: number; price_delta: number }[] }>(`/api/sales-invoices/${id}/delta-slip`);
      setDeltaLines(res.delta_lines);
      setVoidDeltaModalOpen(true);
    } catch {
      alert('Failed to fetch delta slip');
    } finally {
      setActioning('');
    }
  }

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

      // Refresh versions if edited
      if (action.startsWith('update')) {
        const vRes = await get<{ versions: InvoiceVersion[] }>(`/api/sales-invoices/${id}/versions`);
        setVersions(vRes.versions);
      }
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
              <p className="text-stone-500 text-sm mb-1">เวอร์ชันและบาร์โค้ด / Version & Barcode</p>
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium px-2 py-1 bg-stone-100 rounded border border-stone-200">
                  v{si.current_version}
                </div>
                {si.current_version > 1 && (
                  <Button 
                    variant="outline" 
                    className="h-8 text-[11px] px-2" 
                    onClick={handleViewDelta}
                    loading={actioning === 'delta'}
                  >
                    Δ Delta Slip
                  </Button>
                )}
              </div>
              {si.current_barcode && (
                <p className="text-[10px] font-mono text-stone-400 mt-1 uppercase truncate w-full" title={si.current_barcode}>
                  BC: {si.current_barcode}
                </p>
              )}
            </div>
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

      <div className={`${CARD}`}>
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">ประวัติเวอร์ชัน / Version History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 font-semibold">Ver</th>
                <th className="px-6 py-3 font-semibold">Barcode</th>
                <th className="px-6 py-3 font-semibold">สร้างโดย</th>
                <th className="px-6 py-3 font-semibold">เมื่อวันที่</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {versions.map((v) => (
                <tr key={v.id} className={v.version_no === si.current_version ? 'bg-amber-50/30' : ''}>
                  <td className="px-6 py-4 font-mono font-bold">v{v.version_no}</td>
                  <td className="px-6 py-4 font-mono text-[10px] text-stone-400 uppercase">{v.barcode.slice(0, 16)}...</td>
                  <td className="px-6 py-4 text-stone-600">{v.created_by_name}</td>
                  <td className="px-6 py-4 text-stone-500">{formatDatetime(v.created_at, 'th')}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

      <Modal isOpen={deltaModalOpen} onClose={() => setVoidDeltaModalOpen(false)} title="รายการเปลี่ยนแปลง / Delta Slip">
        <div className="space-y-4 pt-2">
          <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
            <p className="text-xs text-stone-400 uppercase font-bold mb-4">ส่วนต่างจากเวอร์ชันก่อนหน้า (+/-)</p>
            {deltaLines.length === 0 ? (
              <p className="text-sm text-stone-500 italic text-center py-4">ไม่มีการเปลี่ยนแปลงในรายการสินค้า</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-stone-400 text-left border-b border-stone-200">
                    <th className="font-semibold py-2">Product ID</th>
                    <th className="font-semibold py-2 text-right">จำนวน Δ</th>
                    <th className="font-semibold py-2 text-right">ราคา Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {deltaLines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="py-3 font-mono text-xs">{line.product_id.slice(0, 13)}...</td>
                      <td className={`py-3 text-right font-mono font-bold ${line.qty_delta > 0 ? 'text-emerald-600' : line.qty_delta < 0 ? 'text-red-600' : ''}`}>
                        {line.qty_delta > 0 ? '+' : ''}{line.qty_delta}
                      </td>
                      <td className={`py-3 text-right font-mono ${line.price_delta > 0 ? 'text-emerald-600' : line.price_delta < 0 ? 'text-red-600' : ''}`}>
                        {line.price_delta > 0 ? '+' : ''}{formatCurrency(line.price_delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" onClick={() => setVoidDeltaModalOpen(false)}>ปิด / Close</Button>
            <Button onClick={() => window.print()} className="flex items-center gap-2">พิมพ์ใบส่วนต่าง / Print Delta</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
