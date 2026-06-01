'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import type { PaginatedResponse, Product, Warehouse, Vendor } from '@/types';
import { ArrowLeft, Search, Trash2, Package } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';

interface StandaloneLine {
  product_id: string;
  sku: string;
  name_th: string;
  qty_received: number;
  unit_cost: number;
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function NewStandaloneGRNPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<StandaloneLine[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<PaginatedResponse<Vendor>>('/api/vendors?limit=100').then((r) => setVendors(r.data));
    get<Warehouse[]>('/api/admin/warehouses').then((d) => setWarehouses(d.filter((w) => w.is_active)));
  }, []);

  async function searchProducts(q: string) {
    setSearch(q);
    if (!q) { setResults([]); return; }
    try {
      const res = await get<PaginatedResponse<Product>>(`/api/products?search=${encodeURIComponent(q)}&limit=10`);
      setResults(res.data ?? []);
    } catch (err) {
      console.error('Product search failed', err);
    }
  }

  function addLine(p: Product) {
    if (lines.some(l => l.product_id === p.id)) {
      setError('สินค้านี้อยู่ในรายการแล้ว');
      return;
    }
    setLines((prev) => [...prev, {
      product_id: p.id,
      sku: p.sku,
      name_th: p.name_th,
      qty_received: 1,
      unit_cost: typeof p.unit_cost === 'string' ? parseFloat(p.unit_cost) : Number(p.unit_cost) || 0,
    }]);
    setSearch('');
    setResults([]);
    setError('');
  }

  function updateLine(i: number, key: 'qty_received' | 'unit_cost', val: number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (!vendorId) { setError('กรุณาเลือกผู้จำหน่าย'); return; }
    if (!warehouseId) { setError('กรุณาเลือกคลังสินค้า'); return; }
    if (lines.length === 0) { setError('กรุณาเพิ่มรายการสินค้า'); return; }
    
    setError('');
    setSaving(true);
    try {
      const result = await post<{ grn_id: string }>('/api/grn', {
        vendor_id: vendorId,
        warehouse_id: warehouseId,
        received_date: receivedDate,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          qty_received: l.qty_received,
          unit_cost: l.unit_cost,
        })),
      });
      router.push(`/app/grn/${result.grn_id}`);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.qty_received * l.unit_cost, 0);

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-stone-900">รับสินค้า (ไม่มี PO)</h1>
          <p className="text-sm text-stone-500">Standalone Goods Receipt</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`${CARD} p-6`}>
            <h2 className="text-[14px] font-semibold text-stone-800 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4" /> ข้อมูลทั่วไป
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="ผู้จำหน่าย / Vendor *"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                options={vendors.map(v => ({ value: v.id, label: `${v.code} — ${v.name_th}` }))}
                placeholder="-- เลือกผู้จำหน่าย --"
              />
              <Select
                label="คลังสินค้า *"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                options={warehouses.map(w => ({ value: w.id, label: `${w.code} — ${w.name_th}` }))}
                placeholder="-- เลือกคลัง --"
              />
              <Input
                label="วันที่รับสินค้า *"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
              <Input
                label="หมายเหตุ"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
              />
            </div>
          </div>

          <div className={`${CARD} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-stone-800">รายการสินค้า</h2>
              <div className="text-[12px] text-stone-500">{lines.length} รายการ</div>
            </div>

            {/* Product Search */}
            <div className="relative mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => searchProducts(e.target.value)}
                  placeholder="ค้นหาสินค้าเพื่อเพิ่มรายการ (SKU / ชื่อ)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              
              {results.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 bg-white border border-stone-200 rounded-xl shadow-xl mt-2 max-h-60 overflow-y-auto">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addLine(p)}
                      className="w-full text-left px-4 py-3 hover:bg-stone-50 flex items-center gap-4 border-b border-stone-50 last:border-0"
                    >
                      <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-stone-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[12px] text-emerald-600 font-bold">{p.sku}</p>
                        <p className="text-[14px] text-stone-900 truncate">{p.name_th}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] text-stone-400">ต้นทุน</p>
                        <p className="text-[14px] font-mono font-bold text-stone-700">{formatCurrency(typeof p.unit_cost === 'string' ? parseFloat(p.unit_cost) : Number(p.unit_cost))}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="text-center py-12 bg-stone-50 rounded-xl border border-dashed border-stone-200">
                <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                <p className="text-sm text-stone-400">ยังไม่มีรายการสินค้า</p>
                <p className="text-[12px] text-stone-400 mt-1">ค้นหาสินค้าด้านบนเพื่อเริ่มการรับเข้า</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-stone-500 text-[12px] uppercase tracking-wider">
                      <th className="text-left pb-3 font-medium">สินค้า</th>
                      <th className="text-right pb-3 font-medium w-32">จำนวนที่รับ</th>
                      <th className="text-right pb-3 font-medium w-36">ต้นทุน/หน่วย</th>
                      <th className="text-right pb-3 font-medium w-32">รวม</th>
                      <th className="pb-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {lines.map((l, i) => (
                      <tr key={l.product_id} className="group">
                        <td className="py-4 pr-4">
                          <p className="font-mono text-[12px] text-stone-500">{l.sku}</p>
                          <p className="text-stone-900 font-medium">{l.name_th}</p>
                        </td>
                        <td className="py-4">
                          <input
                            type="number" min="0.0001" step="any"
                            value={l.qty_received}
                            onChange={(e) => updateLine(i, 'qty_received', parseFloat(e.target.value) || 0)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-right font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                          />
                        </td>
                        <td className="py-4">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-[12px]">฿</span>
                            <input
                              type="number" min="0" step="any"
                              value={l.unit_cost}
                              onChange={(e) => updateLine(i, 'unit_cost', parseFloat(e.target.value) || 0)}
                              className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-7 pr-3 py-1.5 text-right font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            />
                          </div>
                        </td>
                        <td className="py-4 text-right font-mono font-bold text-stone-700">
                          {formatCurrency(l.qty_received * l.unit_cost)}
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => removeLine(i)}
                            className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Summary */}
        <div className="space-y-6">
          <div className={`${CARD} p-6 sticky top-6`}>
            <h2 className="text-[14px] font-semibold text-stone-800 mb-4">สรุปรายการ</h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm text-stone-500">
                <span>จำนวนรายการ</span>
                <span className="text-stone-900 font-medium">{lines.length} SKU</span>
              </div>
              <div className="flex justify-between text-sm text-stone-500">
                <span>ยอดรวม (ก่อน VAT)</span>
                <span className="text-stone-900 font-mono font-bold">{formatCurrency(subtotal)}</span>
              </div>
              <div className="pt-3 border-t border-stone-100 flex justify-between items-baseline">
                <span className="text-stone-900 font-semibold">ยอดรวมประมาณการ</span>
                <div className="text-right">
                  <p className="text-2xl font-mono font-black text-emerald-600">{formatCurrency(subtotal * 1.07)}</p>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest mt-1">* รวม VAT 7%</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 mb-4 rounded-lg bg-red-50 border border-red-100 text-[13px] text-red-600">
                {error}
              </div>
            )}

            <Button
              className="w-full h-11 text-[15px] font-bold shadow-lg shadow-emerald-500/10"
              onClick={handleSubmit}
              loading={saving}
              disabled={lines.length === 0}
            >
              บันทึกรับสินค้าเข้าคลัง
            </Button>
            
            <p className="text-[11px] text-stone-400 text-center mt-4">
              การบันทึกจะเพิ่มสต็อกสินค้าทันที และสามารถ<br />สร้างใบสั่งซื้อ (PO) ตามหลังได้จากหน้าละเอียด
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
