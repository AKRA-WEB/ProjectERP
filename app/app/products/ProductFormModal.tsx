'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, Select } from '@/components/ui';
import { get, post, patch, del } from '@/lib/api-client';
import type { Product, ProductUom, UnitOfMeasure } from '@/types';

interface Props {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

interface UomOption {
  value: string;
  label: string;
}

interface Category {
  id: string;
  name_th: string;
}

export default function ProductFormModal({ product, onClose, onSaved }: Props) {
  const isEdit = !!product;
  const [activeTab, setActiveTab] = useState<'info' | 'uom'>('info');
  const [form, setForm] = useState({
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    name_th: product?.name_th ?? '',
    name_en: product?.name_en ?? '',
    uom_id: product?.uom_id ?? '',
    category_id: product?.category_id ?? '',
    unit_cost: product?.unit_cost?.toString() ?? '0',
    reorder_point: product?.reorder_point?.toString() ?? '0',
    w1_reorder_point: product?.w1_reorder_point?.toString() ?? '0',
    w1_reorder_qty: product?.w1_reorder_qty?.toString() ?? '0',
    is_lot_tracked: product?.is_lot_tracked ?? false,
    is_serial_tracked: product?.is_serial_tracked ?? false,
    is_npd_trial: product?.is_npd_trial ?? false,
    npd_end_date: '',
  });
  const [uoms, setUoms] = useState<UomOption[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [productUoms, setProductUoms] = useState<ProductUom[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // New UOM Form
  const [showAddUom, setShowAddUom] = useState(false);
  const [uomForm, setUomForm] = useState({
    uom_id: '',
    conversion_factor: '1',
    uom_type: 'other' as ProductUom['uom_type']
  });

  const fetchProductUoms = useCallback(async () => {
    if (!product) return;
    const res = await get<ProductUom[]>(`/api/products/${product.id}/uom`);
    setProductUoms(res);
  }, [product]);

  useEffect(() => {
    get<UnitOfMeasure[]>('/api/products/uom').then((data) =>
      setUoms(data.map((u) => ({ value: u.id, label: `${u.code} — ${u.name_th}` })))
    );
    get<Category[]>('/api/products/categories').then((data) =>
      setCategories(data.map((c) => ({ value: c.id, label: c.name_th })))
    );
    if (isEdit && product) {
      fetchProductUoms();
      get<{ is_npd_trial: boolean; trial: { end_date: string } | null }>(`/api/products/${product.id}/npd-trial`)
        .then((res) => {
          if (res && res.trial) {
            const endDate = res.trial.end_date;
            const isNpdTrial = res.is_npd_trial;
            setForm((f) => ({
              ...f,
              is_npd_trial: isNpdTrial,
              npd_end_date: endDate ? new Date(endDate).toISOString().split('T')[0] : '',
            }));
          } else {
            const isNpdTrial = res?.is_npd_trial ?? false;
            setForm((f) => ({
              ...f,
              is_npd_trial: isNpdTrial,
              npd_end_date: '',
            }));
          }
        })
        .catch((err) => console.error('Failed to load NPD trial details:', err));
    }
  }, [isEdit, product, fetchProductUoms]);

  function set(key: string, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const productPayload = {
        sku: form.sku,
        barcode: form.barcode || null,
        name_th: form.name_th,
        name_en: form.name_en,
        uom_id: form.uom_id,
        category_id: form.category_id || null,
        unit_cost: parseFloat(form.unit_cost),
        reorder_point: parseInt(form.reorder_point),
        w1_reorder_point: form.w1_reorder_point ? parseFloat(form.w1_reorder_point) : null,
        w1_reorder_qty: form.w1_reorder_qty ? parseFloat(form.w1_reorder_qty) : null,
        is_lot_tracked: form.is_lot_tracked,
        is_serial_tracked: form.is_serial_tracked,
        action: 'update_info' as const,
      };

      let savedProduct: Product | null = null;
      if (isEdit && product) {
        savedProduct = await patch<Product>(`/api/products/${product.id}`, productPayload);
      } else {
        savedProduct = await post<Product>('/api/products', productPayload);
      }

      const finalProductId = product?.id ?? savedProduct?.id;

      if (form.is_npd_trial && form.npd_end_date && finalProductId) {
        await post(`/api/products/${finalProductId}/npd-trial`, { end_date: form.npd_end_date });
      } else if (!form.is_npd_trial && product?.is_npd_trial) {
        // If toggled off in edit form, graduate it to normal standard SKU as a simple toggle fallback
        await patch(`/api/products/${product.id}/npd-trial`, { action: 'graduate' });
      }

      onSaved();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddUom() {
    if (!product) return;
    try {
      await post(`/api/products/${product.id}/uom`, {
        uom_id: uomForm.uom_id,
        conversion_factor: parseFloat(uomForm.conversion_factor),
        uom_type: uomForm.uom_type
      });
      setShowAddUom(false);
      setUomForm({ uom_id: '', conversion_factor: '1', uom_type: 'other' });
      fetchProductUoms();
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err.message || 'Error adding UOM');
    }
  }

  async function removeUom(uomId: string) {
    if (!product || !confirm('คุณต้องการลบหน่วยนับนี้ใช่หรือไม่?')) return;
    try {
      await del(`/api/products/${product.id}/uom/${uomId}`);
      fetchProductUoms();
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(err.message || 'Error removing UOM');
    }
  }

  return (
    <Modal open onClose={onClose} size={activeTab === 'uom' ? 'lg' : 'md'}>
      <ModalHeader>
        <div className="flex items-center justify-between pr-8">
          <span>{isEdit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</span>
          {isEdit && (
            <div className="flex gap-1 ml-6 bg-stone-100 p-0.5 rounded-lg">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-3 py-1 text-[12px] font-medium rounded-md transition-colors ${activeTab === 'info' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                ข้อมูลพื้นฐาน
              </button>
              <button
                onClick={() => setActiveTab('uom')}
                className={`px-3 py-1 text-[12px] font-medium rounded-md transition-colors ${activeTab === 'uom' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                หน่วยนับเพิ่มเติม
              </button>
            </div>
          )}
        </div>
      </ModalHeader>
      
      <ModalBody>
        {activeTab === 'info' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="SKU *" value={form.sku} onChange={(e) => set('sku', e.target.value)} disabled={isEdit} />
              <Input label="Barcode" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
              <Input label="ชื่อสินค้า (TH) *" value={form.name_th} onChange={(e) => set('name_th', e.target.value)} />
              <Input label="Product Name (EN) *" value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
              <Select
                label="หน่วยนับ / UOM *"
                value={form.uom_id}
                onChange={(e) => set('uom_id', e.target.value)}
                options={uoms}
                placeholder="เลือกหน่วยนับ"
              />
              <Select
                label="หมวดหมู่ / Category"
                value={form.category_id}
                onChange={(e) => set('category_id', e.target.value)}
                options={categories}
                placeholder="ไม่ระบุ"
              />
              <Input label="ราคาทุน / Unit Cost (THB)" type="number" value={form.unit_cost} onChange={(e) => set('unit_cost', e.target.value)} />
              <Input label="จุดสั่งซื้อ / Reorder Point" type="number" value={form.reorder_point} onChange={(e) => set('reorder_point', e.target.value)} />
              <Input label="จุดสั่งเติม W1 (หน้าร้าน) / W1 Reorder Point" type="number" value={form.w1_reorder_point} onChange={(e) => set('w1_reorder_point', e.target.value)} />
              <Input label="จำนวนสั่งเติม W1 (หน้าร้าน) / W1 Reorder Qty" type="number" value={form.w1_reorder_qty} onChange={(e) => set('w1_reorder_qty', e.target.value)} />
            </div>
            <div className="mt-4 flex gap-6">
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_lot_tracked}
                  onChange={(e) => { set('is_lot_tracked', e.target.checked); if (e.target.checked) set('is_serial_tracked', false); }}
                  className="rounded border-stone-300 text-stone-900 focus:ring-stone-900/5"
                />
                ติดตาม Lot
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_serial_tracked}
                  onChange={(e) => { set('is_serial_tracked', e.target.checked); if (e.target.checked) set('is_lot_tracked', false); }}
                  className="rounded border-stone-300 text-stone-900 focus:ring-stone-900/5"
                />
                ติดตาม Serial Number
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_npd_trial}
                  onChange={(e) => set('is_npd_trial', e.target.checked)}
                  className="rounded border-stone-300 text-stone-900 focus:ring-stone-900/5"
                />
                สินค้าทดลองขายใหม่ (NPD Trial)
              </label>
            </div>
            {form.is_npd_trial && (
              <div className="mt-2 p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-1">
                <Input 
                  label="วันที่สิ้นสุดระยะเวลาทดลองขาย / Trial End Date *" 
                  type="date" 
                  value={form.npd_end_date} 
                  onChange={(e) => set('npd_end_date', e.target.value)} 
                />
                <p className="text-[11.5px] text-stone-400 mt-1">เมื่อครบกำหนด ระบบจะพยากรณ์ยอดขายรายวันและสถิติเพื่อช่วยแนะนำให้ Graduate หรือ Cut ออกจากระบบ</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
             <div className="flex items-center justify-between border-b pb-3">
               <div>
                 <h3 className="text-sm font-bold text-stone-900">การแปลงหน่วยนับ (Multi-UOM)</h3>
                 <p className="text-xs text-stone-500 mt-0.5">ระบุหน่วยนับอื่นๆ ที่ไม่ใช่หน่วยหลัก</p>
               </div>
               <Button size="sm" onClick={() => setShowAddUom(true)}>+ เพิ่มหน่วยนับ</Button>
             </div>

             <div className="rounded-lg border overflow-hidden">
               <table className="w-full text-[13px]">
                 <thead className="bg-stone-50 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                   <tr>
                     <th className="text-left p-3">หน่วยนับ</th>
                     <th className="text-right p-3">ตัวคูณ (Conversion)</th>
                     <th className="text-left p-3">ประเภท</th>
                     <th className="text-center p-3">สถานะ</th>
                     <th className="p-3 w-10"></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {productUoms.length === 0 ? (
                     <tr><td colSpan={5} className="p-8 text-center text-stone-400 italic">ไม่มีข้อมูลหน่วยนับเพิ่มเติม</td></tr>
                   ) : productUoms.map(pu => (
                     <tr key={pu.id} className="hover:bg-stone-50/50 transition-colors">
                       <td className="p-3 font-medium text-stone-900">{pu.uom_code} — {pu.uom_name_th}</td>
                       <td className="p-3 text-right font-mono">1 {pu.uom_code} = {Number(pu.conversion_factor).toLocaleString()} หน่วยหลัก</td>
                       <td className="p-3 uppercase text-[11px] text-stone-500 font-medium">{pu.uom_type}</td>
                       <td className="p-3 text-center">
                         <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${pu.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-stone-100 text-stone-500'}`}>
                           {pu.is_active ? 'Active' : 'Inactive'}
                         </span>
                       </td>
                       <td className="p-3 text-right">
                         <button onClick={() => removeUom(pu.uom_id)} className="text-stone-300 hover:text-red-600 transition-colors">✕</button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>

             {showAddUom && (
               <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <Select
                     label="หน่วยนับ *"
                     value={uomForm.uom_id}
                     onChange={(e) => setUomForm({...uomForm, uom_id: e.target.value})}
                     options={uoms.filter(u => u.value !== form.uom_id && !productUoms.some(pu => pu.uom_id === u.value))}
                     placeholder="เลือกหน่วยนับ"
                   />
                   <Input
                     label="ตัวคูณต่อหน่วยหลัก *"
                     type="number"
                     min="0.000001"
                     step="any"
                     value={uomForm.conversion_factor}
                     onChange={(e) => setUomForm({...uomForm, conversion_factor: e.target.value})}
                     placeholder="เช่น 1 ลัง = 12 ชิ้น (ระบุ 12)"
                   />
                   <Select
                     label="ใช้สำหรับ"
                     value={uomForm.uom_type}
                     onChange={(e) => setUomForm({...uomForm, uom_type: e.target.value as ProductUom['uom_type']})}
                     options={[
                       { value: 'other', label: 'ทั่วไป (Other)' },
                       { value: 'purchase', label: 'จัดซื้อ (Purchase)' },
                       { value: 'sales', label: 'ขาย (Sales)' },
                     ]}
                   />
                 </div>
                 <div className="flex justify-end gap-2">
                   <Button variant="ghost" size="sm" onClick={() => setShowAddUom(false)}>ยกเลิก</Button>
                   <Button size="sm" onClick={handleAddUom} disabled={!uomForm.uom_id}>ตกลง</Button>
                 </div>
               </div>
             )}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
        {activeTab === 'info' && (
          <Button onClick={handleSave} loading={saving}>
            {isEdit ? 'บันทึก' : 'เพิ่มสินค้า'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
