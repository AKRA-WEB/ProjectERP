'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { Warehouse, Product } from '@/types';

interface LineItem {
  product_id: string;
  product_label: string;
  qty_requested: number;
  unit_cost: number;
  notes: string;
}

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<any[]>('/api/admin/warehouses').then((data) =>
      setWarehouses(data.map((w: any) => ({ value: w.id, label: `${w.code} — ${w.name_th}` })))
    );
  }, []);

  async function searchProducts(q: string) {
    setProductSearch(q);
    if (!q) { setProductResults([]); return; }
    const res = await get<any>(`/api/products?search=${encodeURIComponent(q)}&limit=10`);
    setProductResults(res.data ?? []);
  }

  function addProduct(p: Product) {
    setLines((prev) => [...prev, {
      product_id: p.id,
      product_label: `${p.sku} — ${p.name_th}`,
      qty_requested: 1,
      unit_cost: p.unit_cost ?? 0,
      notes: '',
    }]);
    setProductSearch('');
    setProductResults([]);
  }

  function updateLine(i: number, key: keyof LineItem, val: string | number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(submit: boolean) {
    if (!warehouseId) { setError('กรุณาเลือกคลังสินค้า'); return; }
    if (lines.length === 0) { setError('กรุณาเพิ่มรายการสินค้า'); return; }
    setError('');
    setSaving(true);
    try {
      const pr = await post<{ id: string }>('/api/purchase-requests', {
        warehouse_id: warehouseId,
        notes: notes || undefined,
        lines: lines.map((l) => ({ product_id: l.product_id, qty_requested: l.qty_requested, unit_cost: l.unit_cost, notes: l.notes || undefined })),
      });
      if (submit) {
        await post(`/api/purchase-requests/${pr.id}/submit`, {});
      }
      router.push(`/app/purchase-requests/${pr.id}`);
    } catch (e: any) {
      setError(e.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">สร้างคำขอซื้อใหม่</h1>
        <button className="text-sm text-gray-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-6">
        <Select
          label="คลังสินค้า *"
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          options={warehouses}
          placeholder="เลือกคลังสินค้า"
        />
        <Input label="หมายเหตุ" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">รายการสินค้า</h2>

          <div className="relative mb-4">
            <Input
              label="ค้นหาสินค้า"
              value={productSearch}
              onChange={(e) => searchProducts(e.target.value)}
              placeholder="พิมพ์ SKU หรือชื่อสินค้า..."
            />
            {productResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                {productResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                    onClick={() => addProduct(p)}
                  >
                    <span className="font-mono font-medium">{p.sku}</span> — {p.name_th}
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600">สินค้า</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-28">จำนวน</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-32">ราคาทุน</th>
                    <th className="text-left p-3 font-medium text-gray-600">หมายเหตุ</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">{l.product_label}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={l.qty_requested}
                          onChange={(e) => updateLine(i, 'qty_requested', parseFloat(e.target.value) || 0)}
                          className="w-full text-right rounded border px-2 py-1"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={l.unit_cost}
                          onChange={(e) => updateLine(i, 'unit_cost', parseFloat(e.target.value) || 0)}
                          className="w-full text-right rounded border px-2 py-1"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          value={l.notes}
                          onChange={(e) => updateLine(i, 'notes', e.target.value)}
                          className="w-full rounded border px-2 py-1"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => handleSubmit(false)} loading={saving}>บันทึกร่าง</Button>
          <Button onClick={() => handleSubmit(true)} loading={saving}>บันทึกและส่งอนุมัติ</Button>
        </div>
      </div>
    </div>
  );
}
