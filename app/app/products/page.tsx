'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import type { PaginatedResponse, Product } from '@/types';
import ProductFormModal from './ProductFormModal';

interface ProductWithDetails extends Product {
  category_name: string | null;
  uom_code: string;
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';
const BTN_SM = 'h-[26px] px-3 rounded-[6px] text-[12px] font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)] inline-flex items-center gap-1.5';

function StockBadge({ status }: { status: 'ok' | 'low' | 'critical' | 'inactive' }) {
  const map = {
    ok:       { label: 'ปกติ',     cls: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
    low:      { label: 'ใกล้หมด', cls: 'text-amber-700 border-amber-300 bg-amber-50' },
    critical: { label: 'วิกฤต',   cls: 'text-red-700 border-red-200 bg-red-50' },
    inactive: { label: 'ปิดใช้',  cls: 'text-stone-500 border-stone-200 bg-stone-50' },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-[5px] px-2 py-[2px] text-[11.5px] font-medium rounded-full border leading-[1.5] whitespace-nowrap before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-current ${s.cls}`}>
      {s.label}
    </span>
  );
}

function TrackingTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-[1px] text-[10.5px] font-medium rounded-[4px] border border-blue-200 text-blue-700 bg-blue-50">
      {label}
    </span>
  );
}

export default function ProductsPage() {
  const [data, setData] = useState<PaginatedResponse<ProductWithDetails> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProductWithDetails | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('search', search);
      if (showInactive) params.set('show_inactive', 'true');
      setData(await get<PaginatedResponse<ProductWithDetails>>(`/api/products?${params}`));
    } finally { setLoading(false); }
  }, [page, search, showInactive]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const total = data?.total ?? 0;
  const activeCount = data?.data.filter((p) => p.is_active).length ?? 0;
  const lotCount = data?.data.filter((p) => p.is_lot_tracked).length ?? 0;

  function getStockStatus(p: ProductWithDetails): 'ok' | 'low' | 'critical' | 'inactive' {
    if (!p.is_active) return 'inactive';
    return 'ok';
  }

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-5">

      {/* Header */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
            สินค้าคงคลัง
          </h1>
          <p className="text-[13.5px] text-stone-500">
            Products · {loading ? '—' : total.toLocaleString('th-TH')} SKU
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className={BTN_SM}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            นำเข้า
          </button>
          <button
            onClick={() => { setSelected(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium shadow-sm hover:bg-stone-800 transition-colors"
          >
            + เพิ่มสินค้า
          </button>
        </div>
      </div>

      {/* Mini KPI grid */}
      <div className={`${CARD} overflow-hidden grid grid-cols-2 lg:grid-cols-4`}>
        {[
          { label: 'SKU ทั้งหมด',    value: loading ? '—' : total.toLocaleString('th-TH'),    sub: 'รายการในระบบ' },
          { label: 'ใช้งานอยู่',     value: loading ? '—' : activeCount.toLocaleString('th-TH'), sub: 'หน้านี้' },
          { label: 'ติดตาม Lot',    value: loading ? '—' : lotCount.toLocaleString('th-TH'),  sub: 'สินค้าติดตาม Lot' },
          { label: 'ใกล้หมด',       value: '—',                                                sub: 'ดูในแดชบอร์ด',     warn: true },
        ].map((k, i) => (
          <div key={k.label} className={`p-[20px] flex flex-col gap-2 ${i < 3 ? 'border-r border-b lg:border-b-0' : 'border-b lg:border-b-0'} border-stone-100`}>
            <div className="text-[12px] text-stone-500 font-medium">{k.label}</div>
            <div className={`text-[26px] font-semibold tracking-tight leading-[1.1] tabular-nums ${k.warn ? 'text-amber-600' : 'text-stone-950'}`}>
              {k.value}
            </div>
            <div className="text-[11.5px] text-stone-400">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-[320px] bg-stone-50 border border-stone-200 rounded-[8px] px-3 py-[6px] text-stone-400 text-[13px] transition-colors focus-within:border-stone-300 focus-within:bg-white">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            placeholder="ค้นหา SKU หรือชื่อสินค้า..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 bg-transparent border-0 outline-none text-stone-700 placeholder:text-stone-400 text-[13px]"
          />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-stone-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => { setShowInactive(e.target.checked); setPage(1); }}
            className="w-3.5 h-3.5 rounded border-stone-300 accent-emerald-600"
          />
          แสดงสินค้าที่ปิดใช้งาน
        </label>
      </div>

      {/* Table card */}
      <div className={CARD}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {[
                { h: 'SKU',               sm: false },
                { h: 'ชื่อสินค้า',         sm: false },
                { h: 'หมวดหมู่',           sm: true },
                { h: 'หน่วย',             sm: true },
                { h: 'ราคาทุน',           sm: true },
                { h: 'ติดตาม',            sm: true },
                { h: 'สถานะ',             sm: false },
                { h: '',                  sm: false },
              ].map(({ h, sm }, i) => (
                <th key={i} className={`text-left py-2.5 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-400 bg-stone-50 border-y border-stone-200 first:pl-5 last:pr-5 ${sm ? 'hidden lg:table-cell' : ''} ${i === 4 ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-12 text-center text-[13px] text-stone-400">กำลังโหลด...</td></tr>
            ) : data?.data.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-[13px] text-stone-400">ไม่พบสินค้า</td></tr>
            ) : data?.data.map((p) => (
              <tr key={p.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-default transition-colors">
                <td className="py-0 h-11 px-3.5 pl-5 font-mono text-[12.5px] font-medium text-stone-700">{p.sku}</td>
                <td className="py-0 h-11 px-3.5">
                  <div className="font-medium text-stone-900 truncate max-w-[200px]">{p.name_th}</div>
                  {p.name_en && <div className="text-[11.5px] text-stone-400 truncate max-w-[200px]">{p.name_en}</div>}
                </td>
                <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell">{p.category_name ?? '—'}</td>
                <td className="py-0 h-11 px-3.5 text-stone-500 hidden lg:table-cell font-mono text-[12.5px]">{p.uom_code}</td>
                <td className="py-0 h-11 px-3.5 text-right font-mono tabular-nums text-stone-700 hidden lg:table-cell">{formatCurrency(p.unit_cost)}</td>
                <td className="py-0 h-11 px-3.5 hidden lg:table-cell">
                  <div className="flex items-center gap-1">
                    {p.is_lot_tracked && <TrackingTag label="Lot" />}
                    {p.is_serial_tracked && <TrackingTag label="Serial" />}
                    {!p.is_lot_tracked && !p.is_serial_tracked && <span className="text-[11.5px] text-stone-300">—</span>}
                  </div>
                </td>
                <td className="py-0 h-11 px-3.5">
                  <StockBadge status={getStockStatus(p)} />
                </td>
                <td className="py-0 h-11 px-3.5 pr-5">
                  <button
                    onClick={() => { setSelected(p); setShowForm(true); }}
                    className="text-[12px] text-stone-400 hover:text-emerald-700 transition-colors"
                  >
                    แก้ไข
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between text-[13px] text-stone-500">
          <span>หน้า {page} จาก {data.total_pages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none text-[13px]">
              ← ก่อนหน้า
            </button>
            <button onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))} disabled={page === data.total_pages}
              className="h-8 px-3 rounded-[7px] border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none text-[13px]">
              ถัดไป →
            </button>
          </div>
        </div>
      )}

      {/* Product form modal */}
      {showForm && (
        <ProductFormModal
          product={selected}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchProducts(); }}
        />
      )}
    </div>
  );
}
