'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import { formatQty } from '@/lib/format';
import { useSession } from 'next-auth/react';
import type { Warehouse, PaginatedResponse } from '@/types';

interface GRNLine {
  po_line_item_id?: string;
  inbound_order_line_id?: string;
  product_id: string;
  product_label: string;
  qty_ordered: number;
  qty_received: number;
  qty_on_hand: number;
  qty_available: number;
  lot_number: string;
  expiry_date: string;
  storage_location: string;
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
    qty_on_hand: number;
    qty_available: number;
  }>;
}

interface IODetail {
  id: string;
  io_number: string;
  vendor_name: string;
  warehouse_id: string;
  lines: Array<{
    id: string;
    product_id: string;
    sku: string;
    name_th: string;
    qty_ordered: number;
    qty_received: number;
    qty_available: number;
  }>;
}

function NewGRNPageInner() {
  const router = useRouter();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const poIdParam = searchParams.get('po_id');
  const ioIdParam = searchParams.get('io_id');
  const mode = ioIdParam ? 'io' : 'po';

  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [poOptions, setPoOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedPoId, setSelectedPoId] = useState(poIdParam ?? '');
  const [ioDetail, setIoDetail] = useState<IODetail | null>(null);
  
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
    if (mode === 'po') {
      get<PaginatedResponse<POItem>>('/api/purchase-orders?status=sent&limit=100').then((r) =>
        setPoOptions(r.data.map((po) => ({ value: po.id, label: `${po.po_number} — ${po.vendor_name}` })))
      );
    }
  }, [mode]);

  // PO Mode: Load lines
  useEffect(() => {
    if (mode !== 'po' || !selectedPoId) { if (mode === 'po') setLines([]); return; }
    get<PODetail>(`/api/purchase-orders/${selectedPoId}`).then((po) => {
      setWarehouseId(po.warehouse_id ?? '');
      setLines(
        (po.lines ?? []).map((l) => ({
          po_line_item_id: l.id,
          product_id: l.product_id,
          product_label: `${l.sku} — ${l.name_th}`,
          qty_ordered: Number(l.qty_ordered),
          qty_received: Number(l.qty_ordered) - Number(l.qty_received ?? 0),
          qty_on_hand: Number(l.qty_on_hand ?? 0),
          qty_available: Number(l.qty_available ?? 0),
          lot_number: '',
          expiry_date: '',
          storage_location: '',
        }))
      );
    });
  }, [selectedPoId, mode]);

  // IO Mode: Load lines
  useEffect(() => {
    if (mode !== 'io' || !ioIdParam) return;
    get<IODetail>(`/api/inbound-orders/${ioIdParam}`).then((io) => {
      setIoDetail(io);
      setWarehouseId(io.warehouse_id);
      setLines(
        (io.lines ?? []).map((l) => ({
          inbound_order_line_id: l.id,
          product_id: l.product_id,
          product_label: `${l.sku} — ${l.name_th}`,
          qty_ordered: Number(l.qty_ordered),
          qty_received: Math.max(0, Number(l.qty_ordered) - Number(l.qty_received)),
          qty_on_hand: 0, // not returned by IO detail yet in basic query, using qty_available
          qty_available: Number(l.qty_available ?? 0),
          lot_number: '',
          expiry_date: '',
          storage_location: '',
        }))
      );
    });
  }, [ioIdParam, mode]);

  function updateLine(i: number, key: keyof GRNLine, val: string | number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  async function handleSubmit() {
    if (mode === 'po' && !selectedPoId) { setError('กรุณาเลือกใบสั่งซื้อ'); return; }
    if (mode === 'io' && !ioIdParam) { setError('ไม่พบรหัส IO'); return; }
    if (!warehouseId) { setError('กรุณาเลือกคลังสินค้า'); return; }
    if (lines.length === 0) { setError('ไม่มีรายการสินค้า'); return; }
    const activeLines = lines.filter((l) => l.qty_received > 0);
    if (activeLines.length === 0) { setError('กรุณาระบุจำนวนที่รับ'); return; }

    setError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        warehouse_id: warehouseId,
        received_date: receivedDate,
        notes: notes || undefined,
        lines: activeLines.map((l) => ({
          po_line_item_id: l.po_line_item_id,
          inbound_order_line_id: l.inbound_order_line_id,
          product_id: l.product_id,
          qty_received: l.qty_received,
          lot_number: l.lot_number || undefined,
          expiry_date: l.expiry_date || undefined,
          storage_location: l.storage_location || undefined,
        })),
      };

      if (mode === 'po') payload.po_id = selectedPoId;
      else payload.inbound_order_id = ioIdParam;

      const result = await post<{ id: string }>('/api/grn', payload);
      router.push(`/app/grn/${result.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'io' ? 'รับสินค้า (Inbound Order)' : 'รับสินค้า (Purchase Order)'}
        </h1>
        <button className="text-sm text-gray-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            {mode === 'po' ? (
              <Select
                label="ใบสั่งซื้อ *"
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                options={poOptions}
                placeholder="เลือกใบสั่งซื้อ (สถานะ sent)"
              />
            ) : (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-blue-600 font-medium uppercase mb-1">Inbound Order</p>
                <p className="font-mono text-sm font-bold text-blue-900">{ioDetail?.io_number}</p>
                <p className="text-xs text-blue-700 mt-1">{ioDetail?.vendor_name}</p>
              </div>
            )}
            <Select
              label="คลังสินค้า *"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              options={warehouses}
              placeholder="เลือกคลังสินค้า"
              disabled={mode === 'io'} // IO has fixed warehouse
            />
          </div>
          <div className="space-y-4">
            <Input label="วันที่รับสินค้า *" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
            <Input label="หมายเหตุ" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="bg-gray-50 rounded-lg p-4 flex flex-col justify-center">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">ผู้รับสินค้า / Receiver</label>
            <p className="text-sm font-semibold text-gray-900">{session?.user?.name ?? '—'}</p>
            <p className="text-xs text-gray-400 mt-1">บันทึกอัตโนมัติจากผู้ใช้ที่ล็อกอิน</p>
          </div>
        </div>

        {lines.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">รายการสินค้า</h2>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600 min-w-[200px]">สินค้า</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-24">สต็อกเดิม</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-24">{mode === 'io' ? 'สั่ง IO' : 'สั่งคงเหลือ'}</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-24">รับครั้งนี้</th>
                    <th className="p-3 font-medium text-gray-600 w-32">Lot Number</th>
                    <th className="p-3 font-medium text-gray-600 w-32">ตำแหน่งเก็บ</th>
                    <th className="p-3 font-medium text-gray-600 w-36">วันหมดอายุ</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">{l.product_label}</td>
                      <td className={`p-3 text-right font-mono ${l.qty_available <= 0 ? 'text-red-500 font-bold' : l.qty_available < 10 ? 'text-yellow-600' : 'text-gray-500'}`}>
                        {formatQty(l.qty_available)}
                      </td>
                      <td className="p-3 text-right text-gray-500 font-mono">{formatQty(l.qty_ordered)}</td>
                      <td className="p-2">
                        <input type="number" min="0" step="any" value={l.qty_received}
                          onChange={(e) => updateLine(i, 'qty_received', parseFloat(e.target.value) || 0)}
                          className="w-full text-right rounded border px-2 py-1" />
                      </td>
                      <td className="p-2">
                        <input value={l.lot_number} onChange={(e) => updateLine(i, 'lot_number', e.target.value)}
                          className="w-full rounded border px-2 py-1 text-sm" placeholder="LOT..." />
                      </td>
                      <td className="p-2">
                        <input value={l.storage_location} onChange={(e) => updateLine(i, 'storage_location', e.target.value)}
                          className="w-full rounded border px-2 py-1 text-sm" placeholder="เช่น A-1" />
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

        {mode === 'po' && !selectedPoId && (
          <p className="text-sm text-gray-400 text-center py-8 border-2 border-dashed rounded-lg">
            เลือกใบสั่งซื้อก่อนเพื่อโหลดรายการสินค้า
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={handleSubmit} loading={saving} disabled={(mode === 'po' && !selectedPoId) || lines.length === 0}>
            {mode === 'io' ? 'บันทึกการรับสินค้า' : 'สร้าง GRN'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NewGRNPage() {
  return (
    <Suspense>
      <NewGRNPageInner />
    </Suspense>
  );
}
