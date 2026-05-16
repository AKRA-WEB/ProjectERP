'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import type { Warehouse } from '@/types';

interface ValuationRow {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  category_name: string | null;
  product_id: string;
  sku: string;
  product_name_th: string;
  product_name_en: string;
  unit_cost: number;
  uom_code: string;
  qty_on_hand: number;
  qty_available: number;
  total_value: number;
}

interface WarehouseSummary {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  total_value: number;
  product_count: number;
}

interface ValuationResponse {
  rows: ValuationRow[];
  summary: {
    grand_total: number;
    by_warehouse: WarehouseSummary[];
    row_count: number;
  };
}

interface Category {
  id: string;
  code: string;
  name_th: string;
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function InventoryValuationPage() {
  const [data, setData] = useState<ValuationResponse | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then((d) => setWarehouses(d.filter((w) => w.is_active))).catch(() => {});
    get<{ data: Category[] }>('/api/products/categories?limit=200').then((d) => setCategories(d.data)).catch(() => {});
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (warehouseId) params.set('warehouse_id', warehouseId);
    if (categoryId) params.set('category_id', categoryId);
    const res = await get<ValuationResponse>(`/api/reports/inventory-valuation?${params.toString()}`).catch(() => null);
    setData(res);
    setLoading(false);
  }, [warehouseId, categoryId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Group rows by warehouse for display
  const grouped = (data?.rows ?? []).reduce<Record<string, ValuationRow[]>>((acc, row) => {
    (acc[row.warehouse_id] = acc[row.warehouse_id] ?? []).push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">รายงานมูลค่าสต็อก</h1>
          <p className="text-sm text-stone-500 mt-0.5">Inventory Valuation — ปริมาณ × ต้นทุน/หน่วย</p>
        </div>
        <button
          onClick={() => window.print()}
          className="h-9 px-4 rounded-[8px] text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)] inline-flex items-center gap-1.5"
        >
          พิมพ์รายงาน
        </button>
      </div>

      {/* Filters */}
      <div className={`${CARD} p-4 flex flex-wrap items-end gap-4 no-print`}>
        <div>
          <label className="text-[12px] font-medium text-stone-600 mb-1.5 block">คลังสินค้า</label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="bg-white border border-stone-200 rounded-[7px] px-3 py-[7px] text-[13px] text-stone-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 min-w-[200px]"
          >
            <option value="">ทุกคลัง</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[12px] font-medium text-stone-600 mb-1.5 block">หมวดหมู่</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="bg-white border border-stone-200 rounded-[7px] px-3 py-[7px] text-[13px] text-stone-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 min-w-[200px]"
          >
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name_th}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className={`${CARD} p-4 col-span-2 lg:col-span-1`}>
            <p className="text-[12px] text-stone-500">มูลค่ารวมทั้งหมด</p>
            <p className="text-2xl font-bold text-stone-900 mt-1 tabular-nums">{formatCurrency(data.summary.grand_total)}</p>
            <p className="text-[11px] text-stone-400 mt-0.5">{data.summary.row_count} รายการสินค้า</p>
          </div>
          {data.summary.by_warehouse.map((wh) => (
            <div key={wh.warehouse_id} className={`${CARD} p-4`}>
              <p className="text-[12px] text-stone-500">{wh.warehouse_code} — {wh.warehouse_name}</p>
              <p className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">{formatCurrency(wh.total_value)}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">{wh.product_count} รายการ</p>
            </div>
          ))}
        </div>
      )}

      {/* Detail Table — grouped by warehouse */}
      {loading ? (
        <div className={`${CARD} p-8 text-center text-sm text-stone-400`}>กำลังโหลด…</div>
      ) : !data || data.rows.length === 0 ? (
        <div className={`${CARD} p-8 text-center text-sm text-stone-400`}>ไม่มีข้อมูลสต็อก</div>
      ) : (
        Object.entries(grouped).map(([wid, rows]) => {
          const whSummary = data.summary.by_warehouse.find((wh) => wh.warehouse_id === wid);
          const whName = rows[0].warehouse_code + ' — ' + rows[0].warehouse_name;
          return (
            <div key={wid} className={CARD}>
              <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-stone-700">{whName}</h2>
                {whSummary && (
                  <span className="text-[13px] font-medium text-stone-900 tabular-nums">{formatCurrency(whSummary.total_value)}</span>
                )}
              </div>
              <table className="w-full text-[13px]">
                <thead className="border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-stone-500">SKU</th>
                    <th className="px-4 py-2.5 text-left font-medium text-stone-500">ชื่อสินค้า</th>
                    <th className="px-4 py-2.5 text-left font-medium text-stone-500">หมวดหมู่</th>
                    <th className="px-4 py-2.5 text-right font-medium text-stone-500">ปริมาณ (On Hand)</th>
                    <th className="px-4 py-2.5 text-right font-medium text-stone-500">ต้นทุน/หน่วย</th>
                    <th className="px-4 py-2.5 text-right font-medium text-stone-500">มูลค่า</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.product_id} className="border-b border-stone-100 hover:bg-stone-50/50">
                      <td className="px-4 py-2.5 font-mono text-[12px] text-stone-700">{row.sku}</td>
                      <td className="px-4 py-2.5 text-stone-900">{row.product_name_th}</td>
                      <td className="px-4 py-2.5 text-stone-500 text-[12px]">{row.category_name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">
                        {Number(row.qty_on_hand).toLocaleString('th-TH')} {row.uom_code}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(row.unit_cost)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-stone-900">{formatCurrency(Number(row.total_value))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-stone-200 bg-stone-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-2.5 text-[12px] font-medium text-stone-600">รวม {rows.length} รายการ</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-stone-900">
                      {whSummary ? formatCurrency(whSummary.total_value) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}
