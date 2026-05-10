'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { VAT_RATE } from '@/lib/constants';
import type { PaginatedResponse, Product, Warehouse } from '@/types';

interface POLine {
  product_id: string;
  product_label: string;
  pr_line_item_id?: string;
  qty_ordered: number;
  unit_price: number;
}

interface Vendor {
  id: string;
  code: string;
  name_th: string;
}

interface PRLine {
  id: string;
  product_id: string;
  sku: string;
  name_th: string;
  qty_requested: number;
  unit_cost: number;
}

interface PRDetail {
  warehouse_id: string;
  lines: PRLine[];
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prId = searchParams.get('pr_id');

  const [vendors, setVendors] = useState<{ value: string; label: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [form, setForm] = useState({ vendor_id: '', warehouse_id: '', expected_date: '', payment_terms_days: '30', notes: '' });
  const [lines, setLines] = useState<POLine[]>([]);
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

    if (prId) {
      get<PRDetail>(`/api/purchase-requests/${prId}`).then((pr) => {
        setForm((f) => ({ ...f, warehouse_id: pr.warehouse_id }));
        setLines(pr.lines.map((l) => ({
          product_id: l.product_id,
          product_label: `${l.sku} — ${l.name_th}`,
          pr_line_item_id: l.id,
          qty_ordered: l.qty_requested,
          unit_price: l.unit_cost,
        })));
      });
    }
  }, [prId]);

  function setF(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function searchProducts(q: string) {
    setProductSearch(q);
    if (!q) { setProductResults([]); return; }
    const res = await get<PaginatedResponse<Product>>(`/api/products?search=${encodeURIComponent(q)}&limit=10`);
    setProductResults(res.data ?? []);
  }

  function addProduct(p: Product) {
    setLines((prev) => [...prev, { product_id: p.id, product_label: `${p.sku} — ${p.name_th}`, qty_ordered: 1, unit_price: Number(p.unit_cost) || 0 }]);
    setProductSearch('');
    setProductResults([]);
  }

  function updateLine(i: number, key: keyof POLine, val: number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }

  const subtotal = lines.reduce((s, l) => s + l.qty_ordered * l.unit_price, 0);
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;

  async function handleSubmit(send: boolean) {
    if (!form.vendor_id) { setError('กรุณาเลือกผู้จำหน่าย'); return; }
    if (!form.warehouse_id) { setError('กรุณาเลือกคลังสินค้า'); return; }
    if (lines.length === 0) { setError('กรุณาเพิ่มรายการสินค้า'); return; }
    setError('');
    setSaving(true);
    try {
      const po = await post<{ id: string }>('/api/purchase-orders', {
        ...form,
        payment_terms_days: parseInt(form.payment_terms_days),
        expected_date: form.expected_date || undefined,
        pr_ids: prId ? [prId] : undefined,
        lines: lines.map((l) => ({ product_id: l.product_id, pr_line_item_id: l.pr_line_item_id, qty_ordered: l.qty_ordered, unit_price: l.unit_price })),
      });
      if (send) {
        await post(`/api/purchase-orders/${po.id}/send`, {});
      }
      router.push(`/app/purchase-orders/${po.id}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">สร้างใบสั่งซื้อใหม่</h1>
        <button className="text-sm text-gray-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>
      {prId && <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">สร้างจาก PR: {prId}</div>}

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Select label="ผู้จำหน่าย *" value={form.vendor_id} onChange={(e) => setF('vendor_id', e.target.value)} options={vendors} placeholder="เลือกผู้จำหน่าย" />
          <Select label="คลังสินค้า *" value={form.warehouse_id} onChange={(e) => setF('warehouse_id', e.target.value)} options={warehouses} placeholder="เลือกคลังสินค้า" />
          <Input label="วันที่คาดรับ" type="date" value={form.expected_date} onChange={(e) => setF('expected_date', e.target.value)} />
          <Input label="เงื่อนไขการชำระ (วัน)" type="number" value={form.payment_terms_days} onChange={(e) => setF('payment_terms_days', e.target.value)} />
          <div className="col-span-2">
            <Input label="หมายเหตุ" value={form.notes} onChange={(e) => setF('notes', e.target.value)} />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">รายการสินค้า</h2>
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
                    <th className="text-right p-3 font-medium text-gray-600 w-28">จำนวน</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-32">ราคา/หน่วย</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-32">รวม</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">{l.product_label}</td>
                      <td className="p-2"><input type="number" min="0.01" step="any" value={l.qty_ordered} onChange={(e) => updateLine(i, 'qty_ordered', parseFloat(e.target.value) || 0)} className="w-full text-right rounded border px-2 py-1" /></td>
                      <td className="p-2"><input type="number" min="0" step="any" value={l.unit_price} onChange={(e) => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full text-right rounded border px-2 py-1" /></td>
                      <td className="p-3 text-right">{formatCurrency(l.qty_ordered * l.unit_price)}</td>
                      <td className="p-2 text-center"><button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600">✕</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td colSpan={3} className="p-3 text-right text-sm text-gray-500">ก่อน VAT</td>
                    <td className="p-3 text-right text-sm font-medium">{formatCurrency(subtotal)}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="p-3 text-right text-sm text-gray-500">VAT 7%</td>
                    <td className="p-3 text-right text-sm">{formatCurrency(vat)}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="p-3 text-right font-semibold">รวมทั้งสิ้น</td>
                    <td className="p-3 text-right font-bold text-lg">{formatCurrency(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => handleSubmit(false)} loading={saving}>บันทึกร่าง</Button>
          <Button onClick={() => handleSubmit(true)} loading={saving}>บันทึกและส่ง</Button>
        </div>
      </div>
    </div>
  );
}
