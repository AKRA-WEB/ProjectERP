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
import type { SalesOrder, SoLineItem, DeliveryOrder } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

type SOData = SalesOrder & { lines: SoLineItem[]; delivery_orders: DeliveryOrder[] };

export default function SalesOrderDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [so, setSo] = useState<SOData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState('');
  
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const fetchSO = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<SOData>(`/api/sales-orders/${id}`);
      setSo(res);
    } catch (error) {
      console.error('Failed to fetch SO:', error);
      router.push('/app/sales-orders');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchSO();
  }, [fetchSO]);

  async function handleAction(action: string) {
    if (action !== 'cancel' && !confirm(`Are you sure you want to ${action} this order?`)) return;
    setActioning(action);
    try {
      const payload: { action: string; cancellation_reason?: string } = { action };
      if (action === 'cancel') {
        payload.cancellation_reason = cancelReason;
      }

      const res = await patch<SalesOrder & { credit_limit_warning?: boolean }>(`/api/sales-orders/${id}`, payload);
      
      if (res.credit_limit_warning) {
        alert('Warning: This customer has exceeded their credit limit!');
      }

      setSo(prev => prev ? { ...prev, ...res, lines: prev.lines, delivery_orders: prev.delivery_orders } : null);
      if (action === 'cancel') setCancelModalOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : `Failed to ${action}`);
    } finally {
      setActioning('');
    }
  }

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;
  if (!so) return <div className="text-center py-24">Sales Order not found</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/sales-orders" className="text-stone-400 hover:text-stone-600">←</Link>
          <div>
            <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-3">
              {so.so_number}
              <StatusBadge status={so.status} />
            </h1>
            <p className="text-stone-500 text-sm">{so.customer_name_th}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(so.status === 'draft' || so.status === 'confirmed') && (
            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setCancelModalOpen(true)}>ยกเลิก / Cancel</Button>
          )}
          {so.status === 'draft' && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAction('confirm')} loading={actioning === 'confirm'}>ยืนยันใบสั่งขาย / Confirm</Button>
          )}
          {(so.status === 'confirmed' || so.status === 'partially_delivered') && (
            <Link href={`/app/delivery-orders/new?so_id=${so.id}`}>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">สร้างใบส่งสินค้า / Create DO</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className={`${CARD} p-5 space-y-4 col-span-2`}>
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">ข้อมูลลูกค้า / Customer Info</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-stone-500 mb-1">ลูกค้า</p>
              <p className="font-medium">{so.customer_name_th}</p>
            </div>
            <div>
              <p className="text-stone-500 mb-1">คลังสินค้า</p>
              <p className="font-medium">{so.warehouse_name_th}</p>
            </div>
            <div className="col-span-2">
              <p className="text-stone-500 mb-1">หมายเหตุ</p>
              <p className="text-stone-900">{so.notes || '-'}</p>
            </div>
            {so.status === 'cancelled' && (
              <div className="col-span-2 p-3 bg-red-50 text-red-700 rounded border border-red-100 mt-2">
                <strong>เหตุผลที่ยกเลิก:</strong> {so.cancellation_reason}
              </div>
            )}
          </div>
        </div>

        <div className={`${CARD} p-5 space-y-4`}>
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">วันที่และเงื่อนไข / Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">วันที่สร้าง:</span>
              <span className="font-medium">{new Date(so.created_at).toLocaleDateString('th-TH')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">กำหนดส่ง:</span>
              <span className="font-medium">{so.expected_delivery ? new Date(so.expected_delivery).toLocaleDateString('th-TH') : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">เครดิตเทอม:</span>
              <span className="font-medium">{so.payment_terms_days} วัน</span>
            </div>
          </div>
        </div>
      </div>

      <div className={CARD}>
        <div className="p-4 border-b border-stone-100 bg-stone-50/50">
          <h3 className="font-semibold text-stone-900">รายการสินค้า / Line Items</h3>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="text-stone-500 border-b border-stone-100">
            <tr>
              <th className="px-5 py-3 font-medium">รายการ / Item</th>
              <th className="px-5 py-3 font-medium text-right">สั่งซื้อ / Ordered</th>
              <th className="px-5 py-3 font-medium text-right">ส่งแล้ว / Delivered</th>
              <th className="px-5 py-3 font-medium text-right">ค้างส่ง / Pending</th>
              <th className="px-5 py-3 font-medium text-right">ราคา / Price</th>
              <th className="px-5 py-3 font-medium text-right">รวม / Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {so.lines?.map((line) => (
              <tr key={line.id} className="hover:bg-stone-50/50">
                <td className="px-5 py-4">
                  <div className="font-medium text-stone-900">{line.name_th}</div>
                  <div className="text-xs font-mono text-stone-400">{line.sku}</div>
                </td>
                <td className="px-5 py-4 text-right font-mono">{line.qty_ordered}</td>
                <td className="px-5 py-4 text-right font-mono text-emerald-600">{line.qty_delivered}</td>
                <td className="px-5 py-4 text-right font-mono text-amber-600">{line.qty_ordered - line.qty_delivered}</td>
                <td className="px-5 py-4 text-right font-mono">{formatCurrency(line.unit_price)}</td>
                <td className="px-5 py-4 text-right font-mono font-bold text-stone-900">{formatCurrency(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="p-5 bg-stone-50 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm text-stone-500">
              <span>รวมมูลค่าสินค้า / Subtotal:</span>
              <span className="font-mono">{formatCurrency(so.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-500">
              <span>ภาษีมูลค่าเพิ่ม / VAT (7%):</span>
              <span className="font-mono">{formatCurrency(so.vat_amount)}</span>
            </div>
            <div className="h-px bg-stone-200 my-2" />
            <div className="flex justify-between text-lg font-bold text-stone-900">
              <span>ยอดสุทธิ / Total:</span>
              <span className="font-mono">{formatCurrency(so.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {so.delivery_orders && so.delivery_orders.length > 0 && (
        <div className={CARD}>
          <div className="p-4 border-b border-stone-100 bg-stone-50/50">
            <h3 className="font-semibold text-stone-900">ใบส่งสินค้าที่เกี่ยวข้อง / Related Deliveries</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {so.delivery_orders.map(do_ => (
                <Link key={do_.id} href={`/app/delivery-orders/${do_.id}`}>
                  <div className="border border-stone-200 p-4 rounded-lg hover:border-emerald-500 transition-colors">
                    <div className="flex justify-between mb-2">
                      <span className="font-mono font-bold">{do_.do_number}</span>
                      <StatusBadge status={do_.status} />
                    </div>
                    <div className="text-xs text-stone-500">
                      สร้างเมื่อ: {new Date(do_.created_at).toLocaleDateString('th-TH')}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="ยกเลิกใบสั่งขาย / Cancel Sales Order">
        <div className="space-y-4 pt-2">
          <Input
            label="เหตุผลในการยกเลิก / Reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelModalOpen(false)} disabled={actioning === 'cancel'}>ปิด / Close</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => handleAction('cancel')} loading={actioning === 'cancel'}>ยืนยันยกเลิก / Confirm Cancel</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
