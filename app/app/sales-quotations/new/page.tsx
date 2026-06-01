'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import type { Customer, Warehouse, Product, SalesQuotation } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function NewSalesQuotationPage() {
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
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  
  // Lines State
  const [lines, setLines] = useState<Array<{
    product_id: string;
    qty: number;
    unit_price: number;
    discount_amount: number;
  }>>([]);

  useEffect(() => {
    Promise.all([
      get<{ data: Customer[] }>('/api/customers?is_active=true&limit=1000'),
      get<Warehouse[]>('/api/admin/warehouses'),
      get<{ data: Product[] }>('/api/products?is_active=true&limit=1000') // Simplification for demo
    ]).then(([custs, whs, prods]) => {
      setCustomers(custs.data);
      setWarehouses(whs.filter(w => w.is_active));
      setProducts(prods.data);
      if (whs.length > 0) setWarehouseId(whs[0].id);
      
      // Default valid until: 30 days from now
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setValidUntil(d.toISOString().split('T')[0]);
    }).finally(() => setLoading(false));
  }, []);

  function addLine() {
    setLines([...lines, { product_id: '', qty: 1, unit_price: 0, discount_amount: 0 }]);
  }

  function updateLine(index: number, field: string, value: string | number) {
    const newLines = [...lines];
    const val = typeof value === 'string' ? (field === 'product_id' ? value : Number(value) || 0) : value;
    newLines[index] = { ...newLines[index], [field]: val as never };
    
    // Auto-fill price if product selected
    if (field === 'product_id') {
      const p = products.find(p => p.id === value);
      if (p) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newLines[index].unit_price = Number((p as any).selling_price || p.unit_cost || 0);
      }
    }
    
    setLines(newLines);
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  // Derived Totals
  const subtotal = lines.reduce((acc, line) => acc + (line.qty * line.unit_price) - line.discount_amount, 0);
  const vatAmount = Math.round(subtotal * 0.07 * 100) / 100;
  const totalAmount = subtotal + vatAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return alert('กรุณาเลือกลูกค้า');
    if (!warehouseId) return alert('กรุณาเลือกคลังสินค้า');
    if (lines.length === 0) return alert('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ');
    if (lines.some(l => !l.product_id || l.qty <= 0)) return alert('กรุณาระบุสินค้าและจำนวนให้ครบถ้วน');

    setSubmitting(true);
    try {
      const res = await post<SalesQuotation>('/api/sales-quotations', {
        customer_id: customerId,
        warehouse_id: warehouseId,
        valid_until: validUntil || undefined,
        notes,
        lines: lines.map(l => ({
          product_id: l.product_id,
          qty: l.qty,
          unit_price: l.unit_price,
          discount_amount: l.discount_amount,
        })),
      });
      router.push(`/app/sales-quotations/${res.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create SQ');
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-center">Loading data...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/app/sales-quotations" className="text-stone-400 hover:text-stone-600">←</Link>
        <h1 className="text-2xl font-semibold text-stone-900">สร้างใบเสนอราคา / New Quotation</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={`${CARD} p-6 space-y-6`}>
          <h2 className="text-lg font-medium border-b border-stone-100 pb-2">ข้อมูลเอกสาร / Document Info</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <Select label="ลูกค้า / Customer" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
              <option value="">-- เลือกลูกค้า --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name_th}</option>)}
            </Select>

            <Select label="คลังสินค้า / Warehouse" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name_th}</option>)}
            </Select>

            <Input label="ยืนราคาถึง / Valid Until" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} required />
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
                      <input type="number" min="1" step="0.01" className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm text-right" value={line.qty || ''} onChange={e => updateLine(i, 'qty', e.target.value)} required />
                    </td>
                    <td className="p-2">
                      <input type="number" min="0" step="0.01" className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm text-right" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', e.target.value)} required />
                    </td>
                    <td className="p-2">
                      <input type="number" min="0" step="0.01" className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm text-right" value={line.discount_amount} onChange={e => updateLine(i, 'discount_amount', e.target.value)} />
                    </td>
                    <td className="p-2 text-right font-mono font-bold">
                      {formatCurrency((line.qty * line.unit_price) - line.discount_amount)}
                    </td>
                    <td className="p-2 text-center">
                      <button type="button" onClick={() => removeLine(i)} className="text-stone-300 hover:text-red-500 transition-colors p-1">✕</button>
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-stone-400 border-2 border-dashed border-stone-200 rounded-lg m-4">คลิก &apos;+ เพิ่มรายการ&apos; เพื่อใส่สินค้า</td></tr>
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
          <Link href="/app/sales-quotations">
            <Button type="button" variant="outline" disabled={submitting}>ยกเลิก / Cancel</Button>
          </Link>
          <Button type="submit" loading={submitting}>บันทึกใบเสนอราคา / Save SQ</Button>
        </div>
      </form>
    </div>
  );
}
