'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, patch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatQty } from '@/lib/format';
import Link from 'next/link';
import type { DeliveryOrder, DoLineItem } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function DeliveryOrderDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [doData, setDoData] = useState<(DeliveryOrder & { lines: DoLineItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState('');

  const fetchDO = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<DeliveryOrder & { lines: DoLineItem[] }>(`/api/delivery-orders/${id}`);
      setDoData(res);
    } catch (error) {
      console.error('Failed to fetch DO:', error);
      router.push('/app/delivery-orders');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchDO();
  }, [fetchDO]);

  async function handleAction(action: string) {
    if (!confirm(`Are you sure you want to set this delivery as ${action}?`)) return;
    setActioning(action);
    try {
      const res = await patch<DeliveryOrder>(`/api/delivery-orders/${id}`, { action });
      setDoData(prev => prev ? { ...prev, ...res } : null);
    } catch (error) {
      alert(error instanceof Error ? error.message : `Failed to ${action}`);
    } finally {
      setActioning('');
    }
  }

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;
  if (!doData) return <div className="text-center py-24">Delivery Order not found</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/delivery-orders" className="text-stone-400 hover:text-stone-600">←</Link>
          <div>
            <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-3">
              {doData.do_number}
              <StatusBadge status={doData.status} />
            </h1>
            <p className="text-stone-500 text-sm">อ้างอิง: <Link href={`/app/sales-orders/${doData.so_id}`} className="text-blue-600 hover:underline">{doData.so_number}</Link></p>
          </div>
        </div>
        <div className="flex gap-2">
          {doData.status === 'draft' && (
            <>
              <Button variant="outline" className="text-red-600" onClick={() => handleAction('cancel')} loading={actioning === 'cancel'}>ยกเลิก / Cancel</Button>
              <Button onClick={() => handleAction('ready')} loading={actioning === 'ready'}>พร้อมส่ง / Ready</Button>
            </>
          )}
          {doData.status === 'ready' && (
            <>
              <Button variant="outline" className="text-red-600" onClick={() => handleAction('cancel')} loading={actioning === 'cancel'}>ยกเลิก / Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAction('ship')} loading={actioning === 'ship'}>ยืนยันการส่ง / Ship</Button>
            </>
          )}
          {doData.status === 'shipped' && (
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleAction('deliver')} loading={actioning === 'deliver'}>ถึงลูกค้าแล้ว / Delivered</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className={`${CARD} p-5 space-y-4 col-span-2`}>
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">ข้อมูลทั่วไป / Info</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-stone-500 mb-1">ลูกค้า</p>
              <p className="font-medium">{doData.customer_name_th}</p>
            </div>
            <div>
              <p className="text-stone-500 mb-1">คลังสินค้า</p>
              <p className="font-medium">{doData.warehouse_name_th}</p>
            </div>
            <div className="col-span-2">
              <p className="text-stone-500 mb-1">ที่อยู่จัดส่ง</p>
              <p className="text-stone-900">{doData.shipping_address || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-stone-500 mb-1">หมายเหตุ</p>
              <p className="text-stone-900">{doData.notes || '-'}</p>
            </div>
          </div>
        </div>

        <div className={`${CARD} p-5 space-y-4`}>
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">วันที่ / Dates</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">วันที่สร้าง:</span>
              <span className="font-medium">{new Date(doData.created_at).toLocaleDateString('th-TH')}</span>
            </div>
            {doData.shipped_at && (
              <div className="flex justify-between">
                <span className="text-stone-500">วันที่ส่งออก:</span>
                <span className="font-medium">{new Date(doData.shipped_at).toLocaleString('th-TH')}</span>
              </div>
            )}
            {doData.delivered_at && (
              <div className="flex justify-between">
                <span className="text-stone-500">วันที่ถึง:</span>
                <span className="font-medium">{new Date(doData.delivered_at).toLocaleString('th-TH')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={CARD}>
        <div className="p-4 border-b border-stone-100 bg-stone-50/50">
          <h3 className="font-semibold text-stone-900">รายการสินค้า / Items</h3>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="text-stone-500 border-b border-stone-100">
            <tr>
              <th className="px-5 py-3 font-medium">รายการ / Item</th>
              <th className="px-5 py-3 font-medium text-right">จำนวนจัดส่ง / Qty</th>
              <th className="px-5 py-3 font-medium text-right">ราคาหน่วย / Price</th>
              <th className="px-5 py-3 font-medium text-right">รวม / Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {doData.lines?.map((line) => (
              <tr key={line.id}>
                <td className="px-5 py-4">
                  <div className="font-medium text-stone-900">{line.name_th}</div>
                  <div className="text-xs font-mono text-stone-400">{line.sku}</div>
                </td>
                <td className="px-5 py-4 text-right font-mono font-bold text-emerald-600">{formatQty(line.qty_to_deliver)}</td>
                <td className="px-5 py-4 text-right font-mono">{formatCurrency(line.unit_price)}</td>
                <td className="px-5 py-4 text-right font-mono font-bold text-stone-900">{formatCurrency(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
