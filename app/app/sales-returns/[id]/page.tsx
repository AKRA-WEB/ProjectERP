'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, patch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatQty } from '@/lib/format';
import Link from 'next/link';
import type { SalesReturn, SrLineItem } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function SalesReturnDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [srData, setSrData] = useState<(SalesReturn & { lines: SrLineItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState('');

  const fetchSR = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<SalesReturn & { lines: SrLineItem[] }>(`/api/sales-returns/${id}`);
      setSrData(res);
    } catch (error) {
      console.error('Failed to fetch SR:', error);
      router.push('/app/sales-returns');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchSR();
  }, [fetchSR]);

  async function handleAction(action: string) {
    if (!confirm(`Are you sure you want to ${action} this return?`)) return;
    setActioning(action);
    try {
      const res = await patch<SalesReturn>(`/api/sales-returns/${id}`, { action });
      setSrData(prev => prev ? { ...prev, ...res } : null);
    } catch (error) {
      alert(error instanceof Error ? error.message : `Failed to ${action}`);
    } finally {
      setActioning('');
    }
  }

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;
  if (!srData) return <div className="text-center py-24">Sales Return not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/sales-returns" className="text-stone-400 hover:text-stone-600">←</Link>
          <div>
            <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-3">
              {srData.sr_number}
              <StatusBadge status={srData.status} />
            </h1>
            <p className="text-stone-500 text-sm">ลูกค้า: {srData.customer_name_th}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {srData.status === 'open' && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAction('receive')} loading={actioning === 'receive'}>รับสินค้าคืน / Receive</Button>
          )}
          {srData.status === 'received' && (
            <>
              <Button variant="outline" className="text-red-600" onClick={() => handleAction('dispose')} loading={actioning === 'dispose'}>ทำลาย / Dispose</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAction('restock')} loading={actioning === 'restock'}>คืนสต็อก / Restock</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className={`${CARD} p-5 space-y-4 col-span-2`}>
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">รายละเอียด / Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-stone-500 mb-1">คลังสินค้า (รับเข้า)</p>
              <p className="font-medium">{srData.warehouse_name_th}</p>
            </div>
            <div>
              <p className="text-stone-500 mb-1">อ้างอิงใบสั่งขาย</p>
              <p className="font-medium">{srData.so_number ? <Link href={`/app/sales-orders/${srData.so_id}`} className="text-blue-600 hover:underline">{srData.so_number}</Link> : '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-stone-500 mb-1">สาเหตุการคืน</p>
              <p className="text-stone-900">{srData.reason || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-stone-500 mb-1">หมายเหตุ</p>
              <p className="text-stone-900">{srData.notes || '-'}</p>
            </div>
          </div>
        </div>

        <div className={`${CARD} p-5 space-y-4`}>
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">ความคืบหน้า / Timeline</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">วันที่สร้าง:</span>
              <span className="font-medium">{new Date(srData.created_at).toLocaleDateString('th-TH')}</span>
            </div>
            {srData.received_at && (
              <div className="flex justify-between text-blue-600">
                <span>ได้รับสินค้าเมื่อ:</span>
                <span className="font-bold">{new Date(srData.received_at).toLocaleDateString('th-TH')}</span>
              </div>
            )}
            {srData.restocked_at && (
              <div className="flex justify-between text-emerald-600">
                <span>คืนสต็อกเมื่อ:</span>
                <span className="font-bold">{new Date(srData.restocked_at).toLocaleDateString('th-TH')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={CARD}>
        <div className="p-4 border-b border-stone-100 bg-stone-50/50">
          <h3 className="font-semibold text-stone-900">รายการสินค้าคืน / Items</h3>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="text-stone-500 border-b border-stone-100">
            <tr>
              <th className="px-5 py-3 font-medium">รายการ / Item</th>
              <th className="px-5 py-3 font-medium text-right">จำนวน / Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {srData.lines?.map((line) => (
              <tr key={line.id}>
                <td className="px-5 py-4">
                  <div className="font-medium text-stone-900">{line.name_th}</div>
                  <div className="text-xs font-mono text-stone-400">{line.sku}</div>
                </td>
                <td className="px-5 py-4 text-right font-mono font-bold text-emerald-600">{formatQty(line.qty_returned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
