'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { Warehouse, PaginatedResponse } from '@/types';

interface CCLine {
  product_id: string;
  product_label: string;
  lot_id?: string;
  qty_system: number;
}

interface StockSearchResult {
  product_id: string;
  sku: string;
  name_th: string;
  qty_on_hand: string | number;
  uom_code: string;
}

export default function NewCycleCountPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<CCLine[]>([]);
  const [stockSearch, setStockSearch] = useState('');
  const [stockResults, setStockResults] = useState<StockSearchResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then((data) =>
      setWarehouses(data.map((w) => ({ value: w.id, label: `${w.code} — ${w.name_th}` })))
    );
  }, []);

  async function searchStock(q: string) {
    setStockSearch(q);
    if (!q || !warehouseId) { setStockResults([]); return; }
    const res = await get<PaginatedResponse<StockSearchResult>>(`/api/stock?warehouse_id=${warehouseId}&search=${encodeURIComponent(q)}&limit=10`);
    setStockResults(res.data ?? []);
  }

  function addLine(item: StockSearchResult) {
    if (lines.find((l) => l.product_id === item.product_id)) {
      setStockSearch('');
      setStockResults([]);
      return;
    }
    setLines((prev) => [...prev, {
      product_id: item.product_id,
      product_label: `${item.sku} — ${item.name_th}`,
      qty_system: Number(item.qty_on_hand ?? 0),
    }]);
    setStockSearch('');
    setStockResults([]);
  }

  function addAllStock() {
    if (!warehouseId) return;
    get<PaginatedResponse<StockSearchResult>>(`/api/stock?warehouse_id=${warehouseId}&limit=200`).then((res) => {
      const all = (res.data ?? []).map((item) => ({
        product_id: item.product_id,
        product_label: `${item.sku} — ${item.name_th}`,
        qty_system: Number(item.qty_on_hand ?? 0),
      }));
      setLines(all);
    });
  }

  function updateQtySystem(i: number, val: number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, qty_system: val } : l));
  }

  async function handleSubmit() {
    if (!warehouseId) { setError('กรุณาเลือกคลังสินค้า'); return; }
    if (lines.length === 0) { setError('กรุณาเพิ่มรายการสินค้า'); return; }
    setError('');
    setSaving(true);
    try {
      const result = await post<{ id: string }>('/api/cycle-counts', {
        warehouse_id: warehouseId,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          lot_id: l.lot_id,
          qty_system: l.qty_system,
        })),
      });
      router.push(`/app/cycle-counts/${result.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">สร้างการนับสต็อก</h1>
        <button className="text-sm text-gray-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="คลังสินค้า *"
            value={warehouseId}
            onChange={(e) => { setWarehouseId(e.target.value); setLines([]); }}
            options={warehouses}
            placeholder="เลือกคลังสินค้า"
          />
          <Input label="หมายเหตุ" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">รายการสินค้าที่จะนับ</h2>
            {warehouseId && (
              <button onClick={addAllStock} className="text-sm text-blue-600 hover:underline">
                + เพิ่มทั้งคลัง
              </button>
            )}
          </div>

          {warehouseId ? (
            <div className="relative mb-4">
              <Input
                label="ค้นหาสินค้าเพื่อเพิ่ม"
                value={stockSearch}
                onChange={(e) => searchStock(e.target.value)}
                placeholder="พิมพ์ SKU หรือชื่อสินค้า..."
              />
              {stockResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                  {stockResults.map((s, i) => (
                    <button key={i} type="button" className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm" onClick={() => addLine(s)}>
                      <span className="font-mono font-medium">{s.sku}</span> — {s.name_th}
                      <span className="ml-2 text-gray-400">ยอดระบบ: {s.qty_on_hand} {s.uom_code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4">เลือกคลังก่อน</p>
          )}

          {lines.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600">สินค้า</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-32">ยอดระบบ</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">{l.product_label}</td>
                      <td className="p-2">
                        <input type="number" min="0" step="any" value={l.qty_system}
                          onChange={(e) => updateQtySystem(i, parseFloat(e.target.value) || 0)}
                          className="w-full text-right rounded border px-2 py-1" />
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={handleSubmit} loading={saving}>สร้างรอบนับสต็อก</Button>
        </div>
      </div>
    </div>
  );
}
