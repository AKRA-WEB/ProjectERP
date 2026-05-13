'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, SearchInput } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { Product, PaginatedResponse, UnitOfMeasure, BomType } from '@/types';

interface BomLineItem {
  component_id: string;
  component_label: string;
  uom_id: string;
  uoms: UnitOfMeasure[];
  qty_required: number;
  scrap_pct: number;
  notes: string;
}

export default function NewBomPage() {
  const router = useRouter();
  
  // Header
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [uomId, setUomId] = useState('');
  const [outputQty, setOutputQty] = useState(1);
  const [bomType, setBomType] = useState<BomType>('manufacturing');
  const [version, setVersion] = useState(1);
  const [notes, setNotes] = useState('');
  
  // Lines
  const [lines, setLines] = useState<BomLineItem[]>([]);
  const [compSearch, setCompSearch] = useState('');
  const [compResults, setCompResults] = useState<Product[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Search Products for Header
  async function handleProductSearch(q: string) {
    setProductSearch(q);
    if (!q) { setProductResults([]); return; }
    const res = await get<PaginatedResponse<Product>>(`/api/products?search=${encodeURIComponent(q)}&limit=10`);
    setProductResults(res.data ?? []);
  }

  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setUomId(p.uom_id as string);
    setProductSearch('');
    setProductResults([]);
  }

  // Search Components for Lines
  async function handleCompSearch(q: string) {
    setCompSearch(q);
    if (!q) { setCompResults([]); return; }
    const res = await get<PaginatedResponse<Product>>(`/api/products?search=${encodeURIComponent(q)}&limit=10`);
    setCompResults(res.data ?? []);
  }

  async function addComponent(p: Product) {
    if (selectedProduct && p.id === selectedProduct.id) {
      alert('ไม่สามารถนำสินค้าผลผลิตมาเป็นส่วนประกอบได้ (Circular reference)');
      return;
    }
    
    // Fetch available UOMs for this component
    const uoms = await get<UnitOfMeasure[]>(`/api/products/${p.id}/uom`);
    // Include base UOM
    const baseUom = { id: p.uom_id, code: p.uom_code, name_th: '', name_en: '' } as UnitOfMeasure;
    const allUoms = [baseUom, ...uoms];

    setLines((prev) => [...prev, {
      component_id: p.id,
      component_label: `${p.sku} — ${p.name_th}`,
      uom_id: p.uom_id as string,
      uoms: allUoms,
      qty_required: 1,
      scrap_pct: 0,
      notes: '',
    }]);
    setCompSearch('');
    setCompResults([]);
  }

  function updateLine(i: number, key: keyof BomLineItem, val: string | number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (!selectedProduct) { setError('กรุณาเลือกสินค้าผลผลิต'); return; }
    if (lines.length === 0) { setError('กรุณาเพิ่มส่วนประกอบอย่างน้อย 1 รายการ'); return; }
    
    setError('');
    setSaving(true);
    try {
      const res = await post<{ id: string }>('/api/bom', {
        product_id: selectedProduct.id,
        uom_id: uomId,
        output_qty: outputQty,
        bom_type: bomType,
        version: version,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          component_id: l.component_id,
          uom_id: l.uom_id,
          qty_required: l.qty_required,
          scrap_pct: l.scrap_pct,
          notes: l.notes || undefined
        })),
      });
      router.push(`/app/bom/${res.id}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-stone-900">สร้างสูตรการผลิต (BOM) ใหม่</h1>
        <button className="text-sm text-stone-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Header Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 space-y-5">
            <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wider border-b pb-2">ข้อมูลหลัก (Header)</h2>
            
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[13px] font-medium text-stone-700 mb-1 block">สินค้าผลผลิต *</label>
                {selectedProduct ? (
                  <div className="flex items-center justify-between p-2 border rounded-lg bg-stone-50">
                    <div>
                      <div className="font-mono text-xs text-stone-500">{selectedProduct.sku}</div>
                      <div className="text-sm font-medium">{selectedProduct.name_th}</div>
                    </div>
                    <button onClick={() => setSelectedProduct(null)} className="text-stone-400 hover:text-red-600 px-2">✕</button>
                  </div>
                ) : (
                  <>
                    <SearchInput
                      placeholder="ค้นหา SKU หรือชื่อสินค้า..."
                      value={productSearch}
                      onChange={(e) => handleProductSearch(e.target.value)}
                    />
                    {productResults.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                        {productResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-stone-50 text-sm border-b last:border-0"
                            onClick={() => selectProduct(p)}
                          >
                            <span className="font-mono font-medium text-stone-900">{p.sku}</span>
                            <div className="text-stone-500 text-xs">{p.name_th}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="จำนวนผลผลิต *"
                  type="number"
                  min="0.0001"
                  step="any"
                  value={outputQty}
                  onChange={(e) => setOutputQty(parseFloat(e.target.value) || 0)}
                />
                <Select
                  label="หน่วย *"
                  value={uomId}
                  onChange={(e) => setUomId(e.target.value)}
                  options={selectedProduct ? [{ value: selectedProduct.uom_id as string, label: selectedProduct.uom_code as string }] : []}
                  disabled={!selectedProduct}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="ประเภท *"
                  value={bomType}
                  onChange={(e) => setBomType(e.target.value as BomType)}
                  options={[
                    { value: 'manufacturing', label: 'Manufacturing' },
                    { value: 'kit', label: 'Kit Bundle' },
                  ]}
                />
                <Input
                  label="เวอร์ชัน *"
                  type="number"
                  min="1"
                  value={version}
                  onChange={(e) => setVersion(parseInt(e.target.value) || 1)}
                />
              </div>

              <Input
                label="หมายเหตุ"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ระบุรายละเอียดเพิ่มเติม..."
              />
            </div>
          </div>
          
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
              {error}
            </div>
          )}
          
          <Button className="w-full h-11" onClick={handleSubmit} loading={saving}>บันทึกสูตรการผลิต</Button>
        </div>

        {/* Lines Card */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">ส่วนประกอบ (Components)</h2>
              <span className="text-[12px] text-stone-500">{lines.length} รายการ</span>
            </div>
            
            <div className="p-4 bg-stone-50/50 border-b border-stone-200 relative">
              <SearchInput
                placeholder="ค้นหาส่วนประกอบที่จะเพิ่ม..."
                value={compSearch}
                onChange={(e) => handleCompSearch(e.target.value)}
                className="bg-white"
              />
              {compResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-[calc(100%-2rem)] rounded-lg border bg-white shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                  {compResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-stone-50 text-sm border-b last:border-0"
                      onClick={() => addComponent(p)}
                    >
                      <span className="font-mono font-medium text-stone-900">{p.sku}</span>
                      <div className="text-stone-500 text-xs">{p.name_th}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50/30 text-stone-500 text-[11px] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-3 pl-5">ส่วนประกอบ</th>
                    <th className="text-right p-3 w-28">จำนวน</th>
                    <th className="text-left p-3 w-32">หน่วย</th>
                    <th className="text-right p-3 w-24">Scrap %</th>
                    <th className="text-right p-3 w-28">ใช้จริง</th>
                    <th className="w-10 pr-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-stone-400 italic">
                        ยังไม่มีรายการส่วนประกอบ กรุณาค้นหาและเพิ่มรายการ
                      </td>
                    </tr>
                  ) : lines.map((l, i) => {
                    const effective = l.qty_required / (1 - (l.scrap_pct || 0) / 100);
                    return (
                      <tr key={i} className="hover:bg-stone-50/30 transition-colors">
                        <td className="p-3 pl-5">
                          <div className="font-medium text-stone-900">{l.component_label}</div>
                          <input
                            placeholder="หมายเหตุรายการ..."
                            value={l.notes}
                            onChange={(e) => updateLine(i, 'notes', e.target.value)}
                            className="text-[11px] text-stone-400 bg-transparent outline-none w-full mt-0.5"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0.000001"
                            step="any"
                            value={l.qty_required}
                            onChange={(e) => updateLine(i, 'qty_required', parseFloat(e.target.value) || 0)}
                            className="w-full text-right rounded border border-stone-200 px-2 py-1 text-sm outline-none focus:border-stone-900 transition-colors"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={l.uom_id}
                            onChange={(e) => updateLine(i, 'uom_id', e.target.value)}
                            className="w-full rounded border border-stone-200 px-1 py-1 text-sm outline-none focus:border-stone-900 transition-colors bg-white"
                          >
                            {l.uoms.map(u => (
                              <option key={u.id} value={u.id}>{u.code}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            max="99.9"
                            step="0.1"
                            value={l.scrap_pct}
                            onChange={(e) => updateLine(i, 'scrap_pct', parseFloat(e.target.value) || 0)}
                            className="w-full text-right rounded border border-stone-200 px-2 py-1 text-sm outline-none focus:border-stone-900 transition-colors"
                          />
                        </td>
                        <td className="p-3 text-right font-mono text-stone-600 font-medium">
                          {effective.toFixed(4)}
                        </td>
                        <td className="p-2 pr-5 text-right">
                          <button onClick={() => removeLine(i)} className="text-stone-300 hover:text-red-600 transition-colors">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
