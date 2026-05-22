'use client';

import { useState, useEffect, Suspense, useMemo, ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Select, Tabs, Tab } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { VAT_RATE } from '@/lib/constants';
import type { PaginatedResponse, Product, Warehouse } from '@/types';
import { ApprovalDialog } from '@/components/purchase-orders/ApprovalDialog';
import { cn } from '@/lib/utils';

interface LineItem {
  product_id: string;
  sku: string;
  name_th: string;
  selling_price: number;
  qty_ordered: number;
  unit_price: number;
  line_discount: number;
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

function Textarea({ label, value, onChange, className }: { label: string, value: string, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void, className?: string }) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2 mb-1.5">{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        className={cn(
          "bg-white border border-line rounded-[8px] px-3 py-2 text-[13.5px] text-ink-1 placeholder:text-ink-4 transition-all min-h-[80px]",
          "focus:outline-none focus:border-accent focus:ring-0 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]",
          className
        )}
      />
    </div>
  );
}

function NewPurchaseOrderPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prId = searchParams.get('pr_id');

  const [vendors, setVendors] = useState<{ value: string; label: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [activeTab, setActiveTab] = useState('items');
  const [form, setForm] = useState({
    vendor_id: '',
    warehouse_id: '',
    bill_discount: 0,
    non_vat_amount: 0,
    include_vat: false,
    doc_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    delivery_date: '',
    from_address: '',
    to_address: '',
    reference: '',
    payment_terms_days: 30,
    notes: '',
    expected_date: '',
  });

  const [lines, setLines] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [vendorCatalog, setVendorCatalog] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // New states for Task 11
  const [confirmedIOs, setConfirmedIOs] = useState<{
    id: string; vendor_id: string; warehouse_id: string; io_number: string; vendor_name: string; line_count: number;
  }[]>([]);
  const [selectedIOIds, setSelectedIOIds] = useState<string[]>([]);
  const [ioLines, setIoLines] = useState<{
    product_id: string; sku: string; name_th: string;
    qty_received: number; uom_code: string; unit_price: number;
  }[]>([]);

  useEffect(() => {
    if (!form.vendor_id) { setVendorCatalog({}); return; }
    get<{ product_id: string; unit_price: number }[]>(`/api/vendors/${form.vendor_id}/catalog`)
      .then((rows) => {
        const map: Record<string, number> = {};
        rows.forEach((r) => { map[r.product_id] = r.unit_price; });
        setVendorCatalog(map);
      })
      .catch(() => setVendorCatalog({}));
  }, [form.vendor_id]);

  useEffect(() => {
    get<PaginatedResponse<Vendor>>('/api/vendors?limit=200').then((r) =>
      setVendors(r.data.map((v) => ({ value: v.id, label: `${v.code} — ${v.name_th}` })))
    );
    get<Warehouse[]>('/api/admin/warehouses').then((data) =>
      setWarehouses(data.map((w) => ({ value: w.id, label: `${w.code} — ${w.name_th}` })))
    );
    get<{ data: typeof confirmedIOs }>('/api/inbound-orders?status=verified&limit=100')
      .then((r) => setConfirmedIOs((r as { data: typeof confirmedIOs }).data ?? []));

    if (prId) {
      get<PRDetail>(`/api/purchase-requests/${prId}`).then((pr) => {
        setForm((f) => ({ ...f, warehouse_id: pr.warehouse_id }));
        setLines(pr.lines.map((l) => ({
          product_id: l.product_id,
          sku: l.sku,
          name_th: l.name_th,
          selling_price: 0,
          qty_ordered: Number(l.qty_requested),
          unit_price: Number(l.unit_cost),
          line_discount: 0,
        })));
      });
    }
  }, [prId]);

  useEffect(() => {
    if (!selectedIOIds.length) { setIoLines([]); return; }
    Promise.all(selectedIOIds.map((id) => get<{ lines: { product_id: string; sku: string; name_th: string; qty_received: number; uom_code: string }[]; vendor_id: string; warehouse_id: string }>(`/api/inbound-orders/${id}`)))
      .then((results) => {
        const merged = new Map<string, typeof ioLines[0]>();
        if (results.length > 0) {
          const firstVendorId = results[0].vendor_id;
          const firstWarehouseId = results[0].warehouse_id;
          setForm((f) => ({ ...f, vendor_id: firstVendorId, warehouse_id: firstWarehouseId }));
        }
        for (const r of results) {
          for (const l of r.lines ?? []) {
            if (merged.has(l.product_id)) {
              merged.get(l.product_id)!.qty_received += Number(l.qty_received);
            }
            else {
              merged.set(l.product_id, { ...l, qty_received: Number(l.qty_received), unit_price: 0 });
            }
          }
        }
        const filteredLines = Array.from(merged.values()).filter((l) => Number(l.qty_received) > 0);
        setIoLines(filteredLines);
      });
  }, [selectedIOIds]);

  const summary = useMemo(() => {
    const activeLines = selectedIOIds.length > 0
      ? ioLines.map((l) => ({
          qty_ordered: l.qty_received,
          unit_price: l.unit_price,
          line_discount: 0,
        }))
      : lines;
    const subtotal = activeLines.reduce((s, l) => s + l.qty_ordered * l.unit_price, 0);
    const totalLineDiscount = activeLines.reduce((s, l) => s + l.line_discount, 0);
    const afterLineDiscount = subtotal - totalLineDiscount;
    const preVat = afterLineDiscount - form.bill_discount - form.non_vat_amount;
    const vat = form.include_vat ? 0 : Math.round(preVat * VAT_RATE * 100) / 100;
    const netTotal = preVat + vat + form.non_vat_amount;

    return {
      subtotal,
      totalLineDiscount,
      afterLineDiscount,
      billDiscount: form.bill_discount,
      nonVatAmount: form.non_vat_amount,
      preVat,
      vat,
      netTotal,
    };
  }, [lines, ioLines, selectedIOIds, form.bill_discount, form.non_vat_amount, form.include_vat]);

  function setF(key: string, val: string | number | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function searchProducts(q: string) {
    setProductSearch(q);
    if (!q) { setProductResults([]); return; }
    const res = await get<PaginatedResponse<Product>>(`/api/products?search=${encodeURIComponent(q)}&limit=10`);
    setProductResults(res.data ?? []);
  }

  function addProduct(p: Product) {
    const vendorPrice = vendorCatalog[p.id];
    const unit_price = vendorPrice !== undefined ? vendorPrice : (Number(p.unit_cost) || 0);
    setLines((prev) => [...prev, {
      product_id: p.id,
      sku: p.sku,
      name_th: p.name_th,
      selling_price: Number(p.unit_cost) * 1.5,
      qty_ordered: 1,
      unit_price,
      line_discount: 0
    }]);
    setProductSearch('');
    setProductResults([]);
  }

  function updateLine(i: number, key: keyof LineItem, val: string | number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }

  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }

  async function handleSubmit(approveImmediately: boolean) {
    const newErrors: Record<string, string> = {};
    if (!form.vendor_id) newErrors.vendor_id = 'กรุณาเลือกผู้จำหน่าย';
    if (!form.warehouse_id) newErrors.warehouse_id = 'กรุณาเลือกคลังสินค้า';
    if (!form.expected_date) {
      newErrors.expected_date = 'กรุณาระบุวันที่คาดรับ';
      setActiveTab('details');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    if (selectedIOIds.length === 0 && lines.length === 0) {
      setError('กรุณาเพิ่มรายการสินค้า');
      return;
    }

    setErrors({});
    setError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          qty_ordered: l.qty_ordered,
          unit_price: l.unit_price,
          line_discount: l.line_discount,
        })),
      };

      if (selectedIOIds.length > 0) {
        payload.io_ids = selectedIOIds;
        payload.vendor_id = form.vendor_id;
        payload.warehouse_id = form.warehouse_id;
        payload.lines = ioLines.map((l) => ({
          product_id: l.product_id,
          qty_ordered: l.qty_received,
          unit_price: l.unit_price,
          line_discount: 0,
        }));
      } else if (prId) {
        payload.pr_ids = [prId];
      }

      const po = await post<{ id: string }>('/api/purchase-orders', payload);

      if (approveImmediately) {
        await post(`/api/purchase-orders/${po.id}/approve`, {});
      }

      router.push(`/app/purchase-orders/${po.id}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'เกิดข้อผิดพลาด');
      setSaving(false);
    }
  }

  const vendorName = vendors.find(v => v.value === form.vendor_id)?.label.split(' — ')[1] || '';

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">สร้างใบสั่งซื้อใหม่</h1>
        <button className="text-sm text-gray-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* IO Multi-Select Box */}
          <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              📦 เลือก Inbound Orders ที่ยืนยันแล้ว
            </h2>
            <p className="text-xs text-gray-500">
              * การเลือก IO จะกำหนดผู้จำหน่ายและคลังสินค้าตามใบสั่งสินค้า และสรุปยอดรายการสินค้าให้อัตโนมัติ
            </p>
            <div className="space-y-1 max-h-52 overflow-y-auto border rounded-lg p-2 bg-gray-50">
              {confirmedIOs.length === 0 && <p className="text-sm text-gray-400 p-2">ไม่มี Inbound Order ที่รอเปิด PO</p>}
              {confirmedIOs.map((io) => (
                <label key={io.id} className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedIOIds.includes(io.id)}
                    onChange={(e) => setSelectedIOIds((prev) =>
                      e.target.checked ? [...prev, io.id] : prev.filter((x) => x !== io.id)
                    )}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-sm font-mono font-bold text-gray-900">{io.io_number}</span>
                    <span className="text-sm text-blue-600">{io.vendor_name}</span>
                    <span className="text-xs text-gray-400">{io.line_count} รายการ</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <Select
                label="ผู้จำหน่าย *"
                value={form.vendor_id}
                onChange={(e) => setF('vendor_id', e.target.value)}
                options={vendors}
                placeholder="เลือกผู้จำหน่าย"
                error={errors.vendor_id}
                disabled={selectedIOIds.length > 0}
              />
              <Select
                label="คลังสินค้า *"
                value={form.warehouse_id}
                onChange={(e) => setF('warehouse_id', e.target.value)}
                options={warehouses}
                placeholder="เลือกคลังสินค้า"
                error={errors.warehouse_id}
                disabled={selectedIOIds.length > 0}
              />
            </div>

            {selectedIOIds.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                  <p className="text-sm font-semibold text-emerald-800">
                    อยู่ในโหมดรวม Inbound Orders ({selectedIOIds.length} รายการ)
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    ระบบจะสร้างใบสั่งซื้อด้วยสินค้าและจำนวนที่รับมาจากใบสั่งสินค้าทั้งหมด
                  </p>
                </div>

                {ioLines.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700">ใส่ราคาต่อหน่วยสำหรับรายการรับสินค้า</p>
                    <div className="space-y-2">
                      {ioLines.map((line, i) => (
                        <div key={line.product_id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
                          <div className="flex-1">
                            <span className="font-mono text-xs text-gray-500 block">{line.sku}</span>
                            <span className="text-sm font-medium text-gray-900">{line.name_th}</span>
                          </div>
                          <div className="text-sm text-gray-500 flex-shrink-0">
                            รับแล้ว <span className="font-bold font-mono text-emerald-700">{line.qty_received}</span> {line.uom_code}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="ราคา/หน่วย"
                              value={line.unit_price || ''}
                              onChange={(e) => {
                                const updated = [...ioLines];
                                updated[i] = { ...updated[i], unit_price: parseFloat(e.target.value) || 0 };
                                setIoLines(updated);
                              }}
                              className="w-28 text-right font-mono"
                            />
                            <span className="text-xs text-gray-500">บาท</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Tabs>
                  <Tab active={activeTab === 'items'} onClick={() => setActiveTab('items')}>สินค้านำเข้า</Tab>
                  <Tab active={activeTab === 'details'} onClick={() => setActiveTab('details')}>รายละเอียด</Tab>
                </Tabs>

                <div className="mt-4">
                  {activeTab === 'items' && (
                    <div className="space-y-4">
                      <div className="relative">
                        <Input label="ค้นหาสินค้า" value={productSearch} onChange={(e) => searchProducts(e.target.value)} placeholder="พิมพ์ SKU หรือชื่อสินค้า..." />
                        {productResults.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-60 overflow-y-auto">
                            {productResults.map((p) => (
                              <button key={p.id} type="button" className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm" onClick={() => addProduct(p)}>
                                <span className="font-mono font-medium">{p.sku}</span> — {p.name_th}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left p-3 font-medium text-gray-600">สินค้า</th>
                              <th className="text-right p-3 font-medium text-gray-600 w-24">จำนวน</th>
                              <th className="text-right p-3 font-medium text-gray-600 w-32">ราคา/หน่วย</th>
                              <th className="text-right p-3 font-medium text-gray-600 w-32">ส่วนลดรวม</th>
                              <th className="text-right p-3 font-medium text-gray-600 w-32">รวม</th>
                              <th className="w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-400 italic">ยังไม่มีรายการสินค้า</td>
                              </tr>
                            ) : (
                              lines.map((l, i) => (
                                <tr key={i} className="border-t">
                                  <td className="p-3">
                                    <div className="font-mono text-xs text-gray-500">{l.sku}</div>
                                    <div className="font-medium">{l.name_th}</div>
                                  </td>
                                  <td className="p-2"><input type="number" min="0.01" step="any" value={l.qty_ordered} onChange={(e) => updateLine(i, 'qty_ordered', parseFloat(e.target.value) || 0)} className="w-full text-right rounded border px-2 py-1 font-mono" /></td>
                                  <td className="p-2"><input type="number" min="0" step="any" value={l.unit_price} onChange={(e) => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full text-right rounded border px-2 py-1 font-mono" /></td>
                                  <td className="p-2"><input type="number" min="0" step="any" value={l.line_discount} onChange={(e) => updateLine(i, 'line_discount', parseFloat(e.target.value) || 0)} className="w-full text-right rounded border px-2 py-1 font-mono text-red-600" /></td>
                                  <td className="p-3 text-right font-mono">{formatCurrency(l.qty_ordered * l.unit_price - l.line_discount)}</td>
                                  <td className="p-2 text-center"><button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600">✕</button></td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'details' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="วันที่เอกสาร" type="date" value={form.doc_date} onChange={(e) => setF('doc_date', e.target.value)} />
                      <Input label="วันที่คาดรับ" type="date" value={form.expected_date} onChange={(e) => setF('expected_date', e.target.value)} error={errors.expected_date} />
                      <Input label="วันครบกำหนด" type="date" value={form.expiry_date} onChange={(e) => setF('expiry_date', e.target.value)} />
                      <Input label="วันที่ส่งของ" type="date" value={form.delivery_date} onChange={(e) => setF('delivery_date', e.target.value)} />
                      <Input label="เงื่อนไขการชำระ (วัน)" type="number" value={form.payment_terms_days} onChange={(e) => setF('payment_terms_days', parseInt(e.target.value) || 0)} />
                      <Input label="อ้างอิง" value={form.reference} onChange={(e) => setF('reference', e.target.value)} />
                      <div className="col-span-2">
                        <Textarea label="ที่อยู่ผู้ส่ง" value={form.from_address} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setF('from_address', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <Textarea label="ที่อยู่ผู้รับ" value={form.to_address} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setF('to_address', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <Textarea label="หมายเหตุ" value={form.notes} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setF('notes', e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="sticky top-6 space-y-4">
          <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 border-b pb-2">สรุปยอดเงิน</h2>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ยอดรวม (ก่อนหัก):</span>
                <span className="font-mono">{formatCurrency(summary.subtotal)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>ส่วนลดรวมรายการ:</span>
                <span className="font-mono">-{formatCurrency(summary.totalLineDiscount)}</span>
              </div>
              <div className="flex justify-between font-medium pt-1 border-t">
                <span>ยอดหลังหักส่วนลด:</span>
                <span className="font-mono">{formatCurrency(summary.afterLineDiscount)}</span>
              </div>
              
              <div className="pt-2 space-y-3">
                <Input
                  label="ส่วนลดท้ายบิล"
                  type="number"
                  value={form.bill_discount}
                  onChange={(e) => setF('bill_discount', parseFloat(e.target.value) || 0)}
                  className="font-mono text-right"
                />
                <Input
                  label="ยอดไม่เสียภาษี"
                  type="number"
                  value={form.non_vat_amount}
                  onChange={(e) => setF('non_vat_amount', parseFloat(e.target.value) || 0)}
                  className="font-mono text-right"
                />
              </div>

              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-500">ยอดก่อนภาษี:</span>
                <span className="font-mono">{formatCurrency(summary.preVat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ภาษีมูลค่าเพิ่ม (7%):</span>
                <span className="font-mono">{formatCurrency(summary.vat)}</span>
              </div>
              
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="include_vat"
                  checked={form.include_vat}
                  onChange={(e) => setF('include_vat', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="include_vat" className="text-xs text-gray-600 cursor-pointer select-none">ราคารวม VAT แล้ว</label>
              </div>

              <div className="flex justify-between text-xl font-bold text-blue-700 pt-3 border-t">
                <span>ยอดสุทธิ:</span>
                <span className="font-mono">{formatCurrency(summary.netTotal)}</span>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="grid grid-cols-2 gap-3 pt-4">
              <Button variant="secondary" onClick={() => handleSubmit(false)} loading={saving}>ขอบบิล</Button>
              <Button onClick={() => setShowApproval(true)} disabled={saving || (selectedIOIds.length === 0 && lines.length === 0)}>อนุมัติกัน</Button>
            </div>
          </div>
        </div>
      </div>

      <ApprovalDialog
        open={showApproval}
        onClose={() => setShowApproval(false)}
        vendorName={vendorName}
        lines={selectedIOIds.length > 0 ? ioLines.map((l) => ({
          product_id: l.product_id,
          sku: l.sku,
          name_th: l.name_th,
          selling_price: 0,
          qty_ordered: l.qty_received,
          unit_price: l.unit_price,
          line_discount: 0,
        })) : lines}
        summary={summary}
        onConfirm={() => handleSubmit(true)}
        loading={saving}
      />
    </div>
  );
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-gray-400">กำลังโหลด...</div>}>
      <NewPurchaseOrderPageInner />
    </Suspense>
  );
}
