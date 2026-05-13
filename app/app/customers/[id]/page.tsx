'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, patch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Link from 'next/link';
import type { Customer } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function CustomerDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({});

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<Customer>(`/api/customers/${id}`);
      setCustomer(res);
      setFormData(res);
    } catch (error) {
      console.error('Failed to fetch customer:', error);
      router.push('/app/customers');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await patch<Customer>(`/api/customers/${id}`, {
        name_th: formData.name_th,
        name_en: formData.name_en,
        contact_name: formData.contact_name,
        email: formData.email,
        phone: formData.phone,
        address_th: formData.address_th,
        tax_id: formData.tax_id,
        payment_terms_days: Number(formData.payment_terms_days),
        credit_limit: Number(formData.credit_limit),
        is_active: formData.is_active === true || (formData.is_active as unknown) === 'true',
      });
      setCustomer(res);
      alert('บันทึกสำเร็จ / Saved successfully');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;
  if (!customer) return <div className="text-center py-24">Customer not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/customers" className="text-stone-400 hover:text-stone-600">←</Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{customer.name_th}</h1>
          <p className="text-stone-500 font-mono text-sm">{customer.code}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className={`${CARD} p-6 space-y-6`}>
        <div className="flex justify-between items-center pb-4 border-b border-stone-100">
          <h2 className="text-lg font-medium">ข้อมูลลูกค้า / Details</h2>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${customer.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-800'}`}>
            {customer.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="เลขประจำตัวผู้เสียภาษี / Tax ID"
            value={formData.tax_id || ''}
            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
          />
          <Select
            label="สถานะ / Status"
            value={String(formData.is_active)}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
          >
            <option value="true">ใช้งาน / Active</option>
            <option value="false">ยกเลิก / Inactive</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="ชื่อลูกค้า (TH) / Name (TH)"
            value={formData.name_th || ''}
            onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
            required
          />
          <Input
            label="ชื่อลูกค้า (EN) / Name (EN)"
            value={formData.name_en || ''}
            onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="ชื่อผู้ติดต่อ / Contact Name"
            value={formData.contact_name || ''}
            onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="เบอร์โทร / Phone"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="อีเมล / Email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">ที่อยู่ / Address</label>
          <textarea
            className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            rows={3}
            value={formData.address_th || ''}
            onChange={(e) => setFormData({ ...formData, address_th: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
          <Input
            label="เครดิตเทอม (วัน) / Payment Terms (Days)"
            type="number"
            min="0"
            value={String(formData.payment_terms_days)}
            onChange={(e) => setFormData({ ...formData, payment_terms_days: Number(e.target.value) })}
            required
          />
          <Input
            label="วงเงินเครดิต / Credit Limit"
            type="number"
            min="0"
            step="1000"
            value={String(formData.credit_limit)}
            onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" loading={saving}>บันทึกการเปลี่ยนแปลง / Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
