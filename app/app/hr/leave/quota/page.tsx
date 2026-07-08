'use client';

import { useState, useEffect, useCallback } from 'react';
import { get, post } from '@/lib/api-client';
import { useT, useLanguage } from '@/lib/i18n';
import { useSession } from 'next-auth/react';
import type { SessionUser, LeaveBalanceAdjustment } from '@/types';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { Plus } from 'lucide-react';

interface LeaveBalanceRow {
  leave_balance_id: string;
  employee_id: string;
  employee_name_th: string;
  leave_type_id: string;
  leave_type_name_th: string;
  year: number;
  days_entitled: number;
  days_used: number;
  days_remaining: number;
}

export default function LeaveQuotaPage() {
  const t = useT();
  const { lang } = useLanguage();
  const { data: session } = useSession();
  const u = session?.user as unknown as SessionUser | undefined;

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<LeaveBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [history, setHistory] = useState<LeaveBalanceAdjustment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjForm, setAdjForm] = useState({
    employee_id: '',
    leave_type_id: '',
    adjustment_kind: 'entitlement' as 'entitlement' | 'used_correction',
    delta_days: 0,
    reason: '',
  });
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjError, setAdjError] = useState('');

  const canEdit = u && ['admin', 'manager'].includes(u.role);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (search) params.set('search', search);
      const data = await get<LeaveBalanceRow[]>(`/api/hr/leave-balances/summary?${params}`);
      setRows(data);
    } catch (e) {
      console.error(e);
      setError('Failed to load leave balances');
    } finally {
      setLoading(false);
    }
  }, [year, search]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const fetchHistory = useCallback(async (employeeId: string) => {
    setHistoryLoading(true);
    try {
      const data = await get<LeaveBalanceAdjustment[]>(`/api/hr/leave-balances/adjustments?employee_id=${employeeId}&year=${year}`);
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  }, [year]);

  function selectEmployee(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    fetchHistory(employeeId);
    const row = rows.find(r => r.employee_id === employeeId);
    if (row) {
      setAdjForm(f => ({ ...f, employee_id: employeeId, leave_type_id: row.leave_type_id }));
    }
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    setAdjSaving(true);
    setAdjError('');
    try {
      await post('/api/hr/leave-balances/adjustments', { ...adjForm, year });
      setShowAdjForm(false);
      await fetchBalances();
      if (selectedEmployeeId) await fetchHistory(selectedEmployeeId);
    } catch (e2: unknown) {
      setAdjError(e2 instanceof Error ? e2.message : 'Error saving');
    } finally {
      setAdjSaving(false);
    }
  }

  return (
    <DirectionalTransition>
      <div className="max-w-[1200px] mx-auto px-4 py-8 pb-24">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold text-stone-900">{t('hr.leave_quota.title')}</h1>
          {canEdit && (
            <button onClick={() => setShowAdjForm(v => !v)}
              className="h-10 px-5 rounded-xl bg-stone-900 text-white text-[13px] font-semibold flex items-center gap-2 shadow-sm">
              <Plus size={15} />
              {t('hr.leave_quota.add_adjustment')}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <label className="flex items-center gap-2 text-[13px] font-medium text-stone-600">
            {t('hr.leave_quota.year')}
            <select className="bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-[13px]"
              value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <option key={y} value={y}>{y + (lang === 'th' ? 543 : 0)}</option>
              ))}
            </select>
          </label>
          <input type="search" placeholder={t('hr.leave_quota.search_placeholder')}
            className="bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-[13px] w-64"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Adjustment form */}
        {showAdjForm && (
          <form onSubmit={handleAdjust}
            className="mb-6 p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
            <h3 className="text-[14px] font-bold text-stone-900">{t('hr.leave_quota.modal.title')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-[12px] font-bold text-stone-500">
                {t('hr.leave_quota.col.employee')}
                <select required className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                  value={adjForm.employee_id}
                  onChange={e => {
                    const eid = e.target.value;
                    setAdjForm(f => ({ ...f, employee_id: eid }));
                    if (eid) selectEmployee(eid);
                  }}>
                  <option value="">—</option>
                  {[...new Map(rows.map(r => [r.employee_id, r])).values()].map(r => (
                    <option key={r.employee_id} value={r.employee_id}>{r.employee_name_th}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-bold text-stone-500">
                {t('hr.leave_quota.col.leave_type')}
                <select required className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                  value={adjForm.leave_type_id}
                  onChange={e => setAdjForm(f => ({ ...f, leave_type_id: e.target.value }))}>
                  <option value="">—</option>
                  {rows.filter(r => !adjForm.employee_id || r.employee_id === adjForm.employee_id)
                    .map(r => (
                      <option key={r.leave_type_id} value={r.leave_type_id}>{r.leave_type_name_th}</option>
                    ))}
                </select>
              </label>
              <label className="block text-[12px] font-bold text-stone-500">
                {t('hr.employee360.leave.adjustment_kind')}
                <select className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                  value={adjForm.adjustment_kind}
                  onChange={e => setAdjForm(f => ({ ...f, adjustment_kind: e.target.value as 'entitlement' | 'used_correction' }))}>
                  <option value="entitlement">{t('hr.employee360.leave.kind.entitlement')}</option>
                  <option value="used_correction">{t('hr.employee360.leave.kind.used_correction')}</option>
                </select>
              </label>
              <label className="block text-[12px] font-bold text-stone-500">
                {t('hr.employee360.leave.delta_days')}
                <input type="number" step="0.5" required className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                  value={adjForm.delta_days}
                  onChange={e => setAdjForm(f => ({ ...f, delta_days: parseFloat(e.target.value) }))} />
              </label>
              <label className="block text-[12px] font-bold text-stone-500 sm:col-span-2">
                {t('hr.employee360.leave.reason')}
                <textarea required rows={2} className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                  value={adjForm.reason}
                  onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))} />
              </label>
            </div>
            {adjError && <p className="text-red-600 text-[12px]">{adjError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAdjForm(false)}
                className="px-3 py-1.5 text-[13px] text-stone-500 hover:text-stone-700">{t('hr.employee360.cancel')}</button>
              <button type="submit" disabled={adjSaving}
                className="px-4 py-1.5 bg-stone-900 text-white rounded-lg text-[13px] font-semibold disabled:opacity-50">
                {t('hr.employee360.leave.submit')}
              </button>
            </div>
          </form>
        )}

        {/* Table */}
        {error && <p className="text-red-600 text-[13px] mb-4">{error}</p>}
        {loading ? (
          <div className="py-16 flex justify-center"><div className="animate-spin h-6 w-6 border-b-2 border-stone-900 rounded-full" /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-stone-400 text-[14px]">{t('hr.leave_quota.no_data')}</div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100">
                    <th className="py-3 px-4">{t('hr.leave_quota.col.employee')}</th>
                    <th className="py-3 px-4">{t('hr.leave_quota.col.leave_type')}</th>
                    <th className="py-3 px-4 text-center">{t('hr.leave_quota.col.entitled')}</th>
                    <th className="py-3 px-4 text-center">{t('hr.leave_quota.col.used')}</th>
                    <th className="py-3 px-4 text-center">{t('hr.leave_quota.col.remaining')}</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {rows.map(row => (
                    <tr key={row.leave_balance_id}
                      className={`text-[13.5px] hover:bg-stone-50 transition-colors cursor-pointer ${selectedEmployeeId === row.employee_id ? 'bg-stone-50' : ''}`}
                      onClick={() => selectEmployee(row.employee_id)}>
                      <td className="py-3 px-4 font-medium text-stone-900">{row.employee_name_th}</td>
                      <td className="py-3 px-4 text-stone-600">{row.leave_type_name_th}</td>
                      <td className="py-3 px-4 text-center">{row.days_entitled}</td>
                      <td className="py-3 px-4 text-center">{row.days_used}</td>
                      <td className="py-3 px-4 text-center font-bold text-stone-900">{row.days_remaining}</td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/app/hr/employees/${row.employee_id}?tab=leave`}
                          onClick={e => e.stopPropagation()}
                          className="text-[12px] text-stone-400 hover:text-stone-700 underline">
                          360
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Adjustment history panel */}
        {selectedEmployeeId && (
          <div className="mt-8 bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-[13px] font-bold text-stone-400 uppercase tracking-wider mb-4">{t('hr.leave_quota.history_title')}</h3>
            {historyLoading ? (
              <div className="py-6 flex justify-center"><div className="animate-spin h-5 w-5 border-b-2 border-stone-900 rounded-full" /></div>
            ) : history.length === 0 ? (
              <p className="text-stone-400 text-[13px] text-center py-4">{t('hr.employee360.leave.no_history')}</p>
            ) : (
              <div className="space-y-2">
                {history.map(adj => (
                  <div key={adj.id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                    <div>
                      <div className="text-[13px] font-medium text-stone-900">
                        {adj.leave_type_name_th} &mdash; {adj.adjustment_kind === 'entitlement' ? t('hr.employee360.leave.kind.entitlement') : t('hr.employee360.leave.kind.used_correction')}
                        <span className={`ml-2 font-bold ${adj.delta_days > 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {adj.delta_days > 0 ? '+' : ''}{adj.delta_days}
                        </span>
                      </div>
                      <div className="text-[12px] text-stone-400">{adj.reason}</div>
                    </div>
                    <div className="text-[12px] text-stone-400 shrink-0">{formatDate(adj.created_at, lang)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DirectionalTransition>
  );
}
