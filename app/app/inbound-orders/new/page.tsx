'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { Warehouse, Product } from '@/types';

interface ProductSearchProps {
  value: string;        // current display text (SKU — name)
  onSelect: (id: string, label: string) => void;
  onClear: () => void;
}

function ProductSearch({ value, onSelect, onClear }: ProductSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. when line is cleared)
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await get<{ data: Product[] }>(
          `/api/products?search=${encodeURIComponent(query)}&limit=20`
        );
        // The api-client get() already unwraps the data property if it exists
        // or returns the body directly. Based on search patterns, it returns the array directly.
        const products = Array.isArray(res) 
          ? res 
          : (res && typeof res === 'object' && 'data' in res ? (res as { data: Product[] }).data : []);
        setResults(products);
        setOpen(products.length > 0);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="พิมพ์ชื่อหรือ SKU..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
        />
        {value && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); onClear(); }}
            className="text-gray-400 hover:text-gray-600 text-xs px-1"
            aria-label="ล้าง"
          >
            ✕
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {loading && (
            <p className="px-3 py-2 text-xs text-gray-400">กำลังค้นหา...</p>
          )}
          {!loading && results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
              onClick={() => {
                const label = `${p.sku} — ${p.name_th}`;
                setQuery(label);
                setOpen(false);
                onSelect(p.id, label);
              }}
            >
              <span className="font-mono text-xs text-gray-500 mr-2">{p.sku}</span>
              {p.name_th}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface IOLine {
  product_id: string;
  product_label: string;   // display text in the search box
  qty_ordered: number;
  notes: string;
}

export default function NewInboundOrderPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<{ value: string; label: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);

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
  }, []);

  function addLine() {
    setLines([...lines, { product_id: '', product_label: '', qty_ordered: 1, notes: '' }]);
  }

  function removeLine(i: number) {
    setLines(lines.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, key: keyof IOLine, val: string | number) {
    const newLines = [...lines];
    newLines[i] = { ...newLines[i], [key]: val } as IOLine;
    setLines(newLines);
  }

  function selectProduct(i: number, id: string, label: string) {
    const newLines = [...lines];
    newLines[i] = { ...newLines[i], product_id: id, product_label: label };
    setLines(newLines);
  }

  function clearProduct(i: number) {
    const newLines = [...lines];
    newLines[i] = { ...newLines[i], product_id: '', product_label: '' };
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
      await post<{ id: string }>('/api/inbound-orders', {
        vendor_id: vendorId,
        warehouse_id: warehouseId,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          qty_ordered: l.qty_ordered,
          notes: l.notes || undefined,
        })),
      });
      router.push('/app/inbound-orders');
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
                    <th className="text-right p-3 font-medium text-gray-600 w-32">จำนวน</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y border-t">
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td className="p-2">
                        <ProductSearch
                          value={l.product_label}
                          onSelect={(id, label) => selectProduct(i, id, label)}
                          onClear={() => clearProduct(i)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="w-full text-right rounded border px-2 py-1"
                          value={l.qty_ordered}
                          min="0.001"
                          step="any"
                          onChange={(e) => updateLine(i, 'qty_ordered', parseFloat(e.target.value) || 0)}
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
