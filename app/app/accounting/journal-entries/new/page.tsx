'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import { useLanguage, useT } from '@/lib/i18n';
import type { Account, FiscalPeriod, JournalEntry } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function NewJournalEntryPage() {
  const t = useT();
  const router = useRouter();
  const { lang } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  
  // Data
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [fiscalPeriodId, setFiscalPeriodId] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryType, setEntryType] = useState('manual');
  const [description, setDescription] = useState('');
  
  // Lines State
  const [lines, setLines] = useState<Array<{
    account_id: string;
    description: string;
    debit_amount: number;
    credit_amount: number;
  }>>([
    { account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
    { account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
  ]);

  useEffect(() => {
    Promise.all([
      get<FiscalPeriod[]>('/api/accounting/fiscal-periods'),
      get<Account[]>('/api/accounting/accounts?is_active=true'),
    ]).then(([ps, accs]) => {
      const openPeriods = ps.filter(p => p.status === 'open');
      setPeriods(openPeriods);
      if (openPeriods.length > 0) setFiscalPeriodId(openPeriods[0].id);
      setAccounts(accs.filter(a => a.allows_direct_posting));
    }).finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => {
    return lines.reduce((acc, l) => ({
      debit: acc.debit + l.debit_amount,
      credit: acc.credit + l.credit_amount,
    }), { debit: 0, credit: 0 });
  }, [lines]);

  const diff = Math.abs(totals.debit - totals.credit);
  const isBalanced = diff < 0.01 && totals.debit > 0;

  function addLine() {
    setLines([...lines, { account_id: '', description: '', debit_amount: 0, credit_amount: 0 }]);
  }

  function updateLine(index: number, field: string, value: string | number) {
    const newLines = [...lines];
    const val = typeof value === 'string' ? (field === 'account_id' || field === 'description' ? value : Number(value) || 0) : value;
    
    newLines[index] = { ...newLines[index], [field]: val as never };
    
    // If debit > 0, clear credit and vice versa
    if (field === 'debit_amount' && Number(value) > 0) newLines[index].credit_amount = 0;
    if (field === 'credit_amount' && Number(value) > 0) newLines[index].debit_amount = 0;
    
    setLines(newLines);
  }

  function removeLine(index: number) {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isBalanced) return alert(`Entry is not balanced. Difference: ${diff}`);
    if (lines.some(l => !l.account_id)) return alert('Please select account for all lines');

    setSubmitting(true);
    try {
      const res = await post<JournalEntry>('/api/accounting/journal-entries', {
        fiscal_period_id: fiscalPeriodId,
        entry_date: entryDate,
        entry_type: entryType,
        description,
        lines: lines.map(l => ({
          account_id: l.account_id,
          description: l.description || undefined,
          debit_amount: l.debit_amount,
          credit_amount: l.credit_amount,
        })),
      });
      router.push(`/app/accounting/journal-entries/${res.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create entry');
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-12 text-center"><LoadingSpinner /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <Link href="/app/accounting/journal-entries" className="text-stone-600 hover:text-stone-600">←</Link>
        <h1 className="text-2xl font-semibold text-stone-900">{t('page.new_journal_entry')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={`${CARD} p-6 space-y-6`}>
           <div className="grid grid-cols-3 gap-6">
              <Select label={t('label.fiscal_period')} value={fiscalPeriodId} onChange={e => setFiscalPeriodId(e.target.value)} required>
                {periods.map(p => <option key={p.id} value={p.id}>{lang === 'th' ? p.name_th : (p.name_en || p.name_th)}</option>)}
              </Select>
              <Input label={t('label.date')} type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} required />
              <Select label={t('label.type')} value={entryType} onChange={e => setEntryType(e.target.value)} required>
                <option value="manual">Manual Entry</option>
                <option value="opening_balance">Opening Balance</option>
              </Select>
           </div>
           <Input label={t('label.description')} value={description} onChange={e => setDescription(e.target.value)} required placeholder={t('placeholder.description_example')} />
        </div>

        <div className={CARD}>
          <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
            <h2 className="text-sm font-bold text-stone-600 uppercase tracking-widest">{t('label.ledger_lines')}</h2>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>{t('label.add_line')}</Button>
          </div>

          <div className="p-4">
            <table className="w-full text-sm">
              <thead className="text-stone-600 text-left uppercase text-[11px] font-bold">
                <tr>
                  <th className="p-2 w-1/3">{t('label.account')}</th>
                  <th className="p-2">{t('label.memo')}</th>
                  <th className="p-2 w-32 text-right">{t('label.debit')}</th>
                  <th className="p-2 w-32 text-right">{t('label.credit')}</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td className="p-2">
                      <select
                        className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm outline-none focus:border-emerald-500"
                        value={line.account_id}
                        onChange={e => updateLine(i, 'account_id', e.target.value)}
                        required
                      >
                        <option value="">{t('placeholder.select_account')}</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.account_code} - {lang === 'th' ? a.name_th : (a.name_en || a.name_th)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                       <input 
                         type="text" 
                         className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm outline-none focus:border-emerald-500" 
                         value={line.description} 
                         onChange={e => updateLine(i, 'description', e.target.value)} 
                         placeholder={t('placeholder.memo_optional')}
                       />
                    </td>
                    <td className="p-2">
                       <input 
                         type="number" 
                         step="0.01" 
                         min="0"
                         className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm text-right font-mono" 
                         value={line.debit_amount || ''} 
                         onChange={e => updateLine(i, 'debit_amount', e.target.value)} 
                       />
                    </td>
                    <td className="p-2">
                       <input 
                         type="number" 
                         step="0.01" 
                         min="0"
                         className="w-full px-2 py-1.5 border border-stone-200 rounded text-sm text-right font-mono" 
                         value={line.credit_amount || ''} 
                         onChange={e => updateLine(i, 'credit_amount', e.target.value)} 
                       />
                    </td>
                    <td className="p-2 text-center text-stone-300 hover:text-red-500 cursor-pointer" onClick={() => removeLine(i)}>✕</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-stone-50/50 font-bold border-t-2 border-stone-100">
                <tr>
                  <td colSpan={2} className="p-4 text-right">{t('label.total')}:</td>
                  <td className="p-4 text-right font-mono">{formatCurrency(totals.debit, lang)}</td>
                  <td className="p-4 text-right font-mono">{formatCurrency(totals.credit, lang)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-stone-900 text-white rounded-xl shadow-xl fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-4xl z-50">
          <div className="flex items-center gap-6 px-4">
             <div className="flex flex-col">
                <span className="text-[10px] uppercase text-stone-600 font-bold">{t('label.balance_diff')}</span>
                <span className={`text-lg font-mono font-bold ${diff < 0.01 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(diff, lang)}
                </span>
             </div>
             <div className="h-8 w-px bg-stone-700" />
             {isBalanced ? (
               <span className="text-emerald-400 font-bold flex items-center gap-2">✓ {t('status.balanced')}</span>
             ) : (
               <span className="text-red-400 font-bold">✗ {t('status.unbalanced')}</span>
             )}
          </div>
          <div className="flex gap-3">
             <Link href="/app/accounting/journal-entries">
                <Button type="button" variant="outline" className="border-stone-700 text-white hover:bg-stone-800">{t('action.cancel')}</Button>
             </Link>
             <Button type="submit" loading={submitting} disabled={!isBalanced} className="px-12 bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-emerald-900/20">
                {t('action.post_entry')}
             </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
