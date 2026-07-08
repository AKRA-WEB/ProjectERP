'use client';

import { useState, useEffect, useCallback } from 'react';
import { get, patch, post } from '@/lib/api-client';
import { useT, useLanguage } from '@/lib/i18n';
import { useSession } from 'next-auth/react';
import type { SessionUser, AttendanceAdjustmentRequest } from '@/types';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { CheckCircle, XCircle, Plus } from 'lucide-react';

export default function AttendanceAdjustmentsPage() {
  const t = useT();
  const { lang } = useLanguage();
  const { data: session } = useSession();
  const u = session?.user as unknown as SessionUser | undefined;

  const [statusFilter, setStatusFilter] = useState('');
  const [rows, setRows] = useState<AttendanceAdjustmentRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ work_date: '', requested_status: '', reason: '' });
  const [formSaving, setFormSaving] = useState(false);

  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  const canReview = u && ['admin', 'manager'].includes(u.role);
  const isStaff = u?.role === 'staff';

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (statusFilter) params.set('status', statusFilter);
      const data = await get<AttendanceAdjustmentRequest[]>(`/api/hr/attendance-adjustments?${params}`);
      setRows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    setFormSaving(true);
    try {
      await post('/api/hr/attendance-adjustments', { ...form, requested_status: form.requested_status || null });
      setShowForm(false);
      setForm({ work_date: '', requested_status: '', reason: '' });
      await fetch();
    } catch (err) { console.error(err); }
    finally { setFormSaving(false); }
  }

  async function handleReview(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewId) return;
    setReviewSaving(true);
    try {
      await patch(`/api/hr/attendance-adjustments/${reviewId}`, {
        action: reviewAction,
        review_note: reviewNote || null,
      });
      setReviewId(null);
      setReviewNote('');
      await fetch();
    } catch (err) { console.error(err); }
    finally { setReviewSaving(false); }
  }

  const statusBadge = (s: AttendanceAdjustmentRequest['status']) => {
    const cls: Record<string, string> = {
      submitted: 'bg-amber-50 text-amber-700 border-amber-100',
      approved: 'bg-green-50 text-green-700 border-green-100',
      rejected: 'bg-red-50 text-red-700 border-red-100',
      cancelled: 'bg-stone-50 text-stone-500 border-stone-200',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${cls[s] ?? ''}`}>{s}</span>
    );
  };

  return (
    <DirectionalTransition>
      <div className="max-w-[1100px] mx-auto px-4 py-8 pb-24">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-stone-900">{t('hr.att_adj.title')}</h1>
          {isStaff && (
            <button onClick={() => setShowForm(v => !v)}
              className="h-10 px-5 rounded-xl bg-stone-900 text-white text-[13px] font-semibold flex items-center gap-2">
              <Plus size={15} />
              {t('hr.att_adj.submit_request')}
            </button>
          )}
        </div>

        {/* Submit form (staff) */}
        {showForm && isStaff && (
          <form onSubmit={handleSubmitRequest}
            className="mb-6 p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-[12px] font-bold text-stone-500">
                {t('hr.att_adj.work_date')}
                <input type="date" required className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                  value={form.work_date} onChange={e => setForm(f => ({ ...f, work_date: e.target.value }))} />
              </label>
              <label className="block text-[12px] font-bold text-stone-500">
                {t('hr.att_adj.requested_status')}
                <select className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                  value={form.requested_status} onChange={e => setForm(f => ({ ...f, requested_status: e.target.value }))}>
                  <option value="">—</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half Day</option>
                  <option value="absent">Absent</option>
                </select>
              </label>
              <label className="block text-[12px] font-bold text-stone-500 sm:col-span-2">
                {t('hr.att_adj.reason')}
                <textarea required rows={2} className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                  value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-[13px] text-stone-500">{t('hr.employee360.cancel')}</button>
              <button type="submit" disabled={formSaving}
                className="px-4 py-1.5 bg-stone-900 text-white rounded-lg text-[13px] font-semibold disabled:opacity-50">
                {t('hr.att_adj.submit_request')}
              </button>
            </div>
          </form>
        )}

        {/* Review modal */}
        {reviewId && (
          <form onSubmit={handleReview}
            className="mb-6 p-5 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
            <h3 className="text-[14px] font-bold text-stone-900">
              {reviewAction === 'approve' ? t('hr.att_adj.approve') : t('hr.att_adj.reject')}
            </h3>
            <label className="block text-[12px] font-bold text-stone-600">
              {t('hr.att_adj.review_note')}
              <textarea rows={2} className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                required={reviewAction === 'reject'} />
            </label>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setReviewId(null)}
                className="px-3 py-1.5 text-[13px] text-stone-500">{t('hr.employee360.cancel')}</button>
              <button type="submit" disabled={reviewSaving}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold disabled:opacity-50 text-white
                  ${reviewAction === 'approve' ? 'bg-green-700' : 'bg-red-700'}`}>
                {reviewAction === 'approve' ? t('hr.att_adj.approve') : t('hr.att_adj.reject')}
              </button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          {(['', 'submitted', 'approved', 'rejected'] as const).map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors
                ${statusFilter === s ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'}`}>
              {s === '' ? t('hr.att_adj.filter.all')
                : s === 'submitted' ? t('hr.att_adj.filter.submitted')
                : s === 'approved' ? t('hr.att_adj.filter.approved')
                : t('hr.att_adj.filter.rejected')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><div className="animate-spin h-6 w-6 border-b-2 border-stone-900 rounded-full" /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-stone-400 text-[14px]">{t('hr.att_adj.no_data')}</div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100">
                    <th className="py-3 px-4">{t('hr.att_adj.col.request_no')}</th>
                    <th className="py-3 px-4">{t('hr.att_adj.col.employee')}</th>
                    <th className="py-3 px-4">{t('hr.att_adj.col.work_date')}</th>
                    <th className="py-3 px-4">{t('hr.att_adj.col.requested_status')}</th>
                    <th className="py-3 px-4">{t('hr.att_adj.col.reason')}</th>
                    <th className="py-3 px-4">{t('hr.att_adj.col.status')}</th>
                    {canReview && <th className="py-3 px-4"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {rows.map(row => (
                    <tr key={row.id} className="text-[13.5px] hover:bg-stone-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-[12px] text-stone-500">{row.request_number}</td>
                      <td className="py-3 px-4 font-medium text-stone-900">
                        <Link href={`/app/hr/employees/${row.employee_id}`}
                          className="hover:underline">{row.employee_name_th ?? row.employee_id}</Link>
                      </td>
                      <td className="py-3 px-4 text-stone-600">{formatDate(row.work_date, lang)}</td>
                      <td className="py-3 px-4 text-stone-600">{row.requested_status ?? '—'}</td>
                      <td className="py-3 px-4 text-stone-500 max-w-[200px] truncate">{row.reason}</td>
                      <td className="py-3 px-4">{statusBadge(row.status)}</td>
                      {canReview && (
                        <td className="py-3 px-4">
                          {row.status === 'submitted' && (
                            <div className="flex gap-1">
                              <button onClick={() => { setReviewId(row.id); setReviewAction('approve'); setReviewNote(''); }}
                                className="h-7 px-2 rounded-lg bg-green-50 text-green-700 border border-green-100 text-[11px] font-semibold flex items-center gap-1">
                                <CheckCircle size={11} />
                                {t('hr.att_adj.approve')}
                              </button>
                              <button onClick={() => { setReviewId(row.id); setReviewAction('reject'); setReviewNote(''); }}
                                className="h-7 px-2 rounded-lg bg-red-50 text-red-700 border border-red-100 text-[11px] font-semibold flex items-center gap-1">
                                <XCircle size={11} />
                                {t('hr.att_adj.reject')}
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DirectionalTransition>
  );
}
