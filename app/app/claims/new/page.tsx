'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { PaginatedResponse, Warehouse } from '@/types';

interface Vendor {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
}

export default function NewClaimPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<{ value: string; label: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([]);
  const [form, setForm] = useState({
    vendor_id: '',
    warehouse_id: '',
    claim_amount: '',
    description: '',
    grn_id: '',
    po_id: '',
    rma_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<PaginatedResponse<Vendor>>('/api/vendors?limit=200').then((r) =>
      setVendors(r.data.map((v) => ({ value: v.id, label: `${v.code} — ${v.name_th}` })))
    );
    get<Warehouse[]>('/api/admin/warehouses').then((data) =>
      setWarehouses(data.map((w) => ({ value: w.id, label: `${w.code} — ${w.name_th}` })))
    );
  }, []);

  function setF(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSubmit() {
    if (!form.vendor_id) { setError('กรุณาเลือกผู้จำหน่าย'); return; }
    if (!form.warehouse_id) { setError('กรุณาเลือกคลังสินค้า'); return; }
    if (!form.claim_amount || parseFloat(form.claim_amount) < 0) { setError('กรุณาระบุมูลค่าการเรียกร้อง'); return; }
    if (!form.description.trim()) { setError('กรุณาระบุรายละเอียด'); return; }
    setError('');
    setSaving(true);
    try {
      const result = await post<{ id: string }>('/api/vendor-claims', {
        vendor_id: form.vendor_id,
        warehouse_id: form.warehouse_id,
        claim_amount: parseFloat(form.claim_amount),
        description: form.description,
        grn_id: form.grn_id || undefined,
        po_id: form.po_id || undefined,
        rma_id: form.rma_id || undefined,
      });
      router.push(`/app/claims/${result.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">สร้างการเรียกร้องผู้จำหน่าย</h1>
        <button className="text-sm text-gray-500 hover:underline" onClick={() => router.back()}>← ย้อนกลับ</button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="ผู้จำหน่าย *" value={form.vendor_id} onChange={(e) => setF('vendor_id', e.target.value)} options={vendors} placeholder="เลือกผู้จำหน่าย" />
          <Select label="คลังสินค้า *" value={form.warehouse_id} onChange={(e) => setF('warehouse_id', e.target.value)} options={warehouses} placeholder="เลือกคลังสินค้า" />
          <Input label="มูลค่าการเรียกร้อง (บาท) *" type="number" min="0" step="0.01" value={form.claim_amount} onChange={(e) => setF('claim_amount', e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด *</label>
          <textarea
            value={form.description}
            onChange={(e) => setF('description', e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="อธิบายสาเหตุและรายละเอียดการเรียกร้อง..."
          />
        </div>

        <div className="border-t pt-4">
          <p className="text-xs text-gray-400 mb-3">เชื่อมโยงเอกสาร (ไม่บังคับ)</p>
          <div className="grid grid-cols-3 gap-4">
            <Input label="เลข GRN ID" value={form.grn_id} onChange={(e) => setF('grn_id', e.target.value)} placeholder="UUID..." />
            <Input label="เลข PO ID" value={form.po_id} onChange={(e) => setF('po_id', e.target.value)} placeholder="UUID..." />
            <Input label="เลข RMA ID" value={form.rma_id} onChange={(e) => setF('rma_id', e.target.value)} placeholder="UUID..." />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={handleSubmit} loading={saving}>สร้างการเรียกร้อง</Button>
        </div>
      </div>
    </div>
  );
}
