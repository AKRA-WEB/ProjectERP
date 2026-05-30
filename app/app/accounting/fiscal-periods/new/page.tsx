'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { post } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Link from 'next/link';
import { useT } from '@/lib/i18n';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function NewFiscalPeriodPage() {
  const t = useT();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    name_th: '',
    name_en: '',
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
        <Link href="/app/accounting/fiscal-periods" className="text-stone-600 hover:text-stone-600">←</Link>
        <h1 className="text-2xl font-semibold text-stone-900">{t('page.new_period')}</h1>
      </div>

      <form onSubmit={handleSubmit} className={`${CARD} p-6 space-y-6`}>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('label.year')}
            type="number"
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
            required
          />
          <Select
            label={t('label.month')}
            value={formData.month}
            onChange={(e) => setFormData({ ...formData, month: Number(e.target.value) })}
            required
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </Select>
        </div>

        <div className="space-y-4">
          <Input
            label={`${t('label.display_name')} (TH)`}
            value={formData.name_th}
            onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
            placeholder="มกราคม 2569"
          />
          <Input
            label={`${t('label.display_name')} (EN)`}
            value={formData.name_en}
            onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
            placeholder="January 2026"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('label.start_date')}
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            required
          />
          <Input
            label={t('label.end_date')}
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Link href="/app/accounting/fiscal-periods">
            <Button type="button" variant="outline" disabled={submitting}>{t('action.cancel')}</Button>
          </Link>
          <Button type="submit" loading={submitting}>{t('action.create_period')}</Button>
        </div>
      </form>
    </div>
  );
}
