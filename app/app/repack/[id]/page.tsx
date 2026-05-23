'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, StatusBadge, Modal, Input } from '@/components/ui';
import { get, patch } from '@/lib/api-client';
import type { RepackOrder } from '@/types';
import { formatDate, formatCurrency, formatNumber } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import { OverridePinModal } from '@/components/auth/OverridePinModal';
import { TrendingDown } from 'lucide-react';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function RepackOrderDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { lang } = useLanguage();
  
  const [order, setOrder] = useState<RepackOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [yieldLossQty, setYieldLossQty] = useState(0);
  const [yieldLossReason, setYieldLossReason] = useState('');
  const [overrideViolation, setOverrideViolation] = useState<{ loss_pct: number; threshold_pct: number } | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await get<RepackOrder>(`/api/repack/${id}`);
      setOrder(res);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  async function handleComplete(overrideToken?: string) {
    setProcessing(true);
    setError('');
    try {
      await patch(`/api/repack/${id}`, { 
        action: 'complete',
        yield_loss_qty: Number(yieldLossQty),
        yield_loss_reason: yieldLossReason,
        override_token: overrideToken
      });
      setShowCompleteModal(false);
      setOverrideViolation(null);
      await fetchOrder();
    } catch (err: unknown) {
      const e = err as { status?: number; details?: { code?: string; loss_pct: number; threshold_pct: number }; message?: string };
      if (e.status === 412 && e.details?.code === 'YIELD_OVER_THRESHOLD') {
        setOverrideViolation(e.details);
      } else {
        setError(e.message || 'Failed to complete repack');
        setShowCompleteModal(false);
      }
    } finally {
      setProcessing(false);
    }
  }

  function handlePrintLabels() {
    // Mock print functionality - in a real app, this would generate a PDF or send to a label printer
    alert('เตรียมส่งข้อมูลไปยังเครื่องพิมพ์บาร์โค้ด... \n' + 
      order?.items?.map(item => `- ${item.product_sku}: ${item.qty} labels`).join('\n')
    );
  }

  if (loading) return <div className="p-12 text-center text-stone-500">กำลังโหลด...</div>;
  if (!order) return <div className="p-12 text-center text-red-500">{error || 'ไม่พบข้อมูลใบสั่ง'}</div>;

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/app/repack')} className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12.5 15l-5-5 5-5" stroke="#444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-stone-900 leading-tight">
                ใบแบ่งบรรจุ {order.order_number}
              </h1>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-[13px] text-stone-500">
              สร้างโดย {order.created_by_name} เมื่อ {formatDate(order.created_at, lang)}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {order.status === 'draft' && (
            <Button 
              variant="primary" 
              className="bg-emerald-600 hover:bg-emerald-700 h-10 px-6" 
              onClick={() => setShowCompleteModal(true)}
              loading={processing}
            >
              ✓ ยืนยันการแบ่งบรรจุ
            </Button>
          )}
          {order.status === 'completed' && (
            <Button variant="outline" className="h-10 px-6" onClick={handlePrintLabels}>
              ⎙ พิมพ์บาร์โค้ด
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[13.5px]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className={CARD}>
            <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <h2 className="text-[13px] font-semibold text-stone-900 uppercase tracking-wider">ข้อมูลหลัก</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[11px] text-stone-400 uppercase font-bold tracking-widest block mb-1">สินค้าต้นทาง</label>
                <div className="font-medium text-stone-900">{order.source_product_name_th}</div>
                <div className="text-xs font-mono text-stone-500">{order.source_product_sku}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-stone-400 uppercase font-bold tracking-widest block mb-1">จำนวนที่แบ่ง</label>
                  <div className="text-lg font-mono font-bold text-stone-900">{formatNumber(order.source_qty, lang)}</div>
                </div>
                <div>
                  <label className="text-[11px] text-stone-400 uppercase font-bold tracking-widest block mb-1">คลังสินค้า</label>
                  <div className="text-[14px] text-stone-700">{order.warehouse_name_th}</div>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-stone-400 uppercase font-bold tracking-widest block mb-1">หมายเหตุ</label>
                <div className="text-[13px] text-stone-600 whitespace-pre-wrap">{order.notes || '-'}</div>
              </div>
            </div>
          </div>

          <div className={CARD}>
            <div className="p-5 border-b border-stone-100 bg-stone-50/50">
              <h2 className="text-[13px] font-semibold text-stone-900 uppercase tracking-wider">ต้นทุน (Costing)</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[11px] text-stone-400 uppercase font-bold tracking-widest block mb-1">ต้นทุนต้นทางต่อหน่วย</label>
                <div className="text-[15px] font-mono font-semibold text-stone-900">{formatCurrency(order.source_unit_cost, lang)}</div>
              </div>
              <div>
                <label className="text-[11px] text-stone-400 uppercase font-bold tracking-widest block mb-1">มูลค่ารวมต้นทาง</label>
                <div className="text-xl font-mono font-bold text-emerald-600">
                  {formatCurrency(Number(order.source_qty) * Number(order.source_unit_cost), lang)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items Column */}
        <div className="lg:col-span-2">
          <div className={CARD}>
            <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <h2 className="text-[13px] font-semibold text-stone-900 uppercase tracking-wider">รายการสินค้าปลายทาง (Output Items)</h2>
              <span className="text-xs text-stone-500">{order.items?.length || 0} รายการ</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-stone-50/30 text-stone-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="text-left p-4">สินค้า</th>
                    <th className="text-right p-4 w-32">จำนวน</th>
                    <th className="text-right p-4 w-32">ต้นทุน/หน่วย</th>
                    <th className="text-right p-4 w-32 font-bold">รวมต้นทุน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {order.items?.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/30 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-stone-900">{item.product_name_th}</div>
                        <div className="text-[11px] font-mono text-stone-500">{item.product_sku}</div>
                        {item.notes && <div className="text-[11px] text-stone-400 mt-1 italic">{item.notes}</div>}
                      </td>
                      <td className="p-4 text-right font-mono font-medium text-stone-700">
                        {formatNumber(item.qty, lang)}
                      </td>
                      <td className="p-4 text-right font-mono text-stone-600">
                        {formatCurrency(item.unit_cost, lang)}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-stone-900">
                        {formatCurrency(Number(item.qty) * Number(item.unit_cost), lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-stone-50/50">
                  <tr className="font-bold text-stone-900">
                    <td className="p-4" colSpan={3}>รวมมูลค่าที่ปันส่วนปลายทาง</td>
                    <td className="p-4 text-right font-mono text-lg border-t-2 border-stone-200">
                      {formatCurrency(order.items?.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unit_cost)), 0), lang)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Modal */}
      <Modal isOpen={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="ยืนยันการแบ่งบรรจุ (Complete Repack)">
        <div className="space-y-4 pt-2">
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 flex items-start gap-3">
            <TrendingDown className="w-5 h-5 text-amber-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-stone-900">บันทึกส่วนสูญเสีย (Yield Loss)</p>
              <p className="text-stone-500">หากมีสินค้าเสียหายหรือสูญหายระหว่างการแบ่งบรรจุ กรุณาระบุจำนวนที่นี่</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <Input 
               label="จำนวนที่สูญเสีย (Qty)" 
               type="number" 
               min="0"
               value={yieldLossQty} 
               onChange={(e) => setYieldLossQty(Number(e.target.value))}
               className="text-right font-mono"
             />
             <div className="flex flex-col justify-end pb-3 text-sm text-stone-400">
                / {formatNumber(order.source_qty, lang)} (ต้นทาง)
             </div>
          </div>

          {yieldLossQty > 0 && (
            <Input 
              label="เหตุผลที่สูญเสีย" 
              value={yieldLossReason} 
              onChange={(e) => setYieldLossReason(e.target.value)}
              placeholder="ระบุสาเหตุ (เช่น แตกหัก, หกเลอะ)..."
            />
          )}

          <div className="pt-4 border-t flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowCompleteModal(false)} disabled={processing}>ยกเลิก</Button>
            <Button className="bg-emerald-600" onClick={() => handleComplete()} loading={processing}>ยืนยันและตัดสต็อก</Button>
          </div>
        </div>
      </Modal>

      {/* Override PIN Modal */}
      <OverridePinModal
        isOpen={!!overrideViolation}
        action="repack_yield_override"
        onSuccess={(token) => handleComplete(token)}
        onClose={() => setOverrideViolation(null)}
      />
    </div>
  );
}
