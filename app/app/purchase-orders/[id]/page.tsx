'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, StatusBadge, Badge } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/format';
import Link from 'next/link';
import type { PurchaseOrder } from '@/types';
import { ApprovalDialog } from '@/components/purchase-orders/ApprovalDialog';

interface POInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  is_paid: boolean;
}

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPO = useCallback(async () => {
    setLoading(true);
    try { setPo(await get<PurchaseOrder>(`/api/purchase-orders/${id}`)); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchPO(); }, [fetchPO]);

  async function action(path: string) {
    setError('');
    setSuccess('');
    setActing(true);
    try {
      await post(`/api/purchase-orders/${id}/${path}`, {});
      await fetchPO();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setActing(false);
    }
  }

  async function handleApprove() {
    setError('');
    setSuccess('');
    setActing(true);
    try {
      const res = await post<{ grn_number: string }>(`/api/purchase-orders/${id}/approve`, {});
      setSuccess(`PO อนุมัติแล้ว — GRN: ${res.grn_number}`);
      setShowApproval(false);
      await fetchPO();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setActing(false);
    }
  }

  const summary = useMemo(() => {
    if (!po || !po.lines) return null;
    const totalLineDiscount = po.lines.reduce((s, l) => s + Number(l.line_discount || 0), 0);
    return {
      subtotal: Number(po.subtotal),
      totalLineDiscount,
      afterLineDiscount: Number(po.subtotal) - totalLineDiscount,
      billDiscount: Number(po.bill_discount),
      nonVatAmount: Number(po.non_vat_amount),
      preVat: Number(po.pre_vat_amount),
      vat: Number(po.vat_amount),
      netTotal: Number(po.total_amount),
    };
  }, [po]);

  if (loading) return <div className="py-16 text-center text-gray-400">กำลังโหลด...</div>;
  if (!po) return <div className="py-16 text-center text-gray-400">ไม่พบข้อมูล</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{po.po_number}</h1>
        </div>
        <StatusBadge status={po.status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'ผู้จำหน่าย', value: `${po.vendor_code} — ${po.vendor_name}` },
          { label: 'คลังสินค้า', value: `${po.warehouse_code} — ${po.warehouse_name}` },
          { label: 'วันที่คาดรับ', value: po.expected_date ? formatDate(po.expected_date) : '—' },
          { label: 'ผู้สร้าง', value: po.created_by_name },
        ].map((f) => (
          <div key={f.label} className="rounded-lg bg-white border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">{f.label}</p>
            <p className="text-sm font-medium">{f.value}</p>
          </div>
        ))}
      </div>

      {po.approved_at && (
        <div className="mb-6 rounded-lg bg-green-50 border border-green-100 p-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-green-800">
          <div><span className="text-green-600 font-medium">อนุมัติโดย:</span> {po.approved_by_name}</div>
          <div><span className="text-green-600 font-medium">อนุมัติเมื่อ:</span> {formatDate(po.approved_at)}</div>
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3 font-medium text-gray-600 w-10">#</th>
              <th className="p-3 font-medium text-gray-600">สินค้า</th>
              <th className="text-right p-3 font-medium text-gray-600">สั่ง</th>
              <th className="text-right p-3 font-medium text-gray-600">รับแล้ว</th>
              <th className="text-right p-3 font-medium text-gray-600">ราคา/หน่วย</th>
              <th className="text-right p-3 font-medium text-gray-600">ส่วนลด</th>
              <th className="text-right p-3 font-medium text-gray-600">รวม</th>
            </tr>
          </thead>
          <tbody>
            {po.lines?.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-3 text-gray-400">{l.line_number}</td>
                <td className="p-3">
                  <div className="font-mono text-xs text-gray-400">{l.sku}</div>
                  <div>{l.name_th}</div>
                </td>
                <td className="p-3 text-right font-mono">{l.qty_ordered}</td>
                <td className="p-3 text-right font-mono">
                  <span className={Number(l.qty_received) >= Number(l.qty_ordered) ? 'text-green-600 font-bold' : ''}>
                    {l.qty_received}
                  </span>
                </td>
                <td className="p-3 text-right font-mono">{formatCurrency(l.unit_price)}</td>
                <td className="p-3 text-right font-mono text-red-600">-{formatCurrency(l.line_discount)}</td>
                <td className="p-3 text-right font-medium font-mono">{formatCurrency(Number(l.qty_ordered) * Number(l.unit_price) - Number(l.line_discount))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-gray-50">
            <tr>
              <td colSpan={6} className="p-3 text-right text-sm text-gray-500">รวมสินค้า (ก่อนหัก)</td>
              <td className="p-3 text-right text-sm font-mono">{formatCurrency(po.subtotal)}</td>
            </tr>
            {summary && summary.totalLineDiscount > 0 && (
              <tr>
                <td colSpan={6} className="p-3 text-right text-sm text-red-600">ส่วนลดรวมรายการ</td>
                <td className="p-3 text-right text-sm text-red-600 font-mono">-{formatCurrency(summary.totalLineDiscount)}</td>
              </tr>
            )}
            {Number(po.bill_discount) > 0 && (
              <tr>
                <td colSpan={6} className="p-3 text-right text-sm text-red-600">ส่วนลดท้ายบิล</td>
                <td className="p-3 text-right text-sm text-red-600 font-mono">-{formatCurrency(po.bill_discount)}</td>
              </tr>
            )}
            {Number(po.non_vat_amount) > 0 && (
              <tr>
                <td colSpan={6} className="p-3 text-right text-sm text-gray-500">ยอดไม่เสียภาษี</td>
                <td className="p-3 text-right text-sm font-mono">{formatCurrency(po.non_vat_amount)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={6} className="p-3 text-right text-sm text-gray-500 border-t">ยอดก่อนภาษี</td>
              <td className="p-3 text-right text-sm font-medium font-mono border-t">{formatCurrency(po.pre_vat_amount)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="p-3 text-right text-sm text-gray-500">VAT 7%</td>
              <td className="p-3 text-right text-sm font-mono">{formatCurrency(po.vat_amount)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="p-3 text-right font-semibold">รวมทั้งสิ้น</td>
              <td className="p-3 text-right font-bold text-lg text-blue-700 font-mono">{formatCurrency(po.total_amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {(po.invoices?.length ?? 0) > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">ใบแจ้งหนี้ / Invoices</h2>
          <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 font-medium text-gray-600">เลขใบแจ้งหนี้</th>
                  <th className="p-3 font-medium text-gray-600">วันที่</th>
                  <th className="p-3 font-medium text-gray-600">ครบกำหนด</th>
                  <th className="text-right p-3 font-medium text-gray-600">จำนวน</th>
                  <th className="p-3 font-medium text-gray-600">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {po.invoices?.map((inv: POInvoice) => (
                  <tr key={inv.id} className="border-t">
                    <td className="p-3 font-mono">{inv.invoice_number}</td>
                    <td className="p-3">{formatDate(inv.invoice_date)}</td>
                    <td className="p-3">{formatDate(inv.due_date)}</td>
                    <td className="p-3 text-right font-medium font-mono">{formatCurrency(inv.amount)}</td>
                    <td className="p-3"><Badge variant={inv.is_paid ? 'green' : 'yellow'}>{inv.is_paid ? 'ชำระแล้ว' : 'ค้างชำระ'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600 text-right">{error}</p>}
      {success && (
        <div className="mb-4 rounded-lg bg-green-100 border border-green-200 p-4 text-green-800 text-center font-bold">
          {success}
        </div>
      )}

      <div className="flex gap-3 justify-end items-center">
        {po.status === 'draft' && (
          <>
            <Button variant="secondary" onClick={() => router.push(`/app/purchase-orders/${id}/edit`)}>แก้ไข</Button>
            <Button variant="danger" onClick={() => action('cancel')} loading={acting}>ยกเลิก PO</Button>
            <Button variant="secondary" onClick={() => action('send')} loading={acting}>ส่ง PO</Button>
            <Button onClick={() => setShowApproval(true)} disabled={acting}>อนุมัติกัน</Button>
          </>
        )}
        {po.status === 'sent' && (
          <>
            <Button variant="danger" onClick={() => action('cancel')} loading={acting}>ยกเลิก PO</Button>
            <Link href={`/app/grn/new?po_id=${id}`}><Button>สร้างใบรับสินค้า</Button></Link>
          </>
        )}
      </div>

      {summary && po.lines && (
        <ApprovalDialog
          open={showApproval}
          onClose={() => setShowApproval(false)}
          vendorName={po.vendor_name}
          lines={po.lines.map(l => ({ ...l, product_id: l.sku }))} // product_id not used in dialog UI, just needs a string
          summary={summary}
          onConfirm={handleApprove}
          loading={acting}
        />
      )}
    </div>
  );
}
