'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Package, Plus, ClipboardList, Clock } from 'lucide-react';
import { formatDatetime } from '@/lib/format';

interface PO {
  id: string;
  po_number: string;
  vendor_name: string;
  warehouse_id: string;
  warehouse_name: string;
  status: string;
  created_at: string;
}

const CARD = 'bg-white border border-stone-200 rounded-xl p-4 shadow-sm active:bg-stone-50 transition-colors';

export default function HandheldBlindReceiptsPage() {
  const router = useRouter();
  const [pos, setPOs] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPOs();
  }, []);

  async function fetchPOs() {
    try {
      const res = await get<{ data: PO[] }>('/api/purchase-orders?status=pending_delivery&limit=50');
      setPOs(res.data);
    } catch (err) {
      console.error('Failed to fetch POs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBR(poId: string, warehouseId: string) {
    if (!confirm('สร้างใบตรวจรับ (Blind Receipt) ใหม่?')) return;
    try {
      const res = await post<{ id: string }>('/api/blind-receipts', {
        po_id: poId,
        warehouse_id: warehouseId
      });
      router.push(`/app/handheld/blind-receipts/${res.id}`);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to create BR');
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center py-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-stone-600" /> ตรวจรับสินค้า (Handheld)
        </h1>
        <Button variant="ghost" onClick={fetchPOs} size="sm">
          <Clock className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : pos.length === 0 ? (
        <div className="bg-stone-50 rounded-2xl p-12 text-center border-2 border-dashed border-stone-200">
           <Package className="w-12 h-12 mx-auto mb-4 text-stone-300" />
           <p className="text-stone-500">ไม่มีใบสั่งซื้อที่รอรับในขณะนี้</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">เลือกใบสั่งซื้อเพื่อเริ่มตรวจนับ</p>
          {pos.map((po) => (
            <div key={po.id} className={CARD} onClick={() => handleCreateBR(po.id, po.warehouse_id)}>
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono font-bold text-stone-900">{po.po_number}</span>
                <Plus className="w-4 h-4 text-stone-300" />
              </div>
              <p className="text-sm text-stone-700 font-medium">{po.vendor_name}</p>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-stone-50">
                <span className="text-[11px] text-stone-400">{po.warehouse_name}</span>
                <span className="text-[11px] text-stone-400">{formatDatetime(po.created_at, 'th')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
