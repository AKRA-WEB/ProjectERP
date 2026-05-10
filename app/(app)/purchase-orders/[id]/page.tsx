'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, StatusBadge, Badge } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/format';
import Link from 'next/link';
import type { PoStatus } from '@/types';

interface POLine {
  id: string;
  line_number: number;
  sku: string;
  name_th: string;
  name_en: string;
  qty_ordered: number;
  qty_received: number;
  unit_price: number;
  line_total: number;
}

interface POInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  is_paid: boolean;
}

interface PODetail {
  id: string;
  po_number: string;
  status: PoStatus;
  vendor_code: string;
  vendor_name: string;
  warehouse_code: string;
  warehouse_name: string;
  expected_date: string | null;
  created_by_name: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  lines: POLine[];
  invoices: POInvoice[];
}

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [po, setPo] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');

  async function fetchPO() {
    setLoading(true);
    try { setPo(await get<PODetail>(`/api/purchase-orders/${id}`)); } finally { setLoading(false); }
  }

  useEffect(() => { fetchPO(); }, [id]);

  async function action(path: string) {
    setError('');
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

  if (loading) return <div className="py-16 text-center text-gray-400">กำลังโหลด...</div>;
  if (!po) return <div className="py-16 text-center text-gray-400">ไม่พบข้อมูล</div>;

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{po.po_number}</h1>
        </div>
        <StatusBadge status={po.status} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-medium text-gray-600">#</th>
              <th className="text-left p-3 font-medium text-gray-600">SKU</th>
              <th className="text-left p-3 font-medium text-gray-600">สินค้า</th>
              <th className="text-right p-3 font-medium text-gray-600">สั่ง</th>
              <th className="text-right p-3 font-medium text-gray-600">รับแล้ว</th>
              <th className="text-right p-3 font-medium text-gray-600">ราคา/หน่วย</th>
              <th className="text-right p-3 font-medium text-gray-600">รวม</th>
            </tr>
          </thead>
          <tbody>
            {po.lines?.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-3 text-gray-400">{l.line_number}</td>
                <td className="p-3 font-mono text-xs">{l.sku}</td>
                <td className="p-3">
                  <div>{l.name_th}</div>
                  <div className="text-xs text-gray-400">{l.name_en}</div>
                </td>
                <td className="p-3 text-right">{l.qty_ordered}</td>
                <td className="p-3 text-right">
                  <span className={Number(l.qty_received) >= Number(l.qty_ordered) ? 'text-green-600 font-medium' : ''}>
                    {l.qty_received}
                  </span>
                </td>
                <td className="p-3 text-right">{formatCurrency(l.unit_price)}</td>
                <td className="p-3 text-right font-medium">{formatCurrency(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-gray-50">
            <tr>
              <td colSpan={6} className="p-3 text-right text-sm text-gray-500">ก่อน VAT</td>
              <td className="p-3 text-right text-sm font-medium">{formatCurrency(po.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="p-3 text-right text-sm text-gray-500">VAT 7%</td>
              <td className="p-3 text-right text-sm">{formatCurrency(po.vat_amount)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="p-3 text-right font-semibold">รวมทั้งสิ้น</td>
              <td className="p-3 text-right font-bold text-lg">{formatCurrency(po.total_amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {po.invoices?.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">ใบแจ้งหนี้ / Invoices</h2>
          <div className="rounded-xl bg-white shadow-sm border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">เลขใบแจ้งหนี้</th>
                  <th className="text-left p-3 font-medium text-gray-600">วันที่</th>
                  <th className="text-left p-3 font-medium text-gray-600">ครบกำหนด</th>
                  <th className="text-right p-3 font-medium text-gray-600">จำนวน</th>
                  <th className="text-left p-3 font-medium text-gray-600">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {po.invoices.map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="p-3 font-mono">{inv.invoice_number}</td>
                    <td className="p-3">{formatDate(inv.invoice_date)}</td>
                    <td className="p-3">{formatDate(inv.due_date)}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(inv.amount)}</td>
                    <td className="p-3"><Badge variant={inv.is_paid ? 'green' : 'yellow'}>{inv.is_paid ? 'ชำระแล้ว' : 'ค้างชำระ'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 justify-end">
        {po.status === 'draft' && (
          <>
            <Button variant="secondary" onClick={() => router.push(`/app/purchase-orders/${id}/edit`)}>แก้ไข</Button>
            <Button variant="danger" onClick={() => action('cancel')} loading={acting}>ยกเลิก PO</Button>
            <Button onClick={() => action('send')} loading={acting}>ส่ง PO</Button>
          </>
        )}
        {po.status === 'sent' && (
          <>
            <Button variant="danger" onClick={() => action('cancel')} loading={acting}>ยกเลิก PO</Button>
            <Link href={`/app/grn/new?po_id=${id}`}><Button>สร้างใบรับสินค้า</Button></Link>
          </>
        )}
      </div>
    </div>
  );
}
