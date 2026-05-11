'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { post } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Link from 'next/link';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function NewFiscalPeriodPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    name: '',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    // Auto-compute dates based on month/year
    const firstDay = new Date(formData.year, formData.month - 1, 1);
    const lastDay = new Date(formData.year, formData.month, 0);
    
    setFormData(prev => ({
      ...prev,
      start_date: firstDay.toISOString().split('T')[0],
      end_date: lastDay.toISOString().split('T')[0],
    }));
  }, [formData.year, formData.month]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await post('/api/accounting/fiscal-periods', formData);
      router.push('/app/accounting/fiscal-periods');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create period');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/accounting/fiscal-periods" className="text-stone-400 hover:text-stone-600">←</Link>
        <h1 className="text-2xl font-semibold text-stone-900">สร้างรอบบัญชีใหม่ / New Period</h1>
      </div>

      <form onSubmit={handleSubmit} className={`${CARD} p-6 space-y-6`}>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="ปี / Year (AD)"
            type="number"
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
            required
          />
          <Select
            label="เดือน / Month"
            value={formData.month}
            onChange={(e) => setFormData({ ...formData, month: Number(e.target.value) })}
            required
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </Select>
        </div>

        <Input
          label="ชื่อรอบ / Display Name (Optional)"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="เว้นว่างเพื่อใช้ชื่อมาตรฐาน เช่น มกราคม 2026"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="วันที่เริ่มต้น / Start Date"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            required
          />
          <Input
            label="วันที่สิ้นสุด / End Date"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Link href="/app/accounting/fiscal-periods">
            <Button type="button" variant="outline" disabled={submitting}>ยกเลิก / Cancel</Button>
          </Link>
          <Button type="submit" loading={submitting}>ยืนยันการสร้าง / Create</Button>
        </div>
      </form>
    </div>
  );
}
