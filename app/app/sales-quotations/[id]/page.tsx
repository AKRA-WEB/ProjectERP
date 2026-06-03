'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, patch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import type { SalesQuotation, SqLineItem } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function SalesQuotationDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [sq, setSq] = useState<(SalesQuotation & { lines: SqLineItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState('');

  const fetchSQ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<SalesQuotation & { lines: SqLineItem[] }>(`/api/sales-quotations/${id}`);
      setSq(res);
    } catch (error) {
      console.error('Failed to fetch SQ:', error);
      router.push('/app/sales-quotations');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchSQ();
  }, [fetchSQ]);

  async function handleAction(action: string) {
    if (!confirm(`Are you sure you want to ${action} this quotation?`)) return;
    setActioning(action);
    try {
      const res = await patch<SalesQuotation | { so_id: string }>(`/api/sales-quotations/${id}`, { action });
      if (action === 'convert_to_so' && 'so_id' in res) {
        router.push(`/app/sales-orders/${res.so_id}`);
      } else {
        setSq(prev => prev ? { ...prev, ...res as SalesQuotation } : null);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : `Failed to ${action}`);
    } finally {
      setActioning('');
    }
  }

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;
  if (!sq) return <div className="text-center py-24">Quotation not found</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/sales-quotations" className="text-stone-400 hover:text-stone-600">←</Link>
          <div>
            <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-3">
              {sq.sq_number}
              <StatusBadge status={sq.status} />
            </h1>
            <p className="text-stone-500 text-sm">{sq.customer_name_th}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {sq.status === 'draft' && (
            <Button onClick={() => handleAction('send')} loading={actioning === 'send'}>ส่งให้ลูกค้า / Send</Button>
          )}
          {sq.status === 'sent' && (
            <>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleAction('reject')} loading={actioning === 'reject'}>ปฏิเสธ / Reject</Button>
              <Button variant="outline" className="text-stone-600" onClick={() => handleAction('expire')} loading={actioning === 'expire'}>หมดอายุ / Expire</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAction('accept')} loading={actioning === 'accept'}>ลูกค้าตอบรับ / Accept</Button>
            </>
          )}
          {sq.status === 'accepted' && (
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleAction('convert_to_so')} loading={actioning === 'convert_to_so'}>
              สร้างใบสั่งขาย / Convert to SO
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className={`${CARD} p-5 space-y-4 col-span-2`}>
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">ข้อมูลลูกค้า / Customer Info</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-stone-500 mb-1">ลูกค้า</p>
              <p className="font-medium">{sq.customer_name_th}</p>
            </div>
            <div>
              <p className="text-stone-500 mb-1">คลังสินค้า</p>
              <p className="font-medium">{sq.warehouse_name_th}</p>
            </div>
            <div className="col-span-2">
              <p className="text-stone-500 mb-1">หมายเหตุ</p>
              <p className="text-stone-900">{sq.notes || '-'}</p>
            </div>
          </div>
        </div>

        <div className={`${CARD} p-5 space-y-4`}>
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">วันที่ / Dates</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">วันที่สร้าง:</span>
              <span className="font-medium">{new Date(sq.created_at).toLocaleDateString('th-TH')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">ยืนราคาถึง:</span>
              <span className="font-medium">{sq.valid_until ? new Date(sq.valid_until).toLocaleDateString('th-TH') : '-'}</span>
            </div>
            {sq.sent_at && (
              <div className="flex justify-between">
                <span className="text-stone-500">วันที่ส่ง:</span>
                <span className="font-medium">{new Date(sq.sent_at).toLocaleDateString('th-TH')}</span>
              </div>
            )}
            {sq.accepted_at && (
              <div className="flex justify-between text-emerald-600">
                <span>วันที่ตอบรับ:</span>
                <span className="font-bold">{new Date(sq.accepted_at).toLocaleDateString('th-TH')}</span>
              </div>
            )}
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
              <th className="px-5 py-3 font-medium text-right">จำนวน / Qty</th>
              <th className="px-5 py-3 font-medium text-right">ราคาหน่วย / Unit Price</th>
              <th className="px-5 py-3 font-medium text-right">ส่วนลด / Disc.</th>
              <th className="px-5 py-3 font-medium text-right">รวม / Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {sq.lines?.map((line) => (
              <tr key={line.id} className="hover:bg-stone-50/50">
                <td className="px-5 py-4">
                  <div className="font-medium text-stone-900">{line.name_th}</div>
                  <div className="text-xs font-mono text-stone-400">{line.sku}</div>
                </td>
                <td className="px-5 py-4 text-right font-mono">{line.qty}</td>
                <td className="px-5 py-4 text-right font-mono">{formatCurrency(line.unit_price)}</td>
                <td className="px-5 py-4 text-right font-mono text-red-500">{line.discount_amount > 0 ? `-${formatCurrency(line.discount_amount)}` : '-'}</td>
                <td className="px-5 py-4 text-right font-mono font-bold text-stone-900">{formatCurrency(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="p-5 bg-stone-50 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm text-stone-500">
              <span>รวมมูลค่าสินค้า / Subtotal:</span>
              <span className="font-mono">{formatCurrency(sq.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-500">
              <span>ภาษีมูลค่าเพิ่ม / VAT (7%):</span>
              <span className="font-mono">{formatCurrency(sq.vat_amount)}</span>
            </div>
            <div className="h-px bg-stone-200 my-2" />
            <div className="flex justify-between text-lg font-bold text-stone-900">
              <span>ยอดสุทธิ / Total:</span>
              <span className="font-mono">{formatCurrency(sq.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
