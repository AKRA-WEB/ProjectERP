'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { VAT_RATE } from '@/lib/constants';
import type { PaginatedResponse, Product, Warehouse } from '@/types';

interface Vendor { id: string; code: string; name_th: string; }
interface OrderLine {
  product_id: string;
  product_label: string;
  qty_ordered: number;
  unit_price: number;
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';
const FIELD_CLS = 'bg-white border border-stone-200 rounded-[7px] px-3 py-[7px] text-[13px] text-stone-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50 disabled:bg-stone-50 w-full';
const LABEL_CLS = 'text-[12px] font-medium text-stone-600 mb-1.5 block';
const BTN_PRIMARY = 'h-9 px-4 rounded-[8px] text-[13px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors';

export default function NewReceivingOrderPage() {
  const router = useRouter();
  const [vendors, setVendors]       = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vendorId, setVendorId]     = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes]           = useState('');
  const [lines, setLines]           = useState<OrderLine[]>([]);
  const [search, setSearch]         = useState('');
  const [results, setResults]       = useState<Product[]>([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    get<PaginatedResponse<Vendor>>('/api/vendors?limit=500').then((r) =>
      setVendors(r.data)
    );
    get<Warehouse[]>('/api/admin/warehouses').then((d) =>
      setWarehouses(d.filter((w) => w.is_active))
    );
  }, []);

  async function searchProducts(q: string) {
    setSearch(q);
    if (!q) { setResults([]); return; }
    const res = await get<PaginatedResponse<Product>>(`/api/products?search=${encodeURIComponent(q)}&limit=10`);
    setResults(res.data ?? []);
  }

  function addLine(p: Product) {
    setLines((prev) => [...prev, {
      product_id: p.id,
      product_label: `${p.sku} — ${p.name_th}`,
      qty_ordered: 1,
      unit_price: Number(p.unit_cost) || 0,
    }]);
    setSearch('');
    setResults([]);
  }

  function updateLine(i: number, key: 'qty_ordered' | 'unit_price', val: number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const subtotal = lines.reduce((s, l) => s + l.qty_ordered * l.unit_price, 0);
  const vat      = subtotal * VAT_RATE;
  const total    = subtotal + vat;

  async function handleSubmit() {
    if (!vendorId)    { setError('กรุณาเลือกผู้จำหน่าย'); return; }
    if (!warehouseId) { setError('กรุณาเลือกคลังสินค้า'); return; }
    if (lines.length === 0) { setError('กรุณาเพิ่มรายการสินค้า'); return; }
    setError('');
    setSaving(true);
    try {
      const result = await post<{ po_id: string; grn_id: string; grn_number: string }>(
        '/api/receiving/order',
        {
          vendor_id: vendorId,
          warehouse_id: warehouseId,
          expected_date: expectedDate || undefined,
          notes: notes || undefined,
          lines: lines.map((l) => ({
            product_id: l.product_id,
            qty_ordered: l.qty_ordered,
            unit_price: l.unit_price,
          })),
        }
      );
      router.push(`/app/grn/${result.grn_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">เปิดคำสั่งซื้อ</h1>
          <p className="text-sm text-stone-500 mt-0.5">สร้างคำสั่งซื้อ + การ์ดงานรับสินค้า ในขั้นตอนเดียว</p>
        </div>
        <button onClick={() => router.back()} className="text-sm text-stone-400 hover:text-stone-700">← ย้อนกลับ</button>
      </div>

      {error && (
        <div className="p-3 rounded-[8px] bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {/* Header fields */}
      <div className={`${CARD} p-6 grid grid-cols-2 gap-4`}>
        <div>
          <label className={LABEL_CLS}>ผู้จำหน่าย / Vendor *</label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={FIELD_CLS}>
            <option value="">-- เลือกผู้จำหน่าย --</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.code} — {v.name_th}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>คลังสินค้า *</label>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={FIELD_CLS}>
            <option value="">-- เลือกคลัง --</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>วันที่คาดว่าจะส่ง</label>
          <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={FIELD_CLS} />
        </div>
        <div>
          <label className={LABEL_CLS}>หมายเหตุ</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="หมายเหตุเพิ่มเติม" className={FIELD_CLS} />
        </div>
      </div>

      {/* Product search */}
      <div className={`${CARD} p-6`}>
        <h2 className="text-[14px] font-semibold text-stone-800 mb-3">รายการสินค้า</h2>

        {/* Search box */}
        <div className="relative mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => searchProducts(e.target.value)}
            placeholder="ค้นหาสินค้า (SKU / ชื่อ)..."
            className={FIELD_CLS}
          />
          {results.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 bg-white border border-stone-200 rounded-[8px] shadow-lg mt-1 max-h-52 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addLine(p)}
                  className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-stone-50 flex items-center gap-3"
                >
                  <span className="font-mono text-stone-500 text-[12px] w-24 shrink-0">{p.sku}</span>
                  <span className="text-stone-900">{p.name_th}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-4">ยังไม่มีรายการสินค้า</p>
        ) : (
          <table className="w-full text-[13px] mb-4">
            <thead className="border-b border-stone-200">
              <tr>
                <th className="pb-2 text-left font-medium text-stone-600">สินค้า</th>
                <th className="pb-2 text-right font-medium text-stone-600 w-28">จำนวน</th>
                <th className="pb-2 text-right font-medium text-stone-600 w-32">ราคา/หน่วย (฿)</th>
                <th className="pb-2 text-right font-medium text-stone-600 w-28">รวม</th>
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-stone-100">
                  <td className="py-2 pr-3 text-stone-800">{l.product_label}</td>
                  <td className="py-2 pr-2">
                    <input
                      type="number" min="1" value={l.qty_ordered}
                      onChange={(e) => updateLine(i, 'qty_ordered', Number(e.target.value) || 1)}
                      className="w-full border border-stone-200 rounded-[6px] px-2 py-1 text-[13px] text-right outline-none focus:border-emerald-400 tabular-nums"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number" min="0" step="0.01" value={l.unit_price}
                      onChange={(e) => updateLine(i, 'unit_price', Number(e.target.value) || 0)}
                      className="w-full border border-stone-200 rounded-[6px] px-2 py-1 text-[13px] text-right outline-none focus:border-emerald-400 tabular-nums"
                    />
                  </td>
                  <td className="py-2 text-right tabular-nums text-stone-700 font-medium">
                    {formatCurrency(l.qty_ordered * l.unit_price)}
                  </td>
                  <td className="py-2 text-center">
                    <button onClick={() => removeLine(i)} className="text-stone-300 hover:text-red-500 text-[16px] leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Totals */}
        {lines.length > 0 && (
          <div className="flex justify-end">
            <div className="w-56 space-y-1 text-[13px]">
              <div className="flex justify-between text-stone-600"><span>ราคาก่อน VAT</span><span className="tabular-nums">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-stone-600"><span>VAT 7%</span><span className="tabular-nums">{formatCurrency(vat)}</span></div>
              <div className="flex justify-between font-semibold text-stone-900 border-t border-stone-200 pt-1 mt-1"><span>รวมทั้งสิ้น</span><span className="tabular-nums">{formatCurrency(total)}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={saving} className={BTN_PRIMARY}>
          {saving ? 'กำลังสร้าง…' : 'สร้างคำสั่งซื้อ + การ์ดงาน'}
        </button>
      </div>
    </div>
  );
}
