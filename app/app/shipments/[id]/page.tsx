'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button, StatusBadge } from '@/components/ui';
import { get, patch } from '@/lib/api-client';
import { formatDate, formatQty } from '@/lib/format';
import type { SessionUser } from '@/lib/authz';
import type { Shipment } from '@/types';
import Link from 'next/link';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const currentUser = session?.user as unknown as SessionUser;
  
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');

  const fetchShipment = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<Shipment>(`/api/shipments/${id}`);
      setShipment(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to fetch shipment');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);

  const handleDeliver = async () => {
    setActing(true);
    setError('');
    try {
      await patch(`/api/shipments/${id}`, { action: 'deliver' });
      await fetchShipment();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to mark as delivered');
    } finally {
      setActing(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-stone-400 animate-pulse text-[13px]">กำลังโหลดข้อมูล...</div>;
  if (!shipment) return <div className="py-16 text-center text-red-500 text-[13px]">ไม่พบข้อมูลการจัดส่ง</div>;

  const isManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button className="text-[13px] text-stone-400 hover:text-stone-600 mb-1 flex items-center gap-1 transition-colors" onClick={() => router.back()}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ย้อนกลับ
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-stone-900 font-mono tracking-tight">{shipment.shipment_number}</h1>
            <StatusBadge status={shipment.status} />
          </div>
        </div>
        
        {shipment.status === 'shipped' && isManager && (
          <Button onClick={handleDeliver} loading={acting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            ยืนยันการจัดส่งสำเร็จ (Confirm Delivery)
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 space-y-6">
          <div className={`${CARD} p-5 space-y-4`}>
            <h2 className="text-[11px] font-bold text-stone-400 uppercase tracking-[0.05em]">ข้อมูลการจัดส่ง</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <p className="text-[12px] text-stone-400 mb-0.5">คลังสินค้า</p>
                <p className="text-[14px] font-medium text-stone-900">{shipment.warehouse_name}</p>
              </div>
              <div>
                <p className="text-[12px] text-stone-400 mb-0.5">อ้างอิงใบหยิบสินค้า</p>
                <Link href={`/app/picking/${shipment.pick_list_id}`} className="text-[14px] font-medium text-blue-600 hover:underline font-mono">
                  {shipment.pick_number}
                </Link>
              </div>
              <div>
                <p className="text-[12px] text-stone-400 mb-0.5">วันที่จัดส่ง</p>
                <p className="text-[14px] font-medium text-stone-900">{shipment.ship_date ? formatDate(shipment.ship_date) : '—'}</p>
              </div>
              <div>
                <p className="text-[12px] text-stone-400 mb-0.5">ผู้ดำเนินการจัดส่ง</p>
                <p className="text-[14px] font-medium text-stone-900">{shipment.shipped_by_name || '—'}</p>
              </div>
              <div>
                <p className="text-[12px] text-stone-400 mb-0.5">ผู้ขนส่ง (Carrier)</p>
                <p className="text-[14px] font-medium text-stone-900">{shipment.carrier || '—'}</p>
              </div>
              <div>
                <p className="text-[12px] text-stone-400 mb-0.5">เลข Tracking</p>
                <p className="text-[14px] font-medium text-stone-900">{shipment.tracking_number || '—'}</p>
              </div>
            </div>
            {shipment.notes && (
              <div className="pt-2 border-t border-stone-50">
                <p className="text-[12px] text-stone-400 mb-1">หมายเหตุ</p>
                <p className="text-[13px] text-stone-600 leading-relaxed">{shipment.notes}</p>
              </div>
            )}
          </div>

          <div className={`${CARD} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-stone-100 bg-stone-50/50">
              <h2 className="text-[11px] font-bold text-stone-400 uppercase tracking-[0.05em]">รายการสินค้าที่จัดส่ง</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50/30 text-[11px] font-semibold text-stone-400 uppercase tracking-wider border-b border-stone-100 text-left">
                    <th className="px-5 py-2.5">สินค้า / SKU</th>
                    <th className="px-5 py-2.5 text-right">จำนวนที่ส่ง</th>
                    <th className="px-5 py-2.5">ตำแหน่งที่หยิบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {shipment.lines?.map((line, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-mono text-[11px] text-stone-400 leading-none mb-1">{line.product_sku}</div>
                        <div className="text-[13px] font-medium text-stone-900">{line.product_name}</div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-stone-900 font-medium">
                        {formatQty(line.qty_picked)}
                      </td>
                      <td className="px-5 py-3 text-[12px] text-stone-500 font-mono">
                        {line.storage_location || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`${CARD} p-5`}>
            <h2 className="text-[11px] font-bold text-stone-400 uppercase tracking-[0.05em] mb-4 text-center">สรุปการจัดส่ง</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-stone-500">รวมสินค้า</span>
                <span className="text-[15px] font-semibold text-stone-900">{shipment.lines?.length || 0} รายการ</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-stone-500">สถานะล่าสุด</span>
                <span className="text-[14px] font-medium text-stone-900">
                  {shipment.status === 'delivered' ? 'จัดส่งสำเร็จ' : 'อยู่ระหว่างจัดส่ง'}
                </span>
              </div>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-[12px] text-red-600 flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v4M8 11h0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>

  );
}
