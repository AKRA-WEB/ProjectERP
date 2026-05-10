'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, Select } from '@/components/ui';
import { get, post, patch } from '@/lib/api-client';
import type { Product } from '@/types';

interface Props {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

interface Uom {
  id: string;
  code: string;
  name_th: string;
}

interface Category {
  id: string;
  name_th: string;
}

export default function ProductFormModal({ product, onClose, onSaved }: Props) {
  const isEdit = !!product;
  const [form, setForm] = useState({
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    name_th: product?.name_th ?? '',
    name_en: product?.name_en ?? '',
    uom_id: product?.uom_id ?? '',
    category_id: product?.category_id ?? '',
    unit_cost: product?.unit_cost?.toString() ?? '0',
    reorder_point: product?.reorder_point?.toString() ?? '0',
    is_lot_tracked: product?.is_lot_tracked ?? false,
    is_serial_tracked: product?.is_serial_tracked ?? false,
  });
  const [uoms, setUoms] = useState<{ value: string; label: string }[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<Uom[]>('/api/products/uom').then((data) =>
      setUoms(data.map((u) => ({ value: u.id, label: `${u.code} — ${u.name_th}` })))
    );
    get<Category[]>('/api/products/categories').then((data) =>
      setCategories(data.map((c) => ({ value: c.id, label: c.name_th })))
    );
  }, []);

  function set(key: string, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        barcode: form.barcode || null,
        category_id: form.category_id || null,
        unit_cost: parseFloat(form.unit_cost),
        reorder_point: parseInt(form.reorder_point),
      };
      if (isEdit && product) {
        await patch(`/api/products/${product.id}`, payload);
      } else {
        await post('/api/products', payload);
      }
      onSaved();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose}>
      <ModalHeader>{isEdit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</ModalHeader>
      <ModalBody>
        <div className="grid grid-cols-2 gap-4">
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
        </div>
        <div className="mt-4 flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_lot_tracked}
              onChange={(e) => { set('is_lot_tracked', e.target.checked); if (e.target.checked) set('is_serial_tracked', false); }}
            />
            ติดตาม Lot
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_serial_tracked}
              onChange={(e) => { set('is_serial_tracked', e.target.checked); if (e.target.checked) set('is_lot_tracked', false); }}
            />
            ติดตาม Serial Number
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
        <Button onClick={handleSave} loading={saving}>
          {isEdit ? 'บันทึก' : 'เพิ่มสินค้า'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
