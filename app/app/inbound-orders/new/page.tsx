'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { Warehouse, Product } from '@/types';
import { cn } from '@/lib/utils';

interface ProductSearchProps {
  value: string;        // current display text (SKU — name)
  onSelect: (id: string, label: string) => void;
  onClear: () => void;
  excludeProductIds: string[];
}

function ProductSearch({ value, onSelect, onClear, excludeProductIds }: ProductSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
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

  // Filter out already selected products from suggestions
  const filteredResults = useMemo(() => {
    return results.filter(p => !excludeProductIds.includes(p.id));
  }, [results, excludeProductIds]);

  // Reset activeIndex when results filter or query updates
  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredResults]);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2 || (value && query === value)) { 
      setResults([]); 
      setOpen(false); 
      return; 
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await get<{ data: Product[] }>(
          `/api/products?search=${encodeURIComponent(query)}&limit=20`
        );
        const products = Array.isArray(res) 
          ? res 
          : (res && typeof res === 'object' && 'data' in res ? (res as { data: Product[] }).data : []);
        setResults(products);
        setOpen(products.length > 0);
      } finally {
        setLoading(false);
      }
    }, 200); //snappier 200ms debounce
    return () => clearTimeout(t);
  }, [query, value]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="w-full rounded border px-2 py-1 text-sm min-h-[36px]"
          placeholder="พิมพ์ชื่อหรือ SKU..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          onFocus={() => { if (filteredResults.length > 0) setOpen(true); }}
          onKeyDown={(e) => {
            if (!open || filteredResults.length === 0) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex(prev => Math.min(prev + 1, filteredResults.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
              if (activeIndex >= 0 && activeIndex < filteredResults.length) {
                e.preventDefault();
                const p = filteredResults[activeIndex];
                const label = `${p.sku} — ${p.name_th}`;
                setQuery(label);
                setOpen(false);
                onSelect(p.id, label);
              }
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
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
      {open && filteredResults.length > 0 && (
        <div className="absolute z-50 left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto w-[400px] sm:w-[500px] max-w-[90vw]">
          {loading && (
            <p className="px-3 py-2 text-xs text-gray-400">กำลังค้นหา...</p>
          )}
          {!loading && filteredResults.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2 text-sm border-b last:border-0 transition-colors flex flex-col",
                idx === activeIndex ? "bg-emerald-50 text-emerald-950 font-medium" : "hover:bg-gray-50"
              )}
              onClick={() => {
                const label = `${p.sku} — ${p.name_th}`;
                setQuery(label);
                setOpen(false);
                onSelect(p.id, label);
              }}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-xs text-gray-500">{p.sku}</span>
                {p.uom_code && <span className="text-[11px] bg-gray-100 text-gray-600 px-1 rounded">{p.uom_code}</span>}
              </div>
              <span className="text-gray-950 mt-0.5 text-left">{p.name_th}</span>
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
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<IOLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Searchable Vendor Autocomplete states
  const [vendorSearchText, setVendorSearchText] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const vendorContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (vendorContainerRef.current && !vendorContainerRef.current.contains(e.target as Node)) {
        setShowVendorDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Filter vendors list in-memory matching code or name
  const filteredVendors = useMemo(() => {
    if (!vendorSearchText.trim() || (vendorId && vendors.some(v => v.value === vendorId && v.label === vendorSearchText))) {
      return vendors;
    }
    const q = vendorSearchText.toLowerCase();
    return vendors.filter(v => v.label.toLowerCase().includes(q));
  }, [vendors, vendorSearchText, vendorId]);

  // Sync vendorSearchText with selected vendorId
  useEffect(() => {
    if (vendorId) {
      const selected = vendors.find(v => v.value === vendorId);
      if (selected) {
        setVendorSearchText(selected.label);
      }
    } else {
      setVendorSearchText('');
    }
  }, [vendorId, vendors]);

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

  // Clear a product from a row
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

    // Verify duplicate items
    const productIds = lines.map(l => l.product_id).filter(id => id !== '');
    const hasDuplicates = new Set(productIds).size !== productIds.length;
    if (hasDuplicates) {
      setError('กรุณาอย่าเลือกรายการสินค้าที่ซ้ำกัน');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await post<{ id: string }>('/api/inbound-orders', {
        vendor_id: vendorId,
        warehouse_id: warehouseId,
        order_date: orderDate,
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
        <h1 className="text-2xl font-bold text-gray-900">สร้างรายการรับสินค้า</h1>
        <button className="text-sm text-gray-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
          {/* Autocomplete Vendor Selector */}
          <div ref={vendorContainerRef} className="relative flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">ผู้จำหน่าย / Vendor *</label>
            <div className="relative">
              <input
                type="text"
                placeholder="พิมพ์รหัสหรือชื่อผู้จำหน่าย..."
                value={vendorSearchText}
                onChange={(e) => {
                  setVendorSearchText(e.target.value);
                  setShowVendorDropdown(true);
                  if (!e.target.value) {
                    setVendorId('');
                  }
                }}
                onFocus={() => setShowVendorDropdown(true)}
                className="w-full bg-white border border-gray-300 rounded-[8px] pl-3 pr-8 py-2 text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)] transition-all h-[38px]"
              />
              {vendorId && (
                <button
                  type="button"
                  onClick={() => {
                    setVendorId('');
                    setVendorSearchText('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {showVendorDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                {filteredVendors.length === 0 ? (
                  <p className="p-3 text-sm text-gray-400 italic text-center">ไม่พบผู้จำหน่าย</p>
                ) : (
                  filteredVendors.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => {
                        setVendorId(v.value);
                        setVendorSearchText(v.label);
                        setShowVendorDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-emerald-50 transition-colors border-b last:border-b-0 flex flex-col"
                    >
                      <span className="font-mono text-xs text-gray-500">{v.label.split(' — ')[0]}</span>
                      <span className="text-gray-950 font-medium mt-0.5">{v.label.split(' — ')[1]}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สั่ง</label>
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>

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
            <div className="border rounded-lg overflow-visible" style={{ overflow: 'visible' }}>
              <table className="w-full text-sm min-w-[600px]" style={{ overflow: 'visible' }}>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600 w-5/12">สินค้า</th>
                    <th className="text-left p-3 font-medium text-gray-600 w-4/12">หมายเหตุรายการ</th>
                    <th className="text-right p-3 font-medium text-gray-600 w-2/12">จำนวน</th>
                    <th className="w-1/12 text-center p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y border-t bg-white" style={{ overflow: 'visible' }}>
                  {lines.map((l, i) => (
                    <tr key={i} style={{ overflow: 'visible' }}>
                      <td className="p-2" style={{ overflow: 'visible' }}>
                        <ProductSearch
                          value={l.product_label}
                          onSelect={(id, label) => selectProduct(i, id, label)}
                          onClear={() => clearProduct(i)}
                          excludeProductIds={lines.map(x => x.product_id).filter(id => id !== '' && id !== l.product_id)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="ระบุหมายเหตุสินค้า..."
                          className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm bg-white min-h-[36px] focus:outline-none focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]"
                          value={l.notes}
                          onChange={(e) => updateLine(i, 'notes', e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="w-full text-right rounded border border-gray-300 px-3 py-1.5 min-h-[36px] font-mono focus:outline-none focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]"
                          value={l.qty_ordered || ''}
                          min="0.001"
                          step="any"
                          onChange={(e) => updateLine(i, 'qty_ordered', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="text-gray-400 hover:text-red-600 text-lg transition-colors p-1"
                          aria-label="ลบแถว"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

        <div className="flex justify-end pt-4">
          <Button onClick={handleSubmit} loading={saving} disabled={lines.length === 0}>สร้าง Inbound Order</Button>
        </div>
      </div>
    </div>
  );
}
