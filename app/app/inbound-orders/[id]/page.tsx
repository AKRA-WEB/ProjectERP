'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, StatusBadge, Input } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import { formatDate, formatQty, formatCurrency } from '@/lib/format';
import type { InboundOrder } from '@/types';
import Link from 'next/link';

interface IOLine {
  id: string;
  sku: string;
  name_th: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
  uom_code: string;
  qty_available: number;
}

interface IODetail extends InboundOrder {
  lines: IOLine[];
  grns: Array<{
    id: string;
    grn_number: string;
    status: string;
    received_date: string;
    received_by_name: string;
  }>;
}

export default function InboundOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [io, setIo] = useState<IODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendorRef, setVendorRef] = useState('');
  const [error, setError] = useState('');

  const fetchIO = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<IODetail>(`/api/inbound-orders/${id}`);
      setIo(data);
      if (data.vendor_ref) setVendorRef(data.vendor_ref);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchIO(); }, [fetchIO]);

  async function handleClose() {
    if (!vendorRef) { setError('กรุณาระบุเลขที่อ้างอิงจากผู้จำหน่าย'); return; }
    setError('');
    setSaving(true);
    try {
      await post(`/api/inbound-orders/${id}/close`, { vendor_ref: vendorRef });
      await fetchIO();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-16 text-center text-gray-400">กำลังโหลด...</div>;
  if (!io) return <div className="py-16 text-center text-gray-400">ไม่พบข้อมูล</div>;

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{io.io_number}</h1>
        </div>
        <StatusBadge status={io.status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'ผู้จำหน่าย', value: io.vendor_name },
          { label: 'คลังสินค้า', value: `${io.warehouse_code} — ${io.warehouse_name}` },
          { label: 'ผู้สร้าง', value: io.created_by_name },
          { label: 'วันที่สร้าง', value: formatDate(io.created_at) },
        ].map((f) => (
          <div key={f.label} className="rounded-lg bg-white border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">{f.label}</p>
            <p className="text-sm font-medium">{f.value}</p>
          </div>
        ))}
      </div>

      {io.notes && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
          <p className="text-xs text-blue-600 font-medium uppercase tracking-wider mb-1">หมายเหตุ / Context from LINE</p>
          <p className="text-sm text-blue-900 whitespace-pre-wrap">{io.notes}</p>
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold text-gray-700">รายการสินค้า / Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-3 font-medium">SKU / สินค้า</th>
              <th className="text-right p-3 font-medium w-24">สั่ง</th>
              <th className="text-right p-3 font-medium w-24">รับแล้ว</th>
              <th className="text-right p-3 font-medium w-24">สต็อก WH</th>
              <th className="text-right p-3 font-medium w-32">ทุนต่อหน่วย</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {io.lines.map((l) => (
              <tr key={l.id}>
                <td className="p-3">
                  <div className="font-mono text-xs text-gray-400">{l.sku}</div>
                  <div className="font-medium">{l.name_th}</div>
                </td>
                <td className="p-3 text-right font-mono">{formatQty(l.qty_ordered)}</td>
                <td className={`p-3 text-right font-mono ${Number(l.qty_received) >= Number(l.qty_ordered) ? 'text-green-600 font-bold' : 'text-gray-900'}`}>
                  {formatQty(l.qty_received)}
                </td>
                <td className="p-3 text-right font-mono text-gray-400">{formatQty(l.qty_available)}</td>
                <td className="p-3 text-right font-mono">{formatCurrency(l.unit_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {io.grns.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700">ใบรับสินค้าที่เชื่อมโยง / Linked GRNs</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-3 font-medium">เลข GRN</th>
                <th className="text-left p-3 font-medium">วันที่รับ</th>
                <th className="text-left p-3 font-medium">ผู้รับ</th>
                <th className="text-center p-3 font-medium">สถานะ</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {io.grns.map((g) => (
                <tr key={g.id}>
                  <td className="p-3 font-mono">{g.grn_number}</td>
                  <td className="p-3">{formatDate(g.received_date)}</td>
                  <td className="p-3">{g.received_by_name}</td>
                  <td className="p-3 text-center"><StatusBadge status={g.status} /></td>
                  <td className="p-3 text-right">
                    <Link href={`/app/grn/${g.id}`} className="text-blue-600 hover:underline">ดู</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-end justify-end">
        {io.status === 'verified' && (
          <div className="w-full sm:w-80 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <label className="block text-xs font-medium text-gray-500 uppercase mb-2">บันทึกเลขอ้างอิงผู้จำหน่าย (เช่น เลขบิล)</label>
            <div className="flex gap-2">
              <Input placeholder="เลขที่บิล / Invoice..." value={vendorRef} onChange={(e) => setVendorRef(e.target.value)} className="bg-white" />
              <Button onClick={handleClose} loading={saving}>ปิด IO</Button>
            </div>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        )}

        {['open', 'receiving', 'pending_verification'].includes(io.status) && (
          <Link href={`/app/grn/new?io_id=${io.id}`}>
            <Button size="lg">สร้างใบรับสินค้า (GRN)</Button>
          </Link>
        )}
      </div>

      {io.status === 'closed' && (
        <div className="mt-6 rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
          <p className="text-gray-500 font-medium">รายการนี้ปิดแล้ว</p>
          <div className="mt-2 text-sm text-gray-400 space-y-1">
            <p>เลขอ้างอิงผู้จำหน่าย: <span className="font-mono text-gray-600">{io.vendor_ref}</span></p>
            <p>ตรวจสอบโดย: {io.verified_by_name} เมื่อ {io.verified_at ? formatDate(io.verified_at) : '—'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
