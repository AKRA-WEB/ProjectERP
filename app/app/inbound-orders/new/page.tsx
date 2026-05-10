'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { Warehouse, Product } from '@/types';

interface IOLine {
  product_id: string;
  qty_ordered: number;
  unit_cost: number;
  notes: string;
  product_label: string;
}

export default function NewInboundOrderPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<{ value: string; label: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<IOLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then((data) =>
      setWarehouses(data.map((w) => ({ value: w.id, label: `${w.code} — ${w.name_th}` })))
    );
    get<{ data: { id: string; code: string; name_th: string }[] }>('/api/vendors?limit=200').then((res) =>
      setVendors(res.data.map((v) => ({ value: v.id, label: `${v.code} — ${v.name_th}` })))
    );
    get<{ data: Product[] }>('/api/products?limit=500').then((res) => setProducts(res.data));
  }, []);

  function addLine() {
    setLines([...lines, { product_id: '', qty_ordered: 1, unit_cost: 0, notes: '', product_label: '' }]);
  }

  function removeLine(i: number) {
    setLines(lines.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, key: keyof IOLine, val: string | number) {
    const newLines = [...lines];
    newLines[i] = { ...newLines[i], [key]: val };
    if (key === 'product_id') {
      const p = products.find((prod) => prod.id === val);
      newLines[i].product_label = p ? `${p.sku} — ${p.name_th}` : '';
      newLines[i].unit_cost = Number(p?.unit_cost ?? 0);
    }
    setLines(newLines);
  }

  async function handleSubmit() {
    if (!vendorId || !warehouseId || lines.length === 0) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (lines.some((l) => !l.product_id || l.qty_ordered <= 0)) {
      setError('กรุณาระบุสินค้าและจำนวนให้ถูกต้อง');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const result = await post<{ id: string }>('/api/inbound-orders', {
        vendor_id: vendorId,
        warehouse_id: warehouseId,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          qty_ordered: l.qty_ordered,
          unit_cost: l.unit_cost,
          notes: l.notes || undefined,
        })),
      });
      router.push(`/app/inbound-orders/${result.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">สร้างรายการรับสินค้า (LINE)</h1>
        <button className="text-sm text-gray-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="ผู้จำหน่าย / Vendor *"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            options={vendors}
            placeholder="เลือกผู้จำหน่าย"
          />
          <Select
            label="คลังสินค้า *"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            options={warehouses}
            placeholder="เลือกคลังสินค้า"
          />
        </div>
        <Input label="หมายเหตุ (เช่น บริบทจาก LINE)" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">รายการสินค้า</h2>
            <Button size="sm" variant="secondary" onClick={addLine}>+ เพิ่มรายการ</Button>
          </div>

          {lines.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600">สินค้า</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-24">จำนวน</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-32">ราคาทุน</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y border-t">
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td className="p-2">
                        <select
                          className="w-full rounded border px-2 py-1"
                          value={l.product_id}
                          onChange={(e) => updateLine(i, 'product_id', e.target.value)}
                        >
                          <option value="">เลือกสินค้า...</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name_th}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="w-full text-right rounded border px-2 py-1"
                          value={l.qty_ordered}
                          onChange={(e) => updateLine(i, 'qty_ordered', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="w-full text-right rounded border px-2 py-1"
                          value={l.unit_cost}
                          onChange={(e) => updateLine(i, 'unit_cost', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => removeLine(i)} className="text-red-500 hover:text-red-700 text-lg">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end pt-4">
          <Button onClick={handleSubmit} loading={saving} disabled={lines.length === 0}>สร้าง Inbound Order</Button>
        </div>
      </div>
    </div>
  );
}
