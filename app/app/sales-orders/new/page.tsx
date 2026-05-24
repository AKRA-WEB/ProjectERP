'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { get, post, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import type { Customer, Warehouse, Product, SalesOrder } from '@/types';
import { OverridePinModal } from '@/components/auth/OverridePinModal';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function NewSalesOrderPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  
  // Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [notes, setNotes] = useState('');
  
  // Lines State
  const [lines, setLines] = useState<Array<{
    product_id: string;
    qty_ordered: number;
    unit_price: number;
    discount_amount: number;
    transaction_uom_id?: string;
    uoms?: Array<{ id: string; code: string; name_th: string }>;
  }>>([]);

  const [overrideToken, setOverrideToken] = useState<string | null>(null);
  const [overrideReasonCode, setOverrideReasonCode] = useState<string | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      get<{ data: Customer[] }>('/api/customers?is_active=true&limit=1000'),
      get<Warehouse[]>('/api/admin/warehouses'),
      get<{ data: Product[] }>('/api/products?is_active=true&limit=1000') // Simplification
    ]).then(([custs, whs, prods]) => {
      setCustomers(custs.data);
      setWarehouses(whs.filter(w => w.is_active));
      setProducts(prods.data);
      if (whs.length > 0) setWarehouseId(whs[0].id);
    }).finally(() => setLoading(false));
  }, []);

  function addLine() {
    setLines([...lines, { product_id: '', qty_ordered: 1, unit_price: 0, discount_amount: 0, transaction_uom_id: '', uoms: [] }]);
  }

  async function updateLine(index: number, field: string, value: string | number) {
    const newLines = [...lines];
    const val = typeof value === 'string' ? (field === 'product_id' || field === 'transaction_uom_id' ? value : Number(value) || 0) : value;
    newLines[index] = { ...newLines[index], [field]: val as never };
    
    // Auto-fill price if product selected
    if (field === 'product_id') {
      const productId = value as string;
      const p = products.find(p => p.id === productId);
      if (p) {
        newLines[index].unit_price = Number((p as unknown as Record<string, number>).selling_price || p.unit_cost || 0);

        // Fetch allowed UoMs for AKRA channel
        let allowedUomsList: string[] = [];
        try {
          const whitelist = await get<Array<{ allowed_uoms: string[] }>>(`/api/admin/product-channel-uoms?product_id=${productId}&channel=AKRA`);
          if (whitelist && whitelist.length > 0) {
            allowedUomsList = whitelist[0].allowed_uoms || [];
          }
        } catch (e) {
          console.error('Failed to fetch allowed UoMs:', e);
        }

        // Fetch all UoMs for this product
        let productUoms: Array<{ id: string; code: string; name_th: string }> = [];
        try {
          const uomsRes = await get<Array<{ uom_id: string; uom_code: string; uom_name_th: string }>>(`/api/products/${productId}/uom`);
          productUoms = uomsRes.map(u => ({
            id: u.uom_id,
            code: u.uom_code,
            name_th: u.uom_name_th
          }));
        } catch (e) {
          console.error('Failed to fetch product UoMs:', e);
        }

        // Add base UoM if not in productUoms
        const baseUomId = (p as unknown as Record<string, string>).uom_id;
        const baseUomCode = (p as unknown as Record<string, string>).uom_code;
        const baseUomName = (p as unknown as Record<string, string>).uom_name || baseUomCode;
        if (baseUomId && !productUoms.some(u => u.id === baseUomId)) {
          productUoms.unshift({
            id: baseUomId,
            code: baseUomCode,
            name_th: baseUomName
          });
        }

        // Normalize allowed UoMs to lowercase
        const normalizedAllowed = allowedUomsList.map(u => u.toLowerCase());

        // Filter product UoMs by the whitelist
        const filteredUoms = productUoms.filter(u => {
          if (normalizedAllowed.length > 0) {
            return normalizedAllowed.includes(u.code.toLowerCase());
          }
          return u.id === baseUomId;
        });

        newLines[index].uoms = filteredUoms;
        newLines[index].transaction_uom_id = filteredUoms.length > 0 ? filteredUoms[0].id : (baseUomId || '');
      } else {
        newLines[index].uoms = [];
        newLines[index].transaction_uom_id = '';
      }
    }
    
    setLines(newLines);
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  const subtotal = lines.reduce((acc, line) => acc + (line.qty_ordered * line.unit_price) - line.discount_amount, 0);
  const vatAmount = Math.round(subtotal * 0.07 * 100) / 100;
  const totalAmount = subtotal + vatAmount;

  async function handleSubmit(e?: React.FormEvent, overrideTok?: string, overrideReason?: string) {
    if (e) e.preventDefault();
    if (!customerId) return alert('กรุณาเลือกลูกค้า');
    if (!warehouseId) return alert('กรุณาเลือกคลังสินค้า');
    if (lines.length === 0) return alert('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ');
    if (lines.some(l => !l.product_id || l.qty_ordered <= 0)) return alert('กรุณาระบุสินค้าและจำนวนให้ครบถ้วน');

    setSubmitting(true);
    try {
      const tok = overrideTok || overrideToken || undefined;
      const reason = overrideReason || overrideReasonCode || undefined;
      const res = await post<SalesOrder>('/api/sales-orders', {
        customer_id: customerId,
        warehouse_id: warehouseId,
        expected_delivery: expectedDelivery || undefined,
        payment_terms_days: parseInt(paymentTermsDays),
        notes,
        override_token: tok,
        reason_code: reason,
        lines: lines.map(l => ({
          product_id: l.product_id,
          qty_ordered: l.qty_ordered,
          unit_price: l.unit_price,
          discount_amount: l.discount_amount,
          transaction_uom_id: l.transaction_uom_id || undefined,
          transaction_qty: l.transaction_uom_id ? l.qty_ordered : undefined,
        })),
      });
      router.push(`/app/sales-orders/${res.id}`);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 409) {
        const details = error.details as { code?: string } | undefined;
        if (details?.code === 'MIN_PRICE_VIOLATION') {
          setSubmitting(false);
          setIsOverrideModalOpen(true);
          return;
        }
      }
      alert(error instanceof Error ? error.message : 'Failed to create SO');
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-center">Loading data...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/app/sales-orders" className="text-stone-400 hover:text-stone-600">←</Link>
        <h1 className="text-2xl font-semibold text-stone-900">สร้างใบสั่งขาย / New Sales Order</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={`${CARD} p-6 space-y-6`}>
          <h2 className="text-lg font-medium border-b border-stone-100 pb-2">ข้อมูลเอกสาร / Document Info</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Select label="ลูกค้า / Customer" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
              <option value="">-- เลือกลูกค้า --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name_th}</option>)}
            </Select>

            <Select label="คลังสินค้า / Warehouse" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name_th}</option>)}
            </Select>

            <Input label="กำหนดส่ง / Expected Delivery" type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} />
            <Input label="เครดิตเทอม / Payment Terms" type="number" min="0" value={paymentTermsDays} onChange={e => setPaymentTermsDays(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">หมายเหตุ / Notes</label>
            <textarea
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className={CARD}>
          <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
            <h2 className="text-lg font-medium">รายการสินค้า / Line Items</h2>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>+ เพิ่มรายการ</Button>
          </div>

          <div className="p-4">
            <table className="w-full text-sm text-left">
              <thead className="text-stone-500 bg-stone-50">
                <tr>
                  <th className="p-2 w-1/3">สินค้า / Product</th>
                  <th className="p-2 w-28">หน่วย / UoM</th>
                  <th className="p-2 w-24">จำนวน / Qty</th>
                  <th className="p-2 w-32">ราคาต่อหน่วย / Price</th>
                  <th className="p-2 w-32">ส่วนลด / Disc.</th>
                  <th className="p-2 w-32 text-right">รวม / Total</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td className="p-2">
                      <select
                        className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm"
                        value={line.product_id}
                        onChange={e => updateLine(i, 'product_id', e.target.value)}
                        required
                      >
                        <option value="">-- เลือกสินค้า --</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name_th}</option>)}
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm"
                        value={line.transaction_uom_id || ''}
                        onChange={e => updateLine(i, 'transaction_uom_id', e.target.value)}
                        disabled={!line.product_id}
                        required
                      >
                        {(line.uoms || []).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.code.toUpperCase()}
                          </option>
                        ))}
                        {(!line.product_id || !line.uoms?.length) && (
                          <option value="">--</option>
                        )}
                      </select>
                    </td>
                    <td className="p-2">
                      <input type="number" min="1" step="0.01" className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm text-right" value={line.qty_ordered || ''} onChange={e => updateLine(i, 'qty_ordered', e.target.value)} required />
                    </td>
                    <td className="p-2">
                      <input type="number" min="0" step="0.01" className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm text-right" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', e.target.value)} required />
                    </td>
                    <td className="p-2">
                      <input type="number" min="0" step="0.01" className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm text-right" value={line.discount_amount} onChange={e => updateLine(i, 'discount_amount', e.target.value)} />
                    </td>
                    <td className="p-2 text-right font-mono font-bold">
                      {formatCurrency((line.qty_ordered * line.unit_price) - line.discount_amount)}
                    </td>
                    <td className="p-2 text-center">
                      <button type="button" onClick={() => removeLine(i)} className="text-stone-300 hover:text-red-500 transition-colors p-1">✕</button>
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-stone-400 border-2 border-dashed border-stone-200 rounded-lg m-4">คลิก &apos;+ เพิ่มรายการ&apos; เพื่อใส่สินค้า</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-stone-500 text-sm">
                <span>รวมมูลค่าสินค้า / Subtotal:</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-stone-500 text-sm">
                <span>ภาษีมูลค่าเพิ่ม / VAT (7%):</span>
                <span className="font-mono">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="h-px bg-stone-200 my-2" />
              <div className="flex justify-between font-bold text-base text-stone-900">
                <span>ยอดสุทธิ / Total:</span>
                <span className="font-mono text-emerald-600">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Link href="/app/sales-orders">
            <Button type="button" variant="outline" disabled={submitting}>ยกเลิก / Cancel</Button>
          </Link>
          <Button type="submit" loading={submitting}>บันทึกใบสั่งขาย / Save SO</Button>
        </div>
      </form>

      <OverridePinModal
        isOpen={isOverrideModalOpen}
        action="min_price_override"
        onSuccess={(token, reasonCode) => {
          setIsOverrideModalOpen(false);
          setOverrideToken(token);
          setOverrideReasonCode(reasonCode);
          handleSubmit(undefined, token, reasonCode);
        }}
        onClose={() => setIsOverrideModalOpen(false)}
      />
    </div>
  );
}
