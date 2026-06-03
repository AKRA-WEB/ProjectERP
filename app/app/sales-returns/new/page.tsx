'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Link from 'next/link';
import type { Customer, Warehouse, Product, SalesOrder, SalesReturn } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function NewSalesReturnPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  
  // Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [soId, setSoId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  
  // Lines State
  const [lines, setLines] = useState<Array<{
    product_id: string;
    qty_returned: number;
    unit_price: number;
  }>>([]);

  useEffect(() => {
    Promise.all([
      get<{ data: Customer[] }>('/api/customers?is_active=true&limit=1000'),
      get<Warehouse[]>('/api/admin/warehouses'),
      get<{ data: Product[] }>('/api/products?is_active=true&limit=1000'), // Simplification
      get<{ data: SalesOrder[] }>('/api/sales-orders?limit=1000') // Simplification
    ]).then(([custs, whs, prods, sos]) => {
      setCustomers(custs.data);
      setWarehouses(whs.filter(w => w.is_active));
      setProducts(prods.data);
      setSalesOrders(sos.data);
      if (whs.length > 0) setWarehouseId(whs[0].id);
    }).finally(() => setLoading(false));
  }, []);

  function addLine() {
    setLines([...lines, { product_id: '', qty_returned: 1, unit_price: 0 }]);
  }

  function updateLine(index: number, field: string, value: string | number) {
    const newLines = [...lines];
    const val = typeof value === 'string' ? (field === 'product_id' ? value : Number(value) || 0) : value;
    newLines[index] = { ...newLines[index], [field]: val as never };
    setLines(newLines);
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return alert('กรุณาเลือกลูกค้า');
    if (!warehouseId) return alert('กรุณาเลือกคลังสินค้า');
    if (lines.length === 0) return alert('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ');
    if (lines.some(l => !l.product_id || l.qty_returned <= 0)) return alert('กรุณาระบุสินค้าและจำนวนให้ครบถ้วน');

    setSubmitting(true);
    try {
      const res = await post<SalesReturn>('/api/sales-returns', {
        customer_id: customerId,
        warehouse_id: warehouseId,
        so_id: soId || undefined,
        reason: reason || undefined,
        notes: notes || undefined,
        lines: lines.map(l => ({
          product_id: l.product_id,
          qty_returned: l.qty_returned,
          unit_price: l.unit_price,
        })),
      });
      router.push(`/app/sales-returns/${res.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create SR');
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-center">Loading data...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/app/sales-returns" className="text-stone-400 hover:text-stone-600">←</Link>
        <h1 className="text-2xl font-semibold text-stone-900">สร้างใปรับคืน / New Sales Return</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={`${CARD} p-6 space-y-6`}>
          <h2 className="text-lg font-medium border-b border-stone-100 pb-2">ข้อมูลเอกสาร / Document Info</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <Select label="ลูกค้า / Customer" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
              <option value="">-- เลือกลูกค้า --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name_th}</option>)}
            </Select>

            <Select label="คลังสินค้า (รับเข้า) / Warehouse" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name_th}</option>)}
            </Select>

            <Select label="อ้างอิงใบสั่งขาย / SO Ref (Optional)" value={soId} onChange={e => setSoId(e.target.value)}>
              <option value="">-- ไม่อ้างอิง --</option>
              {salesOrders.filter(so => !customerId || so.customer_id === customerId).map(so => (
                <option key={so.id} value={so.id}>{so.so_number}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">สาเหตุการรับคืน / Reason</label>
            <textarea
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">หมายเหตุ / Notes</label>
            <Input
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
                  <th className="p-2 w-1/2">สินค้า / Product</th>
                  <th className="p-2 w-32">จำนวนคืน / Qty</th>
                  <th className="p-2 w-32">ราคา (ตัวเลือก) / Price</th>
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
                      <input type="number" min="1" step="0.01" className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm text-right" value={line.qty_returned || ''} onChange={e => updateLine(i, 'qty_returned', e.target.value)} required />
                    </td>
                    <td className="p-2">
                      <input type="number" min="0" step="0.01" className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm text-right" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', e.target.value)} />
                    </td>
                    <td className="p-2 text-center">
                      <button type="button" onClick={() => removeLine(i)} className="text-stone-300 hover:text-red-500 transition-colors p-1">✕</button>
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-stone-400 border-2 border-dashed border-stone-200 rounded-lg m-4">คลิก &apos;+ เพิ่มรายการ&apos; เพื่อใส่สินค้า</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Link href="/app/sales-returns">
            <Button type="button" variant="outline" disabled={submitting}>ยกเลิก / Cancel</Button>
          </Link>
          <Button type="submit" loading={submitting}>บันทึกใปรับคืน / Save SR</Button>
        </div>
      </form>
    </div>
  );
}
