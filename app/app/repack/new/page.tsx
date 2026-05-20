'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, SearchInput } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import type { Product, PaginatedResponse, Warehouse, RepackTemplate } from '@/types';

interface RepackLineItem {
  product_id: string;
  product_label: string;
  qty: number;
  unit_cost: number;
  notes: string;
}

export default function NewRepackOrderPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  
  // Header
  const [sourceSearch, setSourceSearch] = useState('');
  const [sourceResults, setSourceResults] = useState<Product[]>([]);
  const [selectedSource, setSelectedSource] = useState<Product | null>(null);
  
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sourceQty, setSourceQty] = useState(1);
  const [notes, setNotes] = useState('');
  
  // Templates
  const [templates, setTemplates] = useState<RepackTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Lines
  const [lines, setLines] = useState<RepackLineItem[]>([]);
  const [outputSearch, setOutputSearch] = useState('');
  const [outputResults, setOutputResults] = useState<Product[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (selectedSource) {
      fetchTemplates(selectedSource.id);
    } else {
      setTemplates([]);
      setSelectedTemplateId('');
    }
  }, [selectedSource]);

  async function fetchWarehouses() {
    const res = await get<Warehouse[]>('/api/warehouses');
    setWarehouses(res || []);
    if (res?.length > 0) setWarehouseId(res[0].id);
  }

  async function fetchTemplates(productId: string) {
    const res = await get<RepackTemplate[]>(`/api/repack/templates?source_product_id=${productId}`);
    setTemplates(res || []);
  }

  // Search Products for Source
  async function handleSourceSearch(q: string) {
    setSourceSearch(q);
    if (!q) { setSourceResults([]); return; }
    const res = await get<PaginatedResponse<Product>>(`/api/products?search=${encodeURIComponent(q)}&limit=10`);
    setSourceResults(res.data ?? []);
  }

  function selectSource(p: Product) {
    setSelectedSource(p);
    setSourceSearch('');
    setSourceResults([]);
    setLines([]);
  }

  // Search Products for Outputs
  async function handleOutputSearch(q: string) {
    setOutputSearch(q);
    if (!q) { setOutputResults([]); return; }
    const res = await get<PaginatedResponse<Product>>(`/api/products?search=${encodeURIComponent(q)}&limit=10`);
    setOutputResults(res.data ?? []);
  }

  function addOutput(p: Product, qty: number = 0, cost: number = 0) {
    setLines((prev) => [...prev, {
      product_id: p.id,
      product_label: `${p.sku} — ${p.name_th}`,
      qty: qty,
      unit_cost: cost || Number(p.unit_cost) || 0,
      notes: '',
    }]);
    setOutputSearch('');
    setOutputResults([]);
  }

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    setSourceQty(Number(template.source_qty));
    
    // We need product details for labels, so we'll fetch them or assume template has enough
    // For now, let's just use the IDs and fetch details if needed, but better to have it in template items
    if (template.items) {
      const newLines: RepackLineItem[] = template.items.map(item => ({
        product_id: item.product_id,
        product_label: `${item.product_sku || ''} — ${item.product_name_th || ''}`,
        qty: Number(item.qty_ratio) * Number(template.source_qty),
        unit_cost: 0, // Will be calculated based on source cost later
        notes: item.notes || '',
      }));
      setLines(newLines);
    }
  }

  function updateLine(i: number, key: keyof RepackLineItem, val: string | number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (!selectedSource) { setError('กรุณาเลือกสินค้าต้นทาง'); return; }
    if (!warehouseId) { setError('กรุณาเลือกคลังสินค้า'); return; }
    if (lines.length === 0) { setError('กรุณาเพิ่มสินค้าปลายทางอย่างน้อย 1 รายการ'); return; }
    
    setError('');
    setSaving(true);
    try {
      const res = await post<{ id: string }>('/api/repack', {
        source_product_id: selectedSource.id,
        source_qty: sourceQty,
        warehouse_id: warehouseId,
        notes: notes || undefined,
        items: lines.map((l) => ({
          product_id: l.product_id,
          qty: l.qty,
          unit_cost: l.unit_cost,
          notes: l.notes || undefined
        })),
      });
      router.push(`/app/repack/${res.id}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  // Calculate suggested costs based on source cost
  function autoDistributeCost() {
    if (!selectedSource) return;
    const totalSourceValue = Number(selectedSource.unit_cost) * sourceQty;
    const totalOutputQty = lines.reduce((sum, l) => sum + Number(l.qty), 0);
    
    if (totalOutputQty === 0) return;
    
    const costPerUnit = totalSourceValue / totalOutputQty;
    setLines(prev => prev.map(l => ({ ...l, unit_cost: costPerUnit })));
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-stone-900">สร้างใบแบ่งบรรจุ (New Repack Order)</h1>
        <button className="text-sm text-stone-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Header Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 space-y-5">
            <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wider border-b pb-2">สินค้าต้นทาง (Bulk Source)</h2>
            
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[13px] font-medium text-stone-700 mb-1 block">สินค้าต้นทาง *</label>
                {selectedSource ? (
                  <div className="flex items-center justify-between p-2 border rounded-lg bg-stone-50">
                    <div>
                      <div className="font-mono text-xs text-stone-500">{selectedSource.sku}</div>
                      <div className="text-sm font-medium">{selectedSource.name_th}</div>
                      <div className="text-[11px] text-emerald-600 font-medium mt-0.5">ต้นทุน: {formatCurrency(selectedSource.unit_cost, lang)} บาท</div>
                    </div>
                    <button onClick={() => selectSource(null as unknown as Product)} className="text-stone-600 hover:text-red-600 px-2">✕</button>
                  </div>
                ) : (
                  <>
                    <SearchInput
                      placeholder="ค้นหา SKU หรือชื่อสินค้า..."
                      value={sourceSearch}
                      onChange={(e) => handleSourceSearch(e.target.value)}
                    />
                    {sourceResults.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                        {sourceResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-stone-50 text-sm border-b last:border-0"
                            onClick={() => selectSource(p)}
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

              <div className="grid grid-cols-1 gap-3">
                <Input
                  label="จำนวนที่ต้องการแบ่ง *"
                  type="number"
                  min="0.0001"
                  step="any"
                  value={sourceQty}
                  onChange={(e) => setSourceQty(parseFloat(e.target.value) || 0)}
                  disabled={!selectedSource}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[13px] font-medium text-stone-700 block">ใช้สูตรการแบ่ง (Template)</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  disabled={!selectedSource || templates.length === 0}
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 bg-white text-[13px] text-stone-700 outline-none focus:ring-2 focus:ring-stone-950/5 transition-all disabled:bg-stone-50"
                >
                  <option value="">-- เลือกสูตร --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {selectedSource && templates.length === 0 && (
                  <p className="text-[11px] text-stone-400">ยังไม่มีสูตรสำหรับสินค้านี้</p>
                )}
              </div>

              <Select
                label="คลังสินค้า *"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                options={warehouses.map(w => ({ value: w.id, label: w.name_th }))}
              />

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
          
          <Button className="w-full h-11" onClick={handleSubmit} loading={saving}>สร้างใบแบ่งบรรจุ (Draft)</Button>
        </div>

        {/* Lines Card */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">สินค้าปลายทาง (Outputs)</h2>
              <button 
                onClick={autoDistributeCost}
                disabled={lines.length === 0}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium disabled:text-stone-400"
              >
                คำนวณราคาทุนแนะนำ
              </button>
            </div>
            
            <div className="p-4 bg-stone-50/50 border-b border-stone-200 relative">
              <SearchInput
                placeholder="ค้นหาสินค้าที่จะแบ่งออกมา..."
                value={outputSearch}
                onChange={(e) => handleOutputSearch(e.target.value)}
                className="bg-white"
                disabled={!selectedSource}
              />
              {outputResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-[calc(100%-2rem)] rounded-lg border bg-white shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                  {outputResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-stone-50 text-sm border-b last:border-0"
                      onClick={() => addOutput(p)}
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
                    <th className="text-left p-3 pl-5">สินค้าปลายทาง</th>
                    <th className="text-right p-3 w-28">จำนวน (ถุง/ชิ้น)</th>
                    <th className="text-right p-3 w-32">ต้นทุนต่อหน่วย</th>
                    <th className="text-right p-3 w-32">รวมต้นทุน</th>
                    <th className="w-10 pr-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-stone-600 italic">
                        ยังไม่มีรายการสินค้าปลายทาง กรุณาเลือกสินค้าจากการค้นหาหรือใช้สูตร (Template)
                      </td>
                    </tr>
                  ) : lines.map((l, i) => {
                    const totalLineCost = Number(l.qty) * Number(l.unit_cost);
                    return (
                      <tr key={i} className="hover:bg-stone-50/30 transition-colors">
                        <td className="p-3 pl-5">
                          <div className="font-medium text-stone-900">{l.product_label}</div>
                          <input
                            placeholder="หมายเหตุรายการ..."
                            value={l.notes}
                            onChange={(e) => updateLine(i, 'notes', e.target.value)}
                            className="text-[11px] text-stone-600 bg-transparent outline-none w-full mt-0.5"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0.000001"
                            step="any"
                            value={l.qty}
                            onChange={(e) => updateLine(i, 'qty', parseFloat(e.target.value) || 0)}
                            className="w-full text-right rounded border border-stone-200 px-2 py-1 text-sm outline-none focus:border-stone-900 transition-colors"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.unit_cost}
                            onChange={(e) => updateLine(i, 'unit_cost', parseFloat(e.target.value) || 0)}
                            className="w-full text-right rounded border border-stone-200 px-2 py-1 text-sm outline-none focus:border-stone-900 transition-colors"
                          />
                        </td>
                        <td className="p-3 text-right font-mono text-stone-600 font-medium">
                          {formatCurrency(totalLineCost, lang)}
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
                {lines.length > 0 && (
                  <tfoot className="bg-stone-50/50">
                    <tr className="font-semibold text-stone-900">
                      <td className="p-3 pl-5">รวมต้นทุนที่ปันส่วน</td>
                      <td colSpan={2}></td>
                      <td className="p-3 text-right font-mono">
                        {formatCurrency(lines.reduce((sum, l) => sum + (Number(l.qty) * Number(l.unit_cost)), 0), lang)}
                      </td>
                      <td></td>
                    </tr>
                    {selectedSource && (
                      <tr className="text-stone-500 text-xs italic">
                        <td className="p-1 pl-5" colSpan={5}>
                          * ต้นทุนต้นทางทั้งหมด: {formatCurrency(Number(selectedSource.unit_cost) * sourceQty, lang)} บาท
                        </td>
                      </tr>
                    )}
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
