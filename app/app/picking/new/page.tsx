'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { SessionUser } from '@/lib/authz';
import type { Warehouse, Product } from '@/types';

interface PickLine {
  product_id: string;
  qty_requested: number;
  storage_location: string;
  product_label: string;
  product_sku: string;
  qty_available: number;
  search: string;
  search_results: Product[];
  searching: boolean;
}

export default function NewPickListPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUser = session?.user as unknown as SessionUser;
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<PickLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const searchTimers = useRef<Map<number, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (currentUser?.role === 'staff') {
      router.replace('/app/picking');
      return;
    }

    get<Warehouse[]>('/api/admin/warehouses').then((data) =>
      setWarehouses(data.map((w) => ({ value: w.id, label: `${w.code} — ${w.name_th}` })))
    );
  }, [session, router]);

  const addLine = () => {
    setLines([...lines, {
      product_id: '', qty_requested: 1, storage_location: '',
      product_label: '', product_sku: '', qty_available: 0,
      search: '', search_results: [], searching: false,
    }]);
  };

  const removeLine = (i: number) => {
    if (searchTimers.current.has(i)) {
      clearTimeout(searchTimers.current.get(i));
      searchTimers.current.delete(i);
    }
    setLines(lines.filter((_, idx) => idx !== i));
  };

  const updateLine = <K extends keyof PickLine>(i: number, key: K, val: PickLine[K]) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  };

  const fetchAvailability = async (i: number, productId: string, sku: string) => {
    if (!warehouseId || !productId) return;
    try {
      const res = await get<{ data: { product_id: string; qty_available: string | number }[] }>(`/api/stock?warehouse_id=${warehouseId}&search=${encodeURIComponent(sku)}`);
      const stock = res.data.find((s) => s.product_id === productId);
      if (stock) {
        updateLine(i, 'qty_available', Number(stock.qty_available));
      } else {
        updateLine(i, 'qty_available', 0);
      }
    } catch (err) {
      console.error('Failed to fetch availability:', err);
    }
  };

  const searchProducts = async (i: number, q: string) => {
    updateLine(i, 'search', q);
    updateLine(i, 'searching', !!q.trim());

    if (searchTimers.current.has(i)) {
      clearTimeout(searchTimers.current.get(i));
    }

    if (!q.trim()) {
      updateLine(i, 'search_results', []);
      updateLine(i, 'searching', false);
      return;
    }

    const timerId = setTimeout(async () => {
      try {
        const res = await get<{ data: Product[] }>(
          `/api/products?search=${encodeURIComponent(q)}&limit=10`
        );
        updateLine(i, 'search_results', res.data);
        updateLine(i, 'searching', false);
      } catch {
        updateLine(i, 'searching', false);
      } finally {
        searchTimers.current.delete(i);
      }
    }, 300);

    searchTimers.current.set(i, timerId);
  };

  const selectProduct = (i: number, p: Product) => {
    setLines((prev) => prev.map((l, idx) =>
      idx === i
        ? {
          ...l,
          product_id: p.id,
          product_label: p.name_th,
          product_sku: p.sku,
          search: '',
          search_results: [],
          searching: false
        }
        : l
    ));
    fetchAvailability(i, p.id, p.sku);
  };

  const handleSubmit = async () => {
    if (!warehouseId || lines.length === 0) {
      setError('กรุณาเลือกคลังสินค้าและเพิ่มรายการสินค้า');
      return;
    }
    if (lines.some((l) => !l.product_id || l.qty_requested <= 0)) {
      setError('กรุณาระบุสินค้าและจำนวนให้ถูกต้อง');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const result = await post<{ id: string }>('/api/pick-lists', {
        warehouse_id: warehouseId,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          qty_requested: l.qty_requested,
          storage_location: l.storage_location || undefined,
        })),
      });
      router.push(`/app/picking/${result.id}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || 'เกิดข้อผิดพลาดในการสร้างรายการหยิบ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">สร้างรายการหยิบสินค้า</h1>
          <p className="text-sm text-stone-500 mt-1">New Pick List</p>
        </div>
        <button onClick={() => router.back()} className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
          ← ย้อนกลับ
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="คลังสินค้า / Warehouse *"
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                // Reset availability for all lines if warehouse changes
                setLines(lines.map(l => ({ ...l, qty_available: 0 })));
              }}
              options={warehouses}
              placeholder="เลือกคลังสินค้าที่ต้องการหยิบ"
            />
          </div>
          <Input
            label="หมายเหตุ / Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
          />
        </div>

        {/* Lines Section */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
            <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider text-[11px]">รายการสินค้า</h2>
            <Button size="sm" variant="secondary" onClick={addLine} className="h-8 text-[12px]">
              + เพิ่มสินค้า
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50/50 text-[11px] font-semibold text-stone-400 uppercase tracking-wider border-b border-stone-100">
                  <th className="text-left px-6 py-3">สินค้า / Product</th>
                  <th className="text-right px-6 py-3 w-32">สต็อกที่พร้อมใช้</th>
                  <th className="text-right px-6 py-3 w-32">จำนวนที่ต้องการ *</th>
                  <th className="text-left px-6 py-3 w-40">จุดจัดเก็บ (ระบุเพื่อไกด์)</th>
                  <th className="px-6 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-stone-400 italic">
                      ยังไม่มีรายการสินค้า คลิก &quot;+ เพิ่มสินค้า&quot; เพื่อเริ่ม
                    </td>
                  </tr>
                ) : (
                  lines.map((l, i) => (
                    <tr key={i} className="hover:bg-stone-50/30 transition-colors">
                      <td className="px-6 py-3 min-w-[300px]">
                        {l.product_id ? (
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="font-mono text-[12px] text-stone-500">{l.product_sku}</div>
                              <div className="text-[13px] font-medium text-stone-900">{l.product_label}</div>
                            </div>
                            <button
                              onClick={() => updateLine(i, 'product_id', '')}
                              className="text-stone-300 hover:text-red-500 transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="ค้นหาสินค้าด้วยชื่อ หรือ SKU..."
                              value={l.search}
                              onChange={(e) => searchProducts(i, e.target.value)}
                              disabled={!warehouseId}
                              className="w-full h-9 rounded-lg border border-stone-200 px-3 py-1 text-[13px] outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 transition-all disabled:bg-stone-50 disabled:cursor-not-allowed"
                            />
                            {!warehouseId && (
                              <div className="text-[10px] text-amber-600 mt-1">! กรุณาเลือกคลังสินค้าก่อน</div>
                            )}
                            {l.searching && (
                              <div className="absolute right-3 top-2.5">
                                <div className="w-4 h-4 border-2 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div>
                              </div>
                            )}
                            {l.search_results.length > 0 && (
                              <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-xl text-[13px] max-h-60 overflow-y-auto p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                {l.search_results.map((p) => (
                                  <li
                                    key={p.id}
                                    onMouseDown={() => selectProduct(i, p)}
                                    className="px-3 py-2 cursor-pointer hover:bg-stone-50 rounded-lg flex items-center gap-3"
                                  >
                                    <span className="font-mono text-[11px] px-1.5 py-0.5 bg-stone-100 rounded text-stone-600 shrink-0">{p.sku}</span>
                                    <span className="truncate">{p.name_th}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className={`font-mono text-[13px] ${l.qty_available <= 0 ? 'text-red-500' : 'text-stone-500'}`}>
                          {l.qty_available.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={l.qty_requested}
                          onChange={(e) => updateLine(i, 'qty_requested', parseFloat(e.target.value) || 0)}
                          className="w-full h-9 text-right rounded-lg border border-stone-200 px-3 py-1 text-[13px] font-mono outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 transition-all"
                        />
                      </td>
                      <td className="px-6 py-3">
                        <input
                          type="text"
                          placeholder="เช่น A-01-02"
                          value={l.storage_location}
                          onChange={(e) => updateLine(i, 'storage_location', e.target.value)}
                          className="w-full h-9 rounded-lg border border-stone-200 px-3 py-1 text-[13px] outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 transition-all"
                        />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => removeLine(i)}
                          className="text-stone-300 hover:text-red-500 transition-colors"
                        >
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3 text-red-700 text-[13px]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v4M8 11h0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => router.back()} disabled={saving}>ยกเลิก</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={lines.length === 0 || !warehouseId}>
            สร้างรายการหยิบสินค้า
          </Button>
        </div>
      </div>
    </div>
  );
}
