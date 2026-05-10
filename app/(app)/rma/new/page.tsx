'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { Vendor, Warehouse, Product, PaginatedResponse } from '@/types';

interface RMALine {
  product_id: string;
  product_label: string;
  qty_returned: number;
  condition: 'resaleable' | 'repack_resell' | 'damaged_return_vendor';
  notes: string;
}

export default function NewRMAPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<{ value: string; label: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [form, setForm] = useState({ vendor_id: '', warehouse_id: '', notes: '' });
  const [lines, setLines] = useState<RMALine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<PaginatedResponse<Vendor>>('/api/vendors?limit=200').then((r) =>
      setVendors(r.data.map((v) => ({ value: v.id, label: `${v.code} — ${v.name_th}` })))
    );
    get<Warehouse[]>('/api/admin/warehouses').then((data) =>
      setWarehouses(data.map((w) => ({ value: w.id, label: `${w.code} — ${w.name_th}` })))
    );
  }, []);

  function setF(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function searchProducts(q: string) {
    setProductSearch(q);
    if (!q) { setProductResults([]); return; }
    const res = await get<PaginatedResponse<Product>>(`/api/products?search=${encodeURIComponent(q)}&limit=10`);
    setProductResults(res.data ?? []);
  }

  function addProduct(p: Product) {
    setLines((prev) => [...prev, {
      product_id: p.id,
      product_label: `${p.sku} — ${p.name_th}`,
      qty_returned: 1,
      condition: 'resaleable',
      notes: '',
    }]);
    setProductSearch('');
    setProductResults([]);
  }

  function updateLine(i: number, key: keyof RMALine, val: string | number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  async function handleSubmit() {
    if (!form.vendor_id) { setError('กรุณาเลือกผู้จำหน่าย'); return; }
    if (!form.warehouse_id) { setError('กรุณาเลือกคลังสินค้า'); return; }
    if (lines.length === 0) { setError('กรุณาเพิ่มรายการสินค้า'); return; }
    setError('');
    setSaving(true);
    try {
      const result = await post<{ id: string }>('/api/rma', {
        ...form,
        notes: form.notes || undefined,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          qty_returned: l.qty_returned,
          condition: l.condition,
          notes: l.notes || undefined,
        })),
      });
      router.push(`/app/rma/${result.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">สร้างคำขอคืนสินค้า (RMA)</h1>
        <button className="text-sm text-gray-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Select label="ผู้จำหน่าย *" value={form.vendor_id} onChange={(e) => setF('vendor_id', e.target.value)} options={vendors} placeholder="เลือกผู้จำหน่าย" />
          <Select label="คลังสินค้า *" value={form.warehouse_id} onChange={(e) => setF('warehouse_id', e.target.value)} options={warehouses} placeholder="เลือกคลังสินค้า" />
          <div className="col-span-2"><Input label="หมายเหตุ" value={form.notes} onChange={(e) => setF('notes', e.target.value)} /></div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">รายการสินค้าที่คืน</h2>
          <div className="relative mb-4">
            <Input label="ค้นหาสินค้า" value={productSearch} onChange={(e) => searchProducts(e.target.value)} placeholder="พิมพ์ SKU หรือชื่อสินค้า..." />
            {productResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                {productResults.map((p) => (
                  <button key={p.id} type="button" className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm" onClick={() => addProduct(p)}>
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
                    <th className="text-right p-3 font-medium text-gray-600 w-24">จำนวน</th>
                    <th className="p-3 font-medium text-gray-600 w-36">สภาพ</th>
                    <th className="p-3 font-medium text-gray-600">หมายเหตุ</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">{l.product_label}</td>
                      <td className="p-2">
                        <input type="number" min="0.01" step="any" value={l.qty_returned}
                          onChange={(e) => updateLine(i, 'qty_returned', parseFloat(e.target.value) || 0)}
                          className="w-full text-right rounded border px-2 py-1" />
                      </td>
                      <td className="p-2">
                        <select value={l.condition} onChange={(e) => updateLine(i, 'condition', e.target.value)}
                          className="w-full rounded border px-2 py-1 text-sm">
                          <option value="resaleable">ขายได้</option>
                          <option value="repack_resell">บรรจุใหม่</option>
                          <option value="damaged_return_vendor">คืนผู้จำหน่าย</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input value={l.notes} onChange={(e) => updateLine(i, 'notes', e.target.value)}
                          className="w-full rounded border px-2 py-1 text-sm" placeholder="หมายเหตุ..." />
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
          <Button onClick={handleSubmit} loading={saving}>สร้าง RMA</Button>
        </div>
      </div>
    </div>
  );
}
