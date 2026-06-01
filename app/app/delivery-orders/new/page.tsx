'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Link from 'next/link';
import type { SalesOrder, SoLineItem, DeliveryOrder, StockBalance } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

type SOLineWithStock = SoLineItem & { qty_available: number; qty_to_deliver: number };

function NewDeliveryOrderPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const soId = searchParams.get('so_id');
  
  const [so, setSo] = useState<SalesOrder | null>(null);
  const [lines, setLines] = useState<SOLineWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');

  const fetchSOAndStock = useCallback(async (id: string) => {
    try {
      const soRes = await get<SalesOrder & { lines: SoLineItem[] }>(`/api/sales-orders/${id}`);
      setSo(soRes);

      // Fetch stock for these items
      const stockPromises = soRes.lines!.map(l => 
        get<StockBalance>(`/api/inventory/${soRes.warehouse_id}/stock/${l.product_id}`)
          .catch(() => null)
      );
      const stocks = await Promise.all(stockPromises);

      const initialLines = soRes.lines!.map((l, i) => {
        const remaining = l.qty_ordered - l.qty_delivered;
        const available = stocks[i] ? Number(stocks[i]!.qty_available) : 0;
        return {
          ...l,
          qty_available: available,
          qty_to_deliver: Math.min(remaining, available),
        };
      }).filter(l => (l.qty_ordered - l.qty_delivered) > 0);

      setLines(initialLines);
      
      // Auto-fill address if we had it in customer, but we'll leave it blank or fetch customer
      const custRes = await get<{ address_th: string }>(`/api/customers/${soRes.customer_id}`);
      if (custRes.address_th) setShippingAddress(custRes.address_th);

    } catch (error) {
      console.error('Failed to fetch SO:', error);
      alert('Failed to load Sales Order');
      router.push('/app/sales-orders');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!soId) {
      router.push('/app/sales-orders');
      return;
    }
    fetchSOAndStock(soId);
  }, [soId, fetchSOAndStock, router]);

  function updateQtyToDeliver(id: string, val: string) {
    const qty = Number(val);
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      return { ...l, qty_to_deliver: qty };
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!so) return;

    // Validate
    const invalidLine = lines.find(l => 
      l.qty_to_deliver <= 0 || 
      l.qty_to_deliver > (l.qty_ordered - l.qty_delivered) ||
      l.qty_to_deliver > l.qty_available
    );
    if (invalidLine) {
      return alert(`รายการ ${invalidLine.name_th} ระบุจำนวนจัดส่งไม่ถูกต้อง (ต้องมากกว่า 0 และไม่เกินยอดค้างส่ง/สต็อกที่มี)`);
    }

    const linesToDeliver = lines.filter(l => l.qty_to_deliver > 0);
    if (linesToDeliver.length === 0) return alert('กรุณาระบุจำนวนจัดส่งอย่างน้อย 1 รายการ');

    setSubmitting(true);
    try {
      const res = await post<DeliveryOrder>('/api/delivery-orders', {
        so_id: so.id,
        shipping_address: shippingAddress || undefined,
        notes: notes || undefined,
        lines: linesToDeliver.map(l => ({
          so_line_item_id: l.id,
          qty_to_deliver: l.qty_to_deliver,
        })),
      });
      router.push(`/app/delivery-orders/${res.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create DO');
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;
  if (!so) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link href={`/app/sales-orders/${so.id}`} className="text-stone-400 hover:text-stone-600">←</Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">สร้างใบส่งสินค้า / New Delivery Order</h1>
          <p className="text-stone-500 font-mono text-sm">อ้างอิง: {so.so_number}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={`${CARD} p-6 space-y-6`}>
          <h2 className="text-lg font-medium border-b border-stone-100 pb-2">ข้อมูลจัดส่ง / Shipping Info</h2>
          
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-stone-500 mb-1">ลูกค้า / Customer:</p>
              <p className="font-medium">{so.customer_name_th}</p>
            </div>
            <div>
              <p className="text-stone-500 mb-1">คลังสินค้าต้นทาง / Warehouse:</p>
              <p className="font-medium">{so.warehouse_name_th}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">สถานที่จัดส่ง / Shipping Address</label>
            <textarea
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              rows={3}
              value={shippingAddress}
              onChange={e => setShippingAddress(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">หมายเหตุ / Notes</label>
            <textarea
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className={CARD}>
          <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
            <h2 className="text-lg font-medium">รายการจัดส่ง / Delivery Lines</h2>
          </div>

          <div className="p-4">
            <table className="w-full text-sm text-left">
              <thead className="text-stone-500 bg-stone-50">
                <tr>
                  <th className="p-2 w-1/3">สินค้า / Product</th>
                  <th className="p-2 w-20 text-right">ยอดสั่งซื้อ</th>
                  <th className="p-2 w-20 text-right">ค้างส่ง</th>
                  <th className="p-2 w-24 text-right">สต็อกที่มี</th>
                  <th className="p-2 w-32 text-right">จำนวนจัดส่งรอบนี้</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lines.map((line) => {
                  const remaining = line.qty_ordered - line.qty_delivered;
                  const hasStock = line.qty_available >= remaining;
                  return (
                    <tr key={line.id}>
                      <td className="p-2">
                        <div className="font-medium text-stone-900">{line.name_th}</div>
                        <div className="text-xs font-mono text-stone-400">{line.sku}</div>
                      </td>
                      <td className="p-2 text-right font-mono">{line.qty_ordered}</td>
                      <td className="p-2 text-right font-mono text-amber-600 font-bold">{remaining}</td>
                      <td className={`p-2 text-right font-mono ${hasStock ? 'text-emerald-600' : 'text-red-600'}`}>
                        {line.qty_available}
                      </td>
                      <td className="p-2 flex justify-end">
                        <input 
                          type="number" 
                          min="0" 
                          max={Math.min(remaining, line.qty_available)} 
                          step="0.01" 
                          className="w-24 px-2 py-1.5 border border-stone-300 rounded text-sm text-right font-bold text-stone-900 focus:outline-none focus:ring-2 focus:border-emerald-500" 
                          value={line.qty_to_deliver} 
                          onChange={e => updateQtyToDeliver(line.id, e.target.value)} 
                          required 
                        />
                      </td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-stone-400">ไม่มีรายการค้างส่ง</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Link href={`/app/sales-orders/${so.id}`}>
            <Button type="button" variant="outline" disabled={submitting}>ยกเลิก / Cancel</Button>
          </Link>
          <Button type="submit" loading={submitting}>สร้างใบส่งสินค้า / Create DO</Button>
        </div>
      </form>
    </div>
  );
}

export default function NewDeliveryOrderPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><LoadingSpinner /></div>}>
      <NewDeliveryOrderPageInner />
    </Suspense>
  );
}
