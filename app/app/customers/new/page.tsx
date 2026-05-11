'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { post } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';
import type { Customer } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function NewCustomerPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name_th: '',
    name_en: '',
    contact_name: '',
    email: '',
    phone: '',
    address_th: '',
    tax_id: '',
    payment_terms_days: '30',
    credit_limit: '0',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        payment_terms_days: parseInt(formData.payment_terms_days),
        credit_limit: parseFloat(formData.credit_limit),
      };
      const res = await post<Customer>('/api/customers', payload);
      router.push(`/app/customers/${res.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create customer');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/customers" className="text-stone-400 hover:text-stone-600">←</Link>
        <h1 className="text-2xl font-semibold text-stone-900">เพิ่มลูกค้าใหม่ / New Customer</h1>
      </div>

      <form onSubmit={handleSubmit} className={`${CARD} p-6 space-y-6`}>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="รหัสลูกค้า / Code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            required
            placeholder="CUST-001"
          />
          <Input
            label="เลขประจำตัวผู้เสียภาษี / Tax ID"
            value={formData.tax_id}
            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="ชื่อลูกค้า (TH) / Name (TH)"
            value={formData.name_th}
            onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
            required
          />
          <Input
            label="ชื่อลูกค้า (EN) / Name (EN)"
            value={formData.name_en}
            onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="ชื่อผู้ติดต่อ / Contact Name"
            value={formData.contact_name}
            onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="เบอร์โทร / Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="อีเมล / Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">ที่อยู่ / Address</label>
          <textarea
            className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            rows={3}
            value={formData.address_th}
            onChange={(e) => setFormData({ ...formData, address_th: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
          <Input
            label="เครดิตเทอม (วัน) / Payment Terms (Days)"
            type="number"
            min="0"
            value={formData.payment_terms_days}
            onChange={(e) => setFormData({ ...formData, payment_terms_days: e.target.value })}
            required
          />
          <Input
            label="วงเงินเครดิต / Credit Limit"
            type="number"
            min="0"
            step="1000"
            value={formData.credit_limit}
            onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Link href="/app/customers">
            <Button type="button" variant="outline" disabled={submitting}>ยกเลิก / Cancel</Button>
          </Link>
          <Button type="submit" loading={submitting}>บันทึก / Save</Button>
        </div>
      </form>
    </div>
  );
}
