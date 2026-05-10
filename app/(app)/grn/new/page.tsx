'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { Warehouse, PaginatedResponse } from '@/types';

interface GRNLine {
  po_line_item_id: string;
  product_id: string;
  product_label: string;
  qty_ordered: number;
  qty_received: number;
  lot_number: string;
  expiry_date: string;
}

interface POItem {
  id: string;
  po_number: string;
  vendor_name: string;
}

interface PODetail {
  warehouse_id: string | null;
  lines: Array<{
    id: string;
    product_id: string;
    sku: string;
    name_th: string;
    qty_ordered: number;
    qty_received: number | null;
  }>;
}

export default function NewGRNPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poId = searchParams.get('po_id');

  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [poOptions, setPoOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedPoId, setSelectedPoId] = useState(poId ?? '');
  const [warehouseId, setWarehouseId] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<GRNLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then((data) =>
      setWarehouses(data.map((w) => ({ value: w.id, label: `${w.code} — ${w.name_th}` })))
    );
    get<PaginatedResponse<POItem>>('/api/purchase-orders?status=sent&limit=100').then((r) =>
      setPoOptions(r.data.map((po) => ({ value: po.id, label: `${po.po_number} — ${po.vendor_name}` })))
    );
  }, []);

  useEffect(() => {
    if (!selectedPoId) { setLines([]); return; }
    get<PODetail>(`/api/purchase-orders/${selectedPoId}`).then((po) => {
      setWarehouseId(po.warehouse_id ?? '');
      setLines(
        (po.lines ?? []).map((l) => ({
          po_line_item_id: l.id,
          product_id: l.product_id,
          product_label: `${l.sku} — ${l.name_th}`,
          qty_ordered: l.qty_ordered,
          qty_received: l.qty_ordered - (l.qty_received ?? 0),
          lot_number: '',
          expiry_date: '',
        }))
      );
    });
  }, [selectedPoId]);

  function updateLine(i: number, key: keyof GRNLine, val: string | number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  async function handleSubmit() {
    if (!selectedPoId) { setError('กรุณาเลือกใบสั่งซื้อ'); return; }
    if (!warehouseId) { setError('กรุณาเลือกคลังสินค้า'); return; }
    if (lines.length === 0) { setError('ไม่มีรายการสินค้า'); return; }
    const activeLines = lines.filter((l) => l.qty_received > 0);
    if (activeLines.length === 0) { setError('กรุณาระบุจำนวนที่รับ'); return; }

    const overReceived = activeLines.find((l) => l.qty_received > l.qty_ordered);
    if (overReceived) {
      setError(`จำนวนรับ (${overReceived.qty_received}) เกินจำนวนสั่งซื้อคงเหลือ (${overReceived.qty_ordered}) สำหรับ ${overReceived.product_label}`);
      return;
    }

    setError('');
    setSaving(true);
    try {
      const result = await post<{ id: string }>('/api/grn', {
        po_id: selectedPoId,
        warehouse_id: warehouseId,
        received_date: receivedDate,
        notes: notes || undefined,
        lines: activeLines.map((l) => ({
          po_line_item_id: l.po_line_item_id,
          product_id: l.product_id,
          qty_received: l.qty_received,
          lot_number: l.lot_number || undefined,
          expiry_date: l.expiry_date || undefined,
        })),
      });
      router.push(`/app/grn/${result.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">สร้างใบรับสินค้า (GRN)</h1>
        <button className="text-sm text-gray-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="ใบสั่งซื้อ *"
            value={selectedPoId}
            onChange={(e) => setSelectedPoId(e.target.value)}
            options={poOptions}
            placeholder="เลือกใบสั่งซื้อ (สถานะ sent)"
          />
          <Select
            label="คลังสินค้า *"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            options={warehouses}
            placeholder="เลือกคลังสินค้า"
          />
          <Input label="วันที่รับสินค้า *" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
          <Input label="หมายเหตุ" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {lines.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">รายการสินค้า</h2>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600">สินค้า</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-24">สั่งซื้อคงเหลือ</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-24">รับครั้งนี้</th>
                    <th className="p-3 font-medium text-gray-600 w-32">Lot Number</th>
                    <th className="p-3 font-medium text-gray-600 w-36">วันหมดอายุ</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">{l.product_label}</td>
                      <td className="p-3 text-right text-gray-500 font-mono">{l.qty_ordered}</td>
                      <td className="p-2">
                        <input type="number" min="0" max={l.qty_ordered} step="any" value={l.qty_received}
                          onChange={(e) => updateLine(i, 'qty_received', parseFloat(e.target.value) || 0)}
                          className="w-full text-right rounded border px-2 py-1" />
                      </td>
                      <td className="p-2">
                        <input value={l.lot_number} onChange={(e) => updateLine(i, 'lot_number', e.target.value)}
                          className="w-full rounded border px-2 py-1 text-sm" placeholder="LOT-001..." />
                      </td>
                      <td className="p-2">
                        <input type="date" value={l.expiry_date} onChange={(e) => updateLine(i, 'expiry_date', e.target.value)}
                          className="w-full rounded border px-2 py-1 text-sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!selectedPoId && (
          <p className="text-sm text-gray-400">เลือกใบสั่งซื้อก่อนเพื่อโหลดรายการสินค้า</p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={handleSubmit} loading={saving} disabled={!selectedPoId || lines.length === 0}>
            สร้าง GRN
          </Button>
        </div>
      </div>
    </div>
  );
}
