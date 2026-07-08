'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { get, post, patch, del } from '@/lib/api-client';
import type {
  Department,
  Position,
  SessionUser,
  AttendanceRecord,
  HrEmployeeProfileResponse,
  HrEmergencyContact,
  HrEmployeeDocument,
  LeaveBalanceAdjustment,
  AttendanceAdjustmentRequest,
} from '@/types';
import { useSession } from 'next-auth/react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useT, useLanguage } from '@/lib/i18n';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { UserCircle, FileText, Users, CalendarDays, Clock, Banknote, ShieldCheck, Pencil, Trash2, Plus, CheckCircle, XCircle, Star, ChevronDown } from 'lucide-react';

const CARD = 'bg-white border border-stone-200 rounded-[16px] shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden';

type TabId = 'overview' | 'employment' | 'documents' | 'contacts' | 'leave' | 'attendance' | 'payroll' | 'audit';

function getTenure(dateStr: string | null): string {
  if (!dateStr) return '—';
  const start = new Date(dateStr);
  const end = new Date();
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years > 0) return `${years}y ${months}m`;
  return `${months}m`;
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const { lang } = useLanguage();
  const { data: session } = useSession();

  const [profile, setProfile] = useState<HrEmployeeProfileResponse | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('overview');

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveAdjustments, setLeaveAdjustments] = useState<LeaveBalanceAdjustment[]>([]);
  const [attAdjRequests, setAttAdjRequests] = useState<AttendanceAdjustmentRequest[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<HrEmployeeProfileResponse['employee']>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState(false);

  // Contact form
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ contact_name: '', relationship: '', phone: '', alt_phone: '', address: '', is_primary: false });
  const [contactSaving, setContactSaving] = useState(false);

  // Document form
  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm] = useState({ doc_type: '', filename: '', storage_url: '', issued_date: '', expiry_date: '', notes: '' });
  const [docSaving, setDocSaving] = useState(false);

  // Leave adjustment form
  const [showLeaveAdj, setShowLeaveAdj] = useState(false);
  const [leaveAdjForm, setLeaveAdjForm] = useState({ leave_type_id: '', year: new Date().getFullYear(), adjustment_kind: 'entitlement' as 'entitlement' | 'used_correction', delta_days: 0, reason: '' });
  const [leaveAdjSaving, setLeaveAdjSaving] = useState(false);

  const u = session?.user as unknown as SessionUser | undefined;
  const canEdit = u && ['admin', 'manager'].includes(u.role);
  const canSeeSalary = u?.role === 'admin';
  const canReview = u && ['admin', 'manager'].includes(u.role);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusForm, setStatusForm] = useState<{ employee_status: 'inactive' | 'resigned'; resignation_date: string; reason: string }>({
    employee_status: 'inactive',
    resignation_date: '',
    reason: '',
  });
  const [statusSaving, setStatusSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const [prof, depts, pos] = await Promise.all([
        get<HrEmployeeProfileResponse>(`/api/hr/employees/${id}/profile`),
        get<Department[]>('/api/hr/departments'),
        get<Position[]>('/api/hr/positions'),
      ]);
      setProfile(prof);
      setForm(prof.employee);
      setDepartments(depts);
      setPositions(pos);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const fetchTabData = useCallback(async () => {
    if (!profile) return;
    setTabLoading(true);
    try {
      if (tab === 'leave') {
        const adjRes = await get<LeaveBalanceAdjustment[]>(`/api/hr/leave-balances/adjustments?employee_id=${id}`);
        setLeaveAdjustments(adjRes);
      } else if (tab === 'attendance') {
        const [attRes, adjRes] = await Promise.all([
          get<{ data: AttendanceRecord[] }>(`/api/hr/attendance?employee_id=${id}&pageSize=30`),
          get<AttendanceAdjustmentRequest[]>(`/api/hr/attendance-adjustments?employee_id=${id}`),
        ]);
        setAttendance(attRes.data);
        setAttAdjRequests(adjRes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTabLoading(false);
    }
  }, [id, tab, profile]);

  useEffect(() => {
    if (tab === 'leave' || tab === 'attendance') fetchTabData();
  }, [tab, fetchTabData]);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setSaveError('');
    setSaveOk(false);
    try {
      await patch(`/api/hr/employees/${id}`, { action: 'update', ...form });
      await fetchProfile();
      setIsEditing(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetStatus(e: React.FormEvent) {
    e.preventDefault();
    setStatusSaving(true);
    try {
      await patch(`/api/hr/employees/${id}`, {
        action: 'set_status',
        employee_status: statusForm.employee_status,
        resignation_date: statusForm.employee_status === 'resigned' ? statusForm.resignation_date || null : null,
        reason: statusForm.reason,
      });
      setShowStatusModal(false);
      await fetchProfile();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Error changing status');
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleAddContact() {
    setContactSaving(true);
    try {
      await post(`/api/hr/employees/${id}/emergency-contacts`, contactForm);
      setShowContactForm(false);
      setContactForm({ contact_name: '', relationship: '', phone: '', alt_phone: '', address: '', is_primary: false });
      await fetchProfile();
    } catch (e) { console.error(e); }
    finally { setContactSaving(false); }
  }

  async function handleDeleteContact(contactId: string) {
    try {
      await del(`/api/hr/employees/${id}/emergency-contacts/${contactId}`);
      await fetchProfile();
    } catch (e) { console.error(e); }
  }

  async function handleSetPrimary(contactId: string) {
    try {
      await patch(`/api/hr/employees/${id}/emergency-contacts/${contactId}`, { is_primary: true });
      await fetchProfile();
    } catch (e) { console.error(e); }
  }

  async function handleAddDocument() {
    setDocSaving(true);
    try {
      await post(`/api/hr/employees/${id}/documents`, docForm);
      setShowDocForm(false);
      setDocForm({ doc_type: '', filename: '', storage_url: '', issued_date: '', expiry_date: '', notes: '' });
      await fetchProfile();
    } catch (e) { console.error(e); }
    finally { setDocSaving(false); }
  }

  async function handleDocReview(docId: string, action: 'verify' | 'reject', rejected_reason?: string) {
    try {
      await patch(`/api/hr/employees/${id}/documents/${docId}`, action === 'verify'
        ? { action: 'verify' }
        : { action: 'reject', rejected_reason: rejected_reason ?? '' }
      );
      await fetchProfile();
    } catch (e) { console.error(e); }
  }

  async function handleLeaveAdjust(e: React.FormEvent) {
    e.preventDefault();
    setLeaveAdjSaving(true);
    try {
      await post('/api/hr/leave-balances/adjustments', { ...leaveAdjForm, employee_id: id });
      setShowLeaveAdj(false);
      setLeaveAdjForm({ leave_type_id: '', year: new Date().getFullYear(), adjustment_kind: 'entitlement', delta_days: 0, reason: '' });
      await fetchProfile();
      if (tab === 'leave') await fetchTabData();
    } catch (e) { console.error(e); }
    finally { setLeaveAdjSaving(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900" />
    </div>
  );

  if (!profile) return (
    <div className="py-24 text-center">
      <UserCircle size={64} className="mx-auto text-stone-300 mb-4" />
      <h2 className="text-xl font-semibold text-stone-900">{t('hr.employee360.not_found')}</h2>
      <p className="text-stone-500 mt-2">{t('hr.employee360.not_found_desc')}</p>
      <Link href="/app/hr/employees" className="mt-6 inline-block text-stone-900 font-medium underline underline-offset-4">
        {t('hr.employee360.back_to_list')}
      </Link>
    </div>
  );

  const emp = profile.employee;
  const statusColor = emp.employee_status === 'active'
    ? 'bg-green-50 text-green-700 border-green-100'
    : emp.employee_status === 'inactive'
    ? 'bg-amber-50 text-amber-700 border-amber-100'
    : 'bg-stone-50 text-stone-500 border-stone-200';

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t('hr.employee360.tabs.overview'), icon: <UserCircle size={16} /> },
    { id: 'employment', label: t('hr.employee360.tabs.employment'), icon: <FileText size={16} /> },
    { id: 'documents', label: t('hr.employee360.tabs.documents'), icon: <ShieldCheck size={16} /> },
    { id: 'contacts', label: t('hr.employee360.tabs.contacts'), icon: <Users size={16} /> },
    { id: 'leave', label: t('hr.employee360.tabs.leave'), icon: <CalendarDays size={16} /> },
    { id: 'attendance', label: t('hr.employee360.tabs.attendance'), icon: <Clock size={16} /> },
    { id: 'payroll', label: t('hr.employee360.tabs.payroll'), icon: <Banknote size={16} /> },
    { id: 'audit', label: t('hr.employee360.tabs.audit'), icon: <ShieldCheck size={16} /> },
  ];

  return (
    <DirectionalTransition>
      <div className="max-w-[1200px] mx-auto pb-24">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[13px] text-stone-400 mb-8">
          <Link href="/app/hr" className="hover:text-stone-600 transition-colors">HR</Link>
          <span>/</span>
          <Link href="/app/hr/employees" className="hover:text-stone-600 transition-colors">{t('hr.employee360.breadcrumb')}</Link>
          <span>/</span>
          <span className="text-stone-900 font-medium">{emp.name_th}</span>
        </nav>

        {/* Profile Header */}
        <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-hidden mb-8">
          <div className="h-32 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900" />
          <div className="px-8 pb-6 flex flex-col md:flex-row items-end gap-6 -mt-12 relative">
            <div className="w-28 h-28 rounded-[28px] bg-white p-1 shadow-xl">
              <div className="w-full h-full rounded-[24px] bg-stone-100 flex items-center justify-center text-3xl font-bold text-stone-900">
                {emp.name_en.charAt(0)}
              </div>
            </div>
            <div className="flex-1 pb-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-stone-900">{emp.name_th}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${statusColor}`}>
                  {t(`hr.employee360.status.${emp.employee_status}`)}
                </span>
              </div>
              <p className="text-base text-stone-500 mt-1">{emp.name_en}</p>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-[13px] text-stone-600">
                <span className="bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-100 font-mono font-bold">{emp.employee_id ?? '—'}</span>
                {emp.department_name_th && (
                  <span className="bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-100">{emp.department_name_th}</span>
                )}
                {emp.position_name_th && (
                  <span className="bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-100">{emp.position_name_th}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2 pb-2">
              {canEdit && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="h-10 px-4 rounded-xl bg-white border border-stone-200 text-[13px] font-semibold text-stone-900 hover:bg-stone-50 transition-all shadow-sm flex items-center gap-2"
                >
                  <Pencil size={14} />
                  {t('hr.employee360.edit')}
                </button>
              )}
              {canEdit && !isEditing && (
                <button
                  onClick={() => setShowStatusModal(true)}
                  className="h-10 px-4 rounded-xl bg-white border border-stone-200 text-[13px] font-semibold text-stone-600 hover:bg-stone-50 transition-all shadow-sm flex items-center gap-2"
                >
                  <ChevronDown size={14} />
                  {t('hr.employee360.set_status')}
                </button>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="px-4 flex overflow-x-auto border-t border-stone-100">
            {TABS.map(tb => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`py-3 px-4 flex items-center gap-1.5 text-[13px] font-semibold transition-all relative whitespace-nowrap
                  ${tab === tb.id ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
              >
                {tb.icon}
                {tb.label}
                {tab === tb.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-950 rounded-full" />}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-6">

            {/* OVERVIEW */}
            {tab === 'overview' && (
              <>
                <div className={CARD}>
                  <div className="p-6">
                    <h3 className="text-[13px] font-bold text-stone-400 uppercase tracking-wider mb-4">{t('hr.employee360.overview.attendance_month')}</h3>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      {[
                        { label: t('hr.employee360.overview.present'), value: profile.attendance_summary.present_days },
                        { label: t('hr.employee360.overview.late'), value: profile.attendance_summary.late_days },
                        { label: t('hr.employee360.overview.absent'), value: profile.attendance_summary.absent_days },
                        { label: t('hr.employee360.overview.ot_hours'), value: profile.attendance_summary.ot_hours },
                      ].map(stat => (
                        <div key={stat.label} className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                          <div className="text-2xl font-bold text-stone-900">{stat.value}</div>
                          <div className="text-[11px] text-stone-400 mt-1 font-medium">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={CARD}>
                  <div className="p-6">
                    <h3 className="text-[13px] font-bold text-stone-400 uppercase tracking-wider mb-4">{t('hr.employee360.overview.leave_remaining')}</h3>
                    {profile.leave_balances.length === 0 ? (
                      <p className="text-stone-400 text-[13px]">{t('hr.employee360.leave.no_balances')}</p>
                    ) : (
                      <div className="space-y-3">
                        {profile.leave_balances.map(lb => (
                          <div key={lb.leave_type_id} className="flex items-center justify-between">
                            <span className="text-[14px] text-stone-700 font-medium">{lb.leave_type_name_th}</span>
                            <span className="text-[14px] font-bold text-stone-900">{lb.days_remaining}/{lb.days_entitled}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className={CARD}>
                  <div className="p-6">
                    <h3 className="text-[13px] font-bold text-stone-400 uppercase tracking-wider mb-4">{t('hr.employee360.overview.primary_contact')}</h3>
                    {(() => {
                      const primary = profile.emergency_contacts.find(c => c.is_primary);
                      if (!primary) return <p className="text-stone-400 text-[13px]">{t('hr.employee360.overview.no_contact')}</p>;
                      return (
                        <div className="space-y-1 text-[14px]">
                          <div className="font-bold text-stone-900">{primary.contact_name} <span className="text-stone-400 font-normal">({primary.relationship})</span></div>
                          <div className="text-stone-600">{primary.phone}</div>
                          {primary.address && <div className="text-stone-400 text-[12px]">{primary.address}</div>}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}

            {/* EMPLOYMENT */}
            {tab === 'employment' && (
              <div className={CARD}>
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-stone-900">{t('hr.employee360.tabs.employment')}</h3>
                    {isEditing && (
                      <div className="flex gap-2">
                        <button onClick={() => { setIsEditing(false); setForm(emp); setSaveError(''); }}
                          className="px-3 py-1.5 rounded-lg text-[13px] font-bold text-stone-500 hover:bg-stone-50">
                          {t('hr.employee360.cancel')}
                        </button>
                        <button onClick={handleSave} disabled={saving}
                          className="px-4 py-1.5 rounded-lg bg-stone-900 text-white text-[13px] font-bold disabled:opacity-50">
                          {saving ? t('hr.employee360.saving') : t('hr.employee360.save')}
                        </button>
                      </div>
                    )}
                  </div>

                  <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-8">
                    <section>
                      <h4 className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-5 pb-2 border-b border-stone-100">
                        {t('hr.employee360.section.personal')}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <FieldBlock label={t('hr.employee360.field.name_th')} value={emp.name_th} />
                        <FieldBlock label={t('hr.employee360.field.name_en')} value={emp.name_en} />
                        <FieldBlock label={t('hr.employee360.field.email')} value={emp.email} />
                        <FieldBlock
                          label={t('hr.employee360.field.phone')}
                          value={emp.phone ?? '—'}
                          editing={isEditing}
                          input={
                            <input className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-[14px]"
                              value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                          }
                        />
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-5 pb-2 border-b border-stone-100">
                        {t('hr.employee360.section.employment')}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <FieldBlock
                          label={t('hr.employee360.field.department')}
                          value={emp.department_name_th ?? '—'}
                          editing={isEditing}
                          input={
                            <select className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-[14px]"
                              value={form.department_id ?? ''} onChange={e => setForm(f => ({ ...f, department_id: e.target.value || null }))}>
                              <option value="">{t('hr.employee360.select.department')}</option>
                              {departments.map(d => <option key={d.id} value={d.id}>{d.name_th}</option>)}
                            </select>
                          }
                        />
                        <FieldBlock
                          label={t('hr.employee360.field.position')}
                          value={emp.position_name_th ?? '—'}
                          editing={isEditing}
                          input={
                            <select className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-[14px]"
                              value={form.position_id ?? ''} onChange={e => setForm(f => ({ ...f, position_id: e.target.value || null }))}>
                              <option value="">{t('hr.employee360.select.position')}</option>
                              {positions.filter(p => !form.department_id || p.department_id === form.department_id)
                                .map(p => <option key={p.id} value={p.id}>{p.name_th}</option>)}
                            </select>
                          }
                        />
                        <FieldBlock
                          label={t('hr.employee360.field.employment_type')}
                          value={emp.employment_type.replace('_', ' ').toUpperCase()}
                          editing={isEditing}
                          input={
                            <select className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-[14px]"
                              value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value as 'full_time' | 'part_time' | 'contract' }))}>
                              <option value="full_time">Full-Time</option>
                              <option value="part_time">Part-Time</option>
                              <option value="contract">Contract</option>
                            </select>
                          }
                        />
                        <FieldBlock
                          label={t('hr.employee360.field.hired_date')}
                          value={formatDate(emp.hired_date, lang)}
                          editing={isEditing}
                          input={
                            <input type="date" className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-[14px]"
                              value={form.hired_date ?? ''} onChange={e => setForm(f => ({ ...f, hired_date: e.target.value || null }))} />
                          }
                        />
                      </div>
                    </section>
                  </form>
                  {saveError && (
                    <p role="alert" aria-live="polite" className="mt-4 p-3 rounded-lg bg-red-50 text-red-600 text-[13px] border border-red-100">{saveError}</p>
                  )}
                  {saveOk && (
                    <p role="status" aria-live="polite" className="mt-4 p-3 rounded-lg bg-green-50 text-green-700 text-[13px] border border-green-100">Saved</p>
                  )}
                </div>
              </div>
            )}

            {/* DOCUMENTS */}
            {tab === 'documents' && (
              <div className={CARD}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-stone-900">{t('hr.employee360.documents.title')}</h3>
                    {canEdit && (
                      <button onClick={() => setShowDocForm(v => !v)}
                        className="h-9 px-4 rounded-xl bg-stone-900 text-white text-[13px] font-semibold flex items-center gap-2">
                        <Plus size={14} />
                        {t('hr.employee360.documents.add')}
                      </button>
                    )}
                  </div>

                  {showDocForm && (
                    <form onSubmit={e => { e.preventDefault(); handleAddDocument(); }}
                      className="mb-6 p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block text-[12px] font-bold text-stone-500">
                          {t('hr.employee360.documents.doc_type')}
                          <input required className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                            value={docForm.doc_type} onChange={e => setDocForm(f => ({ ...f, doc_type: e.target.value }))} />
                        </label>
                        <label className="block text-[12px] font-bold text-stone-500">
                          {t('hr.employee360.documents.filename')}
                          <input required className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                            value={docForm.filename} onChange={e => setDocForm(f => ({ ...f, filename: e.target.value }))} />
                        </label>
                        <label className="block text-[12px] font-bold text-stone-500 sm:col-span-2">
                          {t('hr.employee360.documents.url')}
                          <input required className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                            value={docForm.storage_url} onChange={e => setDocForm(f => ({ ...f, storage_url: e.target.value }))} />
                        </label>
                        <label className="block text-[12px] font-bold text-stone-500">
                          {t('hr.employee360.documents.issued_date')}
                          <input type="date" className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                            value={docForm.issued_date} onChange={e => setDocForm(f => ({ ...f, issued_date: e.target.value }))} />
                        </label>
                        <label className="block text-[12px] font-bold text-stone-500">
                          {t('hr.employee360.documents.expiry')}
                          <input type="date" className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                            value={docForm.expiry_date} onChange={e => setDocForm(f => ({ ...f, expiry_date: e.target.value }))} />
                        </label>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setShowDocForm(false)}
                          className="px-3 py-1.5 text-[13px] text-stone-500 hover:text-stone-700">{t('hr.employee360.cancel')}</button>
                        <button type="submit" disabled={docSaving}
                          className="px-4 py-1.5 bg-stone-900 text-white rounded-lg text-[13px] font-semibold disabled:opacity-50">
                          {t('hr.employee360.documents.save')}
                        </button>
                      </div>
                    </form>
                  )}

                  {profile.documents.length === 0 ? (
                    <p className="text-stone-400 text-[13px] py-6 text-center">{t('hr.employee360.documents.no_documents')}</p>
                  ) : (
                    <div className="space-y-3">
                      {profile.documents.map((doc: HrEmployeeDocument) => (
                        <div key={doc.id} className="flex items-start gap-4 p-4 bg-stone-50 rounded-xl border border-stone-100">
                          <FileText size={20} className="text-stone-400 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[14px] text-stone-900">{doc.filename}</span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border uppercase
                                bg-stone-50 text-stone-500 border-stone-200">
                                {doc.doc_type}
                              </span>
                              <DocStatusBadge status={doc.status} />
                            </div>
                            {doc.expiry_date && (
                              <div className="text-[12px] text-stone-400 mt-1">
                                {t('hr.employee360.documents.expiry')}: {formatDate(doc.expiry_date, lang)}
                              </div>
                            )}
                            {doc.rejected_reason && (
                              <div className="text-[12px] text-red-500 mt-1">{doc.rejected_reason}</div>
                            )}
                          </div>
                          {canReview && doc.status === 'pending_review' && (
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => handleDocReview(doc.id, 'verify')}
                                className="h-8 px-3 rounded-lg bg-green-50 text-green-700 border border-green-100 text-[12px] font-semibold flex items-center gap-1">
                                <CheckCircle size={12} />
                                {t('hr.employee360.documents.verify')}
                              </button>
                              <button onClick={() => {
                                const reason = window.prompt(t('hr.employee360.documents.rejected_reason'));
                                if (reason) handleDocReview(doc.id, 'reject', reason);
                              }}
                                className="h-8 px-3 rounded-lg bg-red-50 text-red-700 border border-red-100 text-[12px] font-semibold flex items-center gap-1">
                                <XCircle size={12} />
                                {t('hr.employee360.documents.reject')}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CONTACTS */}
            {tab === 'contacts' && (
              <div className={CARD}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-stone-900">{t('hr.employee360.contacts.title')}</h3>
                    {canEdit && (
                      <button onClick={() => setShowContactForm(v => !v)}
                        className="h-9 px-4 rounded-xl bg-stone-900 text-white text-[13px] font-semibold flex items-center gap-2">
                        <Plus size={14} />
                        {t('hr.employee360.contacts.add')}
                      </button>
                    )}
                  </div>

                  {showContactForm && (
                    <form onSubmit={e => { e.preventDefault(); handleAddContact(); }}
                      className="mb-6 p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block text-[12px] font-bold text-stone-500">
                          {t('hr.employee360.contacts.name')}
                          <input required className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                            value={contactForm.contact_name} onChange={e => setContactForm(f => ({ ...f, contact_name: e.target.value }))} />
                        </label>
                        <label className="block text-[12px] font-bold text-stone-500">
                          {t('hr.employee360.contacts.relationship')}
                          <input required className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                            value={contactForm.relationship} onChange={e => setContactForm(f => ({ ...f, relationship: e.target.value }))} />
                        </label>
                        <label className="block text-[12px] font-bold text-stone-500">
                          {t('hr.employee360.contacts.phone')}
                          <input required type="tel" className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                            value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} />
                        </label>
                        <label className="block text-[12px] font-bold text-stone-500">
                          {t('hr.employee360.contacts.alt_phone')}
                          <input type="tel" className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                            value={contactForm.alt_phone} onChange={e => setContactForm(f => ({ ...f, alt_phone: e.target.value }))} />
                        </label>
                        <label className="block text-[12px] font-bold text-stone-500 sm:col-span-2">
                          {t('hr.employee360.contacts.address')}
                          <textarea className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]" rows={2}
                            value={contactForm.address} onChange={e => setContactForm(f => ({ ...f, address: e.target.value }))} />
                        </label>
                        <label className="flex items-center gap-2 text-[13px] font-medium text-stone-700 cursor-pointer">
                          <input type="checkbox" checked={contactForm.is_primary}
                            onChange={e => setContactForm(f => ({ ...f, is_primary: e.target.checked }))} />
                          {t('hr.employee360.contacts.primary')}
                        </label>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setShowContactForm(false)}
                          className="px-3 py-1.5 text-[13px] text-stone-500 hover:text-stone-700">{t('hr.employee360.cancel')}</button>
                        <button type="submit" disabled={contactSaving}
                          className="px-4 py-1.5 bg-stone-900 text-white rounded-lg text-[13px] font-semibold disabled:opacity-50">
                          {t('hr.employee360.contacts.save')}
                        </button>
                      </div>
                    </form>
                  )}

                  {profile.emergency_contacts.length === 0 ? (
                    <p className="text-stone-400 text-[13px] py-6 text-center">{t('hr.employee360.contacts.no_contacts')}</p>
                  ) : (
                    <div className="space-y-3">
                      {profile.emergency_contacts.map((c: HrEmergencyContact) => (
                        <div key={c.id} className="flex items-start gap-4 p-4 bg-stone-50 rounded-xl border border-stone-100">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[14px] text-stone-900">{c.contact_name}</span>
                              <span className="text-stone-400 text-[13px]">{c.relationship}</span>
                              {c.is_primary && (
                                <Star size={12} className="text-amber-400 fill-amber-400" />
                              )}
                            </div>
                            <div className="text-[13px] text-stone-600 mt-1">{c.phone}</div>
                            {c.address && <div className="text-[12px] text-stone-400 mt-0.5">{c.address}</div>}
                          </div>
                          {canEdit && (
                            <div className="flex gap-1 shrink-0">
                              {!c.is_primary && (
                                <button onClick={() => handleSetPrimary(c.id)}
                                  title={t('hr.employee360.contacts.set_primary')}
                                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:text-amber-500 hover:border-amber-200">
                                  <Star size={13} />
                                </button>
                              )}
                              <button onClick={() => handleDeleteContact(c.id)}
                                title={t('hr.employee360.contacts.delete')}
                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-200">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* LEAVE */}
            {tab === 'leave' && (
              <>
                <div className={CARD}>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-lg font-bold text-stone-900">{t('hr.employee360.leave.title')}</h3>
                      {canEdit && (
                        <button onClick={() => setShowLeaveAdj(v => !v)}
                          className="h-9 px-4 rounded-xl bg-stone-900 text-white text-[13px] font-semibold flex items-center gap-2">
                          <Plus size={14} />
                          {t('hr.employee360.leave.add_adjustment')}
                        </button>
                      )}
                    </div>

                    {showLeaveAdj && (
                      <form onSubmit={handleLeaveAdjust}
                        className="mb-6 p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="block text-[12px] font-bold text-stone-500">
                            {t('hr.employee360.leave.adjustment_kind')}
                            <select className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                              value={leaveAdjForm.adjustment_kind}
                              onChange={e => setLeaveAdjForm(f => ({ ...f, adjustment_kind: e.target.value as 'entitlement' | 'used_correction' }))}>
                              <option value="entitlement">{t('hr.employee360.leave.kind.entitlement')}</option>
                              <option value="used_correction">{t('hr.employee360.leave.kind.used_correction')}</option>
                            </select>
                          </label>
                          <label className="block text-[12px] font-bold text-stone-500">
                            Leave Type
                            <select required className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                              value={leaveAdjForm.leave_type_id}
                              onChange={e => setLeaveAdjForm(f => ({ ...f, leave_type_id: e.target.value }))}>
                              <option value="">—</option>
                              {profile.leave_balances.map(lb => (
                                <option key={lb.leave_type_id} value={lb.leave_type_id}>{lb.leave_type_name_th}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-[12px] font-bold text-stone-500">
                            {t('hr.employee360.leave.delta_days')}
                            <input type="number" step="0.5" required className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                              value={leaveAdjForm.delta_days}
                              onChange={e => setLeaveAdjForm(f => ({ ...f, delta_days: parseFloat(e.target.value) }))} />
                          </label>
                          <label className="block text-[12px] font-bold text-stone-500 sm:col-span-2">
                            {t('hr.employee360.leave.reason')}
                            <textarea required rows={2} className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                              value={leaveAdjForm.reason}
                              onChange={e => setLeaveAdjForm(f => ({ ...f, reason: e.target.value }))} />
                          </label>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button type="button" onClick={() => setShowLeaveAdj(false)}
                            className="px-3 py-1.5 text-[13px] text-stone-500">{t('hr.employee360.cancel')}</button>
                          <button type="submit" disabled={leaveAdjSaving}
                            className="px-4 py-1.5 bg-stone-900 text-white rounded-lg text-[13px] font-semibold disabled:opacity-50">
                            {t('hr.employee360.leave.submit')}
                          </button>
                        </div>
                      </form>
                    )}

                    {profile.leave_balances.length === 0 ? (
                      <p className="text-stone-400 text-center py-6 text-[13px]">{t('hr.employee360.leave.no_balances')}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-[11px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100">
                              <th className="pb-3 px-2">Leave Type</th>
                              <th className="pb-3 px-2 text-center">Entitled</th>
                              <th className="pb-3 px-2 text-center">Used</th>
                              <th className="pb-3 px-2 text-center">Remaining</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-50">
                            {profile.leave_balances.map(lb => (
                              <tr key={lb.leave_type_id} className="text-[14px]">
                                <td className="py-3 px-2 font-medium text-stone-900">{lb.leave_type_name_th}</td>
                                <td className="py-3 px-2 text-center text-stone-600">{lb.days_entitled}</td>
                                <td className="py-3 px-2 text-center text-stone-600">{lb.days_used}</td>
                                <td className="py-3 px-2 text-center font-bold text-stone-900">{lb.days_remaining}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Leave history */}
                {tabLoading ? (
                  <div className="py-8 flex justify-center"><div className="animate-spin h-5 w-5 border-b-2 border-stone-900 rounded-full" /></div>
                ) : (
                  <div className={CARD}>
                    <div className="p-6">
                      <h4 className="text-[13px] font-bold text-stone-400 uppercase tracking-wider mb-4">{t('hr.employee360.leave.history')}</h4>
                      {leaveAdjustments.length === 0 ? (
                        <p className="text-stone-400 text-[13px] text-center py-4">{t('hr.employee360.leave.no_history')}</p>
                      ) : (
                        <div className="space-y-2">
                          {leaveAdjustments.map(adj => (
                            <div key={adj.id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                              <div className="text-[13px]">
                                <span className="font-medium text-stone-900">{adj.leave_type_name_th}</span>
                                <span className="text-stone-400 ml-2">{adj.adjustment_kind === 'entitlement' ? t('hr.employee360.leave.kind.entitlement') : t('hr.employee360.leave.kind.used_correction')}</span>
                                <span className={`ml-2 font-bold ${adj.delta_days > 0 ? 'text-green-700' : 'text-red-700'}`}>{adj.delta_days > 0 ? '+' : ''}{adj.delta_days}</span>
                              </div>
                              <div className="text-[12px] text-stone-400">{formatDate(adj.created_at, lang)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ATTENDANCE */}
            {tab === 'attendance' && (
              <>
                {tabLoading ? (
                  <div className="py-8 flex justify-center"><div className="animate-spin h-5 w-5 border-b-2 border-stone-900 rounded-full" /></div>
                ) : (
                  <>
                    <div className={CARD}>
                      <div className="p-6">
                        <h3 className="text-lg font-bold text-stone-900 mb-5">{t('hr.employee360.attendance.title')}</h3>
                        {attendance.length === 0 ? (
                          <p className="text-stone-400 text-[13px] text-center py-6">{t('hr.employee360.attendance.no_records')}</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="text-[11px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100">
                                  <th className="pb-3 px-2">Date</th>
                                  <th className="pb-3 px-2 text-center">In</th>
                                  <th className="pb-3 px-2 text-center">Out</th>
                                  <th className="pb-3 px-2 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-50">
                                {attendance.map(a => (
                                  <tr key={a.id} className="text-[13px]">
                                    <td className="py-3 px-2 font-medium text-stone-900">{formatDate(a.work_date, lang)}</td>
                                    <td className="py-3 px-2 text-center font-mono text-stone-600">
                                      {a.clock_in ? new Date(a.clock_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </td>
                                    <td className="py-3 px-2 text-center font-mono text-stone-600">
                                      {a.clock_out ? new Date(a.clock_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                      <AttStatusBadge status={a.status} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={CARD}>
                      <div className="p-6">
                        <h4 className="text-[13px] font-bold text-stone-400 uppercase tracking-wider mb-4">{t('hr.employee360.attendance.adjustments')}</h4>
                        {attAdjRequests.length === 0 ? (
                          <p className="text-stone-400 text-[13px] text-center py-4">{t('hr.att_adj.no_data')}</p>
                        ) : (
                          <div className="space-y-2">
                            {attAdjRequests.map(r => (
                              <div key={r.id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                                <div>
                                  <div className="text-[13px] font-medium text-stone-900">{r.request_number} — {formatDate(r.work_date, lang)}</div>
                                  <div className="text-[12px] text-stone-400">{r.reason}</div>
                                </div>
                                <AdjStatusBadge status={r.status} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* PAYROLL */}
            {tab === 'payroll' && (
              <div className={CARD}>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-stone-900 mb-5">{t('hr.employee360.payroll.title')}</h3>
                  {!canSeeSalary ? (
                    <p className="text-stone-400 text-[13px] text-center py-8">{t('hr.employee360.salary_hidden')}</p>
                  ) : profile.payroll_summary ? (
                    <div className="space-y-4">
                      <div className="text-[13px] text-stone-400 font-medium">{t('hr.employee360.payroll.latest')}: {profile.payroll_summary.latest_run_number}</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                          <div className="text-[12px] text-stone-400 mb-1">{t('hr.employee360.payroll.gross')}</div>
                          <div className="text-xl font-bold text-stone-900">{formatCurrency(profile.payroll_summary.gross_pay, lang)}</div>
                        </div>
                        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                          <div className="text-[12px] text-stone-400 mb-1">{t('hr.employee360.payroll.net')}</div>
                          <div className="text-xl font-bold text-indigo-700">{formatCurrency(profile.payroll_summary.net_pay, lang)}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-stone-400 text-[13px] text-center py-8">{t('hr.employee360.payroll.no_data')}</p>
                  )}
                </div>
              </div>
            )}

            {/* AUDIT */}
            {tab === 'audit' && (
              <div className={CARD}>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-stone-900 mb-5">{t('hr.employee360.audit.title')}</h3>
                  {profile.audit_events.length === 0 ? (
                    <p className="text-stone-400 text-[13px] text-center py-8">{t('hr.employee360.audit.no_events')}</p>
                  ) : (
                    <div className="space-y-3">
                      {profile.audit_events.map(ev => (
                        <div key={ev.id} className="flex items-start gap-4 py-3 border-b border-stone-50 last:border-0">
                          <div className="w-2 h-2 rounded-full bg-stone-400 mt-2 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[13px] font-semibold text-stone-900">{ev.event_type}</span>
                              <span className="text-[11px] text-stone-400">{formatDate(ev.created_at, lang)}</span>
                            </div>
                            {ev.actor_name_th && (
                              <div className="text-[12px] text-stone-400 mt-0.5">by {ev.actor_name_th}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {canSeeSalary && (
              <div className={`${CARD} !border-indigo-100 bg-indigo-50/20`}>
                <div className="p-6">
                  <h3 className="text-[13px] font-bold text-indigo-900 uppercase tracking-wider mb-4">
                    {t('hr.employee360.field.base_salary')}
                  </h3>
                  <div className="text-[28px] font-bold text-indigo-900">
                    {emp.base_salary != null ? formatCurrency(emp.base_salary, lang) : '—'}
                  </div>
                  <div className="mt-4 pt-4 border-t border-indigo-100/50 space-y-3">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-indigo-900/60">{t('hr.employee360.field.salary_grade')}</span>
                      <span className="font-bold text-indigo-900">{emp.salary_grade_name ?? '—'}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-indigo-900/60">{t('hr.employee360.pay_cycle')}</span>
                      <span className="font-bold text-indigo-900">{t('hr.employee360.monthly')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className={CARD}>
              <div className="p-6 space-y-4">
                <h3 className="text-[13px] font-bold text-stone-900 uppercase tracking-wider">{t('hr.employee360.other_info')}</h3>
                <div>
                  <div className="text-[11px] font-medium text-stone-400 mb-1">{t('hr.employee360.tenure')}</div>
                  <div className="text-[15px] font-bold text-stone-900">{getTenure(emp.hired_date)}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-stone-400 mb-1">{t('hr.employee360.branch')}</div>
                  <div className="text-[15px] font-bold text-stone-900">{t('hr.employee360.hq')}</div>
                </div>
                <div className="pt-3 border-t border-stone-100">
                  <Link href={`/app/hr/attendance/adjustments?employee_id=${id}`}
                    className="block w-full h-10 rounded-xl bg-stone-50 border border-stone-200 text-[13px] font-bold text-stone-600 hover:bg-stone-100 transition-all text-center leading-[40px]">
                    {t('hr.employee360.attendance.adjustments')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100">
              <h3 className="text-[16px] font-bold text-stone-900">{t('hr.employee360.confirm_status_change')}</h3>
            </div>
            <form onSubmit={handleSetStatus} className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-stone-500 mb-2">
                  {t('hr.employee360.set_status')}
                </label>
                <div className="flex gap-3">
                  {(['inactive', 'resigned'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusForm(f => ({ ...f, employee_status: s }))}
                      className={`flex-1 py-2 rounded-xl text-[13px] font-semibold border transition-all
                        ${statusForm.employee_status === s
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
                    >
                      {t(`hr.employee360.status_${s}`)}
                    </button>
                  ))}
                </div>
              </div>
              {statusForm.employee_status === 'resigned' && (
                <label className="block text-[12px] font-bold text-stone-500">
                  {t('hr.employee360.resignation_date')}
                  <input
                    type="date"
                    required
                    className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                    value={statusForm.resignation_date}
                    onChange={e => setStatusForm(f => ({ ...f, resignation_date: e.target.value }))}
                  />
                </label>
              )}
              <label className="block text-[12px] font-bold text-stone-500">
                {t('hr.employee360.status_reason')}
                <textarea
                  required
                  rows={3}
                  className="mt-1 w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-[13px]"
                  value={statusForm.reason}
                  onChange={e => setStatusForm(f => ({ ...f, reason: e.target.value }))}
                />
              </label>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 py-2 rounded-xl border border-stone-200 text-[13px] font-semibold text-stone-600 hover:bg-stone-50"
                >
                  {t('hr.employee360.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={statusSaving}
                  className="flex-1 py-2 rounded-xl bg-stone-900 text-white text-[13px] font-semibold disabled:opacity-50"
                >
                  {statusSaving ? t('hr.employee360.saving') : t('hr.employee360.confirm_status_change')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DirectionalTransition>
  );
}

function FieldBlock({
  label, value, editing, input,
}: {
  label: string;
  value: React.ReactNode;
  editing?: boolean;
  input?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">{label}</label>
      {editing && input ? input : (
        <div className="text-[14px] font-semibold text-stone-900">{value || '—'}</div>
      )}
    </div>
  );
}

function DocStatusBadge({ status }: { status: HrEmployeeDocument['status'] }) {
  const colors: Record<HrEmployeeDocument['status'], string> = {
    pending_review: 'bg-amber-50 text-amber-700 border-amber-100',
    verified: 'bg-green-50 text-green-700 border-green-100',
    rejected: 'bg-red-50 text-red-700 border-red-100',
    expired: 'bg-stone-50 text-stone-500 border-stone-200',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${colors[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function AttStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    present: 'bg-green-50 text-green-700 border-green-100',
    late: 'bg-amber-50 text-amber-700 border-amber-100',
    absent: 'bg-red-50 text-red-700 border-red-100',
    half_day: 'bg-blue-50 text-blue-700 border-blue-100',
    holiday: 'bg-purple-50 text-purple-700 border-purple-100',
  };
  const cls = colors[status] ?? 'bg-stone-50 text-stone-500 border-stone-200';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${cls}`}>
      {status}
    </span>
  );
}

function AdjStatusBadge({ status }: { status: AttendanceAdjustmentRequest['status'] }) {
  const colors: Record<AttendanceAdjustmentRequest['status'], string> = {
    submitted: 'bg-amber-50 text-amber-700 border-amber-100',
    approved: 'bg-green-50 text-green-700 border-green-100',
    rejected: 'bg-red-50 text-red-700 border-red-100',
    cancelled: 'bg-stone-50 text-stone-500 border-stone-200',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${colors[status]}`}>
      {status}
    </span>
  );
}
