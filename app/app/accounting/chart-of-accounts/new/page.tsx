'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Link from 'next/link';
import type { Account } from '@/types';
import { useT, useLanguage } from '@/lib/i18n';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function NewAccountPage() {
  const t = useT();
  const { lang } = useLanguage();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [groupAccounts, setGroupAccounts] = useState<Account[]>([]);
  
  const [formData, setFormData] = useState({
    account_code: '',
    name_th: '',
    name_en: '',
    account_type: 'asset',
    normal_balance: 'debit',
    parent_id: '',
    allows_direct_posting: true,
    description: '',
  });

  useEffect(() => {
    get<Account[]>('/api/accounting/accounts')
      .then(res => setGroupAccounts(res.filter(a => !a.allows_direct_posting)))
      .catch(console.error);
  }, []);

  useEffect(() => {
    // Auto-suggest normal balance based on type
    const type = formData.account_type;
    let normal: 'debit' | 'credit' = 'debit';
    if (type === 'liability' || type === 'equity' || type === 'revenue') {
      normal = 'credit';
    }
    setFormData(prev => ({ ...prev, normal_balance: normal }));
  }, [formData.account_type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await post('/api/accounting/accounts', {
        ...formData,
        parent_id: formData.parent_id || null,
      });
      router.push('/app/accounting/chart-of-accounts');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create account');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/accounting/chart-of-accounts" className="text-stone-600 hover:text-stone-600">←</Link>
        <h1 className="text-2xl font-semibold text-stone-900">{t('page.new_account')}</h1>
      </div>

      <form onSubmit={handleSubmit} className={`${CARD} p-6 space-y-6`}>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('label.account_code')}
            value={formData.account_code}
            onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
            required
            placeholder="e.g. 1100"
          />
          <Select
            label={t('label.type')}
            value={formData.account_type}
            onChange={(e) => setFormData({ ...formData, account_type: e.target.value as Account['account_type'] })}
            required
          >
            <option value="asset">{t('label.asset')}</option>
            <option value="liability">{t('label.liability')}</option>
            <option value="equity">{t('label.equity')}</option>
            <option value="revenue">{t('label.revenue')}</option>
            <option value="expense">{t('label.expense')}</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={`${t('label.account_name')} (TH)`}
            value={formData.name_th}
            onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
            required
          />
          <Input
            label={`${t('label.account_name')} (EN)`}
            value={formData.name_en}
            onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t('label.normal_balance')}
            value={formData.normal_balance}
            onChange={(e) => setFormData({ ...formData, normal_balance: e.target.value as Account['normal_balance'] })}
            required
          >
            <option value="debit">{t('label.debit')}</option>
            <option value="credit">{t('label.credit')}</option>
          </Select>
          <Select
            label={t('label.parent_account')}
            value={formData.parent_id}
            onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
          >
            <option value="">{t('label.no_parent')}</option>
            {groupAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.account_code} - {lang === 'th' ? a.name_th : (a.name_en || a.name_th)}</option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="direct_posting"
            className="w-4 h-4 text-emerald-600 border-stone-300 rounded focus:ring-emerald-500"
            checked={formData.allows_direct_posting}
            onChange={(e) => setFormData({ ...formData, allows_direct_posting: e.target.checked })}
          />
          <label htmlFor="direct_posting" className="text-sm font-medium text-stone-700 cursor-pointer">
            {t('label.allows_direct')}
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t('label.description')}</label>
          <textarea
            className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Link href="/app/accounting/chart-of-accounts">
            <Button type="button" variant="outline" disabled={submitting}>{t('action.cancel')}</Button>
          </Link>
          <Button type="submit" loading={submitting}>{t('action.save')}</Button>
        </div>
      </form>
    </div>
  );
}
