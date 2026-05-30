'use client';

import { useState, useEffect } from 'react';
import { get, patch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';
import type { Account } from '@/types';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { useT, useLanguage } from '@/lib/i18n';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function ChartOfAccountsPage() {
  const t = useT();
  const { lang } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setLoading(true);
    try {
      const res = await get<Account[]>('/api/accounting/accounts');
      setAccounts(res);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      await patch(`/api/accounting/accounts/${id}`, { is_active: !current });
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a));
    } catch {
      alert('Failed to update status');
    }
  }

  const filtered = accounts.filter(a => {
    const matchesSearch = !search || 
      a.account_code.toLowerCase().includes(search.toLowerCase()) || 
      a.name_th.toLowerCase().includes(search.toLowerCase()) || 
      a.name_en.toLowerCase().includes(search.toLowerCase());
    const matchesType = !typeFilter || a.account_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">{t('page.coa')}</h1>
            <p className="text-stone-500 text-sm">{t('page.coa_desc')}</p>
          </div>
          <Link href="/app/accounting/chart-of-accounts/new" transitionTypes={['nav-forward']}>
            <Button>{t('action.add_account')}</Button>
          </Link>
        </div>

        <div className={`${CARD} p-4 flex gap-4 items-end`}>
          <div className="w-80">
            <Input
              label={t('action.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('placeholder.account_code_or_name')}
            />
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-stone-700 mb-1">{t('label.type')}</label>
            <select
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">{t('label.all')}</option>
              <option value="asset">{t('label.asset')}</option>
              <option value="liability">{t('label.liability')}</option>
              <option value="equity">{t('label.equity')}</option>
              <option value="revenue">{t('label.revenue')}</option>
              <option value="expense">{t('label.expense')}</option>
            </select>
          </div>
        </div>

        <div className={CARD}>
          <Table
            loading={loading}
            headers={[
              t('label.code'),
              t('label.account_name'),
              t('label.type'),
              t('label.normal_balance'),
              t('label.allows_direct'),
              t('label.status'),
              '',
            ]}
          >
            {filtered.map((a) => (
              <tr key={a.id} className={`hover:bg-stone-50 transition-colors ${!a.is_active ? 'opacity-60' : ''}`}>
                <td className="px-5 py-4 font-mono font-bold text-stone-900">{a.account_code}</td>
                <td className="px-5 py-4">
                  <div className={`font-medium ${!a.allows_direct_posting ? 'text-stone-900 font-bold underline decoration-stone-200' : 'text-stone-700'}`}>
                    {a.name_th}
                  </div>
                  <div className="text-xs text-stone-600 font-mono">{a.name_en}</div>
                </td>
                <td className="px-5 py-4 uppercase text-xs font-bold tracking-wider">
                  <Badge variant={
                    a.account_type === 'asset' ? 'emerald' : 
                    a.account_type === 'liability' ? 'blue' :
                    a.account_type === 'equity' ? 'amber' :
                    a.account_type === 'revenue' ? 'emerald' : 'stone'
                  }>
                    {a.account_type}
                  </Badge>
                </td>
                <td className="px-5 py-4 text-xs uppercase font-medium">{a.normal_balance}</td>
                <td className="px-5 py-4 text-center">
                  {a.allows_direct_posting ? '✓' : <span className="text-stone-300">—</span>}
                </td>
                <td className="px-5 py-4">
                  <button 
                    onClick={() => toggleActive(a.id, a.is_active)}
                    className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase ${a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}
                  >
                    {a.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-5 py-4 text-right">
                   <Link href={`/app/accounting/chart-of-accounts/${a.id}`} transitionTypes={['nav-forward']}>
                      <Button variant="outline" size="sm">{t('action.edit')}</Button>
                   </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-stone-600 italic">{t('msg.no_records')}</td></tr>
            )}
          </Table>
        </div>
      </div>
    </DirectionalTransition>
  );
}
