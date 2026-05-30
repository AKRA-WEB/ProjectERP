'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, patch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import type { JournalEntry, JournalEntryLine } from '@/types';
import { useT, useLanguage } from '@/lib/i18n';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function JournalEntryDetailPage() {
  const t = useT();
  const { lang } = useLanguage();
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [je, setJe] = useState<(JournalEntry & { lines: JournalEntryLine[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState('');
  
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const fetchJE = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<JournalEntry & { lines: JournalEntryLine[] }>(`/api/accounting/journal-entries/${id}`);
      setJe(res);
    } catch (error) {
      console.error('Failed to fetch JE:', error);
      router.push('/app/accounting/journal-entries');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchJE();
  }, [fetchJE]);

  async function handleAction(action: 'post' | 'void' | 'unpost') {
    if (action !== 'void' && !confirm(`Are you sure you want to ${action} this entry?`)) return;
    setActioning(action);
    try {
      const payload: { action: string, void_reason?: string } = { action };
      if (action === 'void') payload.void_reason = voidReason;

      const res = await patch<JournalEntry>(`/api/accounting/journal-entries/${id}`, payload);
      setJe(prev => prev ? { ...prev, ...res } : null);
      if (action === 'void') setVoidModalOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : `Failed to ${action}`);
    } finally {
      setActioning('');
    }
  }

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;
  if (!je) return <div className="text-center py-24">Journal Entry not found</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/accounting/journal-entries" className="text-stone-600 hover:text-stone-600">←</Link>
          <div>
            <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-3">
              {je.entry_number}
              <StatusBadge status={je.status} />
            </h1>
            <p className="text-stone-500 text-sm">{t('label.entry_type')}: {je.entry_type} | {t('label.fiscal_period')}: {je.period_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {je.status === 'draft' && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAction('post')} loading={actioning === 'post'}>
              {t('action.post_entry')}
            </Button>
          )}
          {je.status === 'posted' && (
            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setVoidModalOpen(true)}>
              {t('action.void_entry')}
            </Button>
          )}
        </div>
      </div>

      <div className={`${CARD} p-6 space-y-4`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
             <div>
                <p className="text-stone-600 uppercase font-bold tracking-widest text-[10px] mb-1">{t('label.entry_date')}</p>
                <p className="font-medium">{new Date(je.entry_date).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}</p>
             </div>
             <div>
                <p className="text-stone-600 uppercase font-bold tracking-widest text-[10px] mb-1">{t('label.created_by')}</p>
                <p className="font-medium">{je.created_by_name}</p>
             </div>
             {je.posted_at && (
               <div>
                  <p className="text-stone-600 uppercase font-bold tracking-widest text-[10px] mb-1">{t('label.posted_at')}</p>
                  <p className="font-medium">{new Date(je.posted_at).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}</p>
               </div>
             )}
             <div>
                <p className="text-stone-600 uppercase font-bold tracking-widest text-[10px] mb-1">{t('label.reference')}</p>
                <p className="font-medium">{je.reference_type ? `${je.reference_type} (${je.reference_id})` : '-'}</p>
             </div>
          </div>
          <div className="pt-4 border-t border-stone-100">
             <p className="text-stone-600 uppercase font-bold tracking-widest text-[10px] mb-1">{t('label.description')}</p>
             <p className="text-stone-900">{je.description}</p>
          </div>
          {je.status === 'void' && (
             <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                <strong>{t('label.void_reason')}:</strong> {je.void_reason}
             </div>
          )}
      </div>

      <div className={CARD}>
        <div className="p-4 border-b border-stone-100 bg-stone-50/50">
          <h3 className="font-semibold text-stone-900">{t('label.ledger_lines')}</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="text-stone-600 uppercase text-[11px] font-bold border-b border-stone-100">
            <tr>
              <th className="px-6 py-3 text-left">{t('label.account')}</th>
              <th className="px-6 py-3 text-left">{t('label.memo')}</th>
              <th className="px-6 py-3 text-right">{t('label.debit')}</th>
              <th className="px-6 py-3 text-right">{t('label.credit')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {je.lines?.map((line) => (
              <tr key={line.id} className="hover:bg-stone-50/50">
                <td className="px-6 py-4">
                  <div className="font-bold text-stone-900">{line.account_code}</div>
                  <div className="text-xs text-stone-500">{lang === 'th' ? line.account_name_th : (line.account_name_en || line.account_name_th)}</div>
                </td>
                <td className="px-6 py-4 text-stone-600">{line.description || '-'}</td>
                <td className="px-6 py-4 text-right font-mono font-bold text-stone-900">
                  {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                </td>
                <td className="px-6 py-4 text-right font-mono font-bold text-stone-900">
                  {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-stone-50/50 font-bold border-t border-stone-200">
            <tr>
              <td colSpan={2} className="px-6 py-4 text-right uppercase text-[11px] tracking-widest text-stone-600">Total</td>
              <td className="px-6 py-4 text-right font-mono text-lg">{formatCurrency(je.total_debit)}</td>
              <td className="px-6 py-4 text-right font-mono text-lg">{formatCurrency(je.total_credit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Modal isOpen={voidModalOpen} onClose={() => setVoidModalOpen(false)} title={t('page.void_journal_entry')}>
        <div className="space-y-4 pt-2">
          <Input
            label={t('label.void_reason_input')}
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVoidModalOpen(false)} disabled={actioning === 'void'}>{t('action.close')}</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white border-none" onClick={() => handleAction('void')} loading={actioning === 'void'}>{t('action.confirm_void')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
