'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, use, useCallback } from 'react';
import { get, patch, del } from '@/lib/api-client';
import type { HrEmployee, Department, Position, SessionUser, LeaveRequest, AttendanceRecord, PayrollLine } from '@/types';
import { useSession } from 'next-auth/react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { useRouter } from 'next/navigation';

const CARD = 'bg-white border border-stone-200 rounded-[16px] shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden';

interface PayrollEntry extends PayrollLine {
  period_month: number;
  period_year: number;
  run_number: string;
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const { lang } = useLanguage();
  
  const [employee, setEmployee] = useState<HrEmployee | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'leave' | 'attendance' | 'payroll'>('info');
  
  // Tab Data
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payroll, setPayroll] = useState<PayrollEntry[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<HrEmployee>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const user = session?.user as unknown as SessionUser;
  const canEdit = user && ['admin', 'manager'].includes(user.role);
  const canDelete = user?.role === 'admin';

  const fetchEmployee = useCallback(async () => {
    try {
      const [emp, depts, pos] = await Promise.all([
        get<HrEmployee>(`/api/hr/employees/${id}`),
        get<Department[]>('/api/hr/departments'),
        get<Position[]>('/api/hr/positions'),
      ]);
      setEmployee(emp);
      setForm(emp);
      setDepartments(depts);
      setPositions(pos);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchEmployee(); }, [fetchEmployee]);

  const fetchTabData = useCallback(async () => {
    setTabLoading(true);
    try {
      if (tab === 'leave') {
        const res = await get<{ data: LeaveRequest[] }>(`/api/hr/leave-requests?employee_id=${id}&pageSize=10`);
        setLeaves(res.data);
      } else if (tab === 'attendance') {
        const res = await get<{ data: AttendanceRecord[] }>(`/api/hr/attendance?employee_id=${id}&pageSize=30`);
        setAttendance(res.data);
      } else if (tab === 'payroll') {
        const res = await get<PayrollEntry[]>(`/api/hr/employees/${id}/payroll`);
        setPayroll(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTabLoading(false);
    }
  }, [id, tab]);

  useEffect(() => { if (tab !== 'info') fetchTabData(); }, [tab, fetchTabData]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await patch(`/api/hr/employees/${id}`, { action: 'update', ...form });
      await fetchEmployee();
      setIsEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลพนักงานนี้?')) return;
    setSaving(true);
    try {
      await del(`/api/hr/employees/${id}`);
      router.push('/app/hr/employees');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการลบ');
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900" />
    </div>
  );
  
  if (!employee) return (
    <div className="py-24 text-center">
      <div className="text-stone-300 mb-4">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M17 11l5 5m0-5l-5 5"/></svg>
      </div>
      <h2 className="text-xl font-semibold text-stone-900">ไม่พบข้อมูลพนักงาน</h2>
      <p className="text-stone-500 mt-2">พนักงานอาจถูกลบออกไปแล้วหรือคุณไม่มีสิทธิ์เข้าถึง</p>
      <Link href="/app/hr/employees" className="mt-6 inline-block text-stone-900 font-medium underline underline-offset-4">กลับไปยังหน้ารายชื่อ</Link>
    </div>
  );

  return (
    <DirectionalTransition>
      <div className="max-w-[1200px] mx-auto pb-24">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-[13px] text-stone-400 mb-8">
          <Link href="/app/hr" className="hover:text-stone-600 transition-colors">HR Dashboard</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          <Link href="/app/hr/employees" className="hover:text-stone-600 transition-colors">พนักงาน</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          <span className="text-stone-900 font-medium">{employee.name_th}</span>
        </nav>

        {/* Profile Header Card */}
        <div className="bg-white border border-stone-200 rounded-[24px] shadow-sm overflow-hidden mb-8">
          <div className="h-32 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 relative">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-white" />
          </div>
          <div className="px-8 pb-8 flex flex-col md:flex-row items-end gap-6 -mt-12 relative">
            <div className="w-32 h-32 rounded-[32px] bg-white p-1 shadow-xl">
              <div className="w-full h-full rounded-[28px] bg-stone-100 flex items-center justify-center text-4xl font-bold text-stone-900 border-4 border-white">
                {employee.name_en.slice(0, 1)}
              </div>
            </div>
            <div className="flex-1 pb-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-stone-900 tracking-tight">{employee.name_th}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider
                  ${employee.employee_status === 'active' ? 'bg-green-50 text-green-700 border-green-100' : 
                    employee.employee_status === 'inactive' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                    'bg-stone-50 text-stone-500 border-stone-200'}`}>
                  {employee.employee_status}
                </span>
              </div>
              <p className="text-lg text-stone-500 font-medium mt-1">{employee.name_en}</p>
              <div className="flex items-center gap-4 mt-4 text-[13.5px] text-stone-600">
                <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-100">
                  <span className="text-stone-400">ID:</span>
                  <span className="font-mono font-bold">{employee.employee_id}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-100">
                  <span className="text-stone-400">แผนก:</span>
                  <span className="font-bold">{employee.department_name_th || '—'}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pb-2">
              {canEdit && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="h-10 px-5 rounded-xl bg-white border border-stone-200 text-[14px] font-semibold text-stone-900 hover:bg-stone-50 transition-all shadow-sm active:scale-95"
                >
                  แก้ไขข้อมูล
                </button>
              )}
              {canDelete && !isEditing && (
                <button
                  onClick={handleDelete}
                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-stone-200 text-stone-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all shadow-sm active:scale-95"
                  title="ลบพนักงาน"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-8 flex border-t border-stone-100">
            {([
              { id: 'info', label: 'โปรไฟล์', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
              { id: 'leave', label: 'ประวัติการลา', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
              { id: 'attendance', label: 'บันทึกเวลา', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
              { id: 'payroll', label: 'เงินเดือน/สลิป', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h0M2 9.5h20"/></svg> },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`py-4 px-6 flex items-center gap-2 text-[14px] font-semibold transition-all relative
                  ${tab === t.id ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
              >
                {t.icon}
                {t.label}
                {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-950 rounded-full" />}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {tab === 'info' && (
              <div className={CARD}>
                <div className="p-8">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-stone-900">ข้อมูลพื้นฐาน</h3>
                    {isEditing && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setIsEditing(false); setForm(employee); setError(''); }}
                          className="px-4 py-1.5 rounded-lg text-[13px] font-bold text-stone-500 hover:bg-stone-50 transition-colors"
                        >
                          ยกเลิก
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="px-4 py-1.5 rounded-lg bg-stone-900 text-white text-[13px] font-bold shadow-sm hover:bg-stone-800 transition-colors disabled:opacity-50"
                        >
                          {saving ? 'กำลังบันทึก...' : 'บันทึกแก้ไข'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-10">
                    {/* Personal Info Group */}
                    <section>
                      <h4 className="text-[12px] font-bold text-stone-400 uppercase tracking-widest mb-6 border-b border-stone-100 pb-2">รายละเอียดส่วนตัว</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <InfoBlock label="ชื่อ - นามสกุล (ไทย)" value={employee.name_th} />
                        <InfoBlock label="Full Name (EN)" value={employee.name_en} />
                        <InfoBlock label="อีเมล" value={employee.email} />
                        <InfoBlock 
                          label="เบอร์โทรศัพท์" 
                          value={employee.phone || '—'} 
                          editing={isEditing}
                          input={<input className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-[14px]" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} />}
                        />
                      </div>
                    </section>

                    {/* Employment Group */}
                    <section>
                      <h4 className="text-[12px] font-bold text-stone-400 uppercase tracking-widest mb-6 border-b border-stone-100 pb-2">สถานะการจ้างงาน</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <InfoBlock 
                          label="แผนก" 
                          value={employee.department_name_th || '—'} 
                          editing={isEditing}
                          input={
                            <select className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-[14px]" value={form.department_id || ''} onChange={e => setForm({...form, department_id: e.target.value})}>
                              <option value="">เลือกแผนก</option>
                              {departments.map(d => <option key={d.id} value={d.id}>{d.name_th}</option>)}
                            </select>
                          }
                        />
                        <InfoBlock 
                          label="ตำแหน่ง" 
                          value={employee.position_name_th || '—'} 
                          editing={isEditing}
                          input={
                            <select className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-[14px]" value={form.position_id || ''} onChange={e => setForm({...form, position_id: e.target.value})}>
                              <option value="">เลือกตำแหน่ง</option>
                              {positions.filter(p => !form.department_id || p.department_id === form.department_id).map(p => <option key={p.id} value={p.id}>{p.name_th}</option>)}
                            </select>
                          }
                        />
                        <InfoBlock 
                          label="ประเภทสัญญา" 
                          value={employee.employment_type.replace('_', ' ').toUpperCase()} 
                          editing={isEditing}
                          input={
                            <select className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-[14px]" value={form.employment_type} onChange={e => setForm({...form, employment_type: e.target.value as 'full_time' | 'part_time' | 'contract'})}>
                              <option value="full_time">Full-Time</option>
                              <option value="part_time">Part-Time</option>
                              <option value="contract">Contract</option>
                            </select>
                          }
                        />
                        <InfoBlock 
                          label="วันที่เริ่มงาน" 
                          value={formatDate(employee.hired_date, lang)} 
                          editing={isEditing}
                          input={<input type="date" className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-[14px]" value={form.hired_date || ''} onChange={e => setForm({...form, hired_date: e.target.value})} />}
                        />
                      </div>
                    </section>
                  </div>
                  {error && <p className="mt-6 p-3 rounded-lg bg-red-50 text-red-600 text-[13px] font-medium border border-red-100">{error}</p>}
                </div>
              </div>
            )}

            {tab === 'leave' && (
              <div className={CARD}>
                <div className="p-8">
                  <h3 className="text-xl font-bold text-stone-900 mb-6">ประวัติการลา</h3>
                  {tabLoading ? (
                    <div className="py-12 flex justify-center"><div className="animate-spin h-6 w-6 border-b-2 border-stone-900 rounded-full" /></div>
                  ) : leaves.length === 0 ? (
                    <div className="py-20 text-center text-stone-400 italic">ไม่พบประวัติการลา</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-[11px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100">
                            <th className="pb-3 px-2">ประเภท</th>
                            <th className="pb-3 px-2">วันที่ลา</th>
                            <th className="pb-3 px-2">จำนวนวัน</th>
                            <th className="pb-3 px-2 text-right">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                          {leaves.map(l => (
                            <tr key={l.id} className="text-[13.5px]">
                              <td className="py-4 px-2 font-medium text-stone-900">{l.leave_type_name_th}</td>
                              <td className="py-4 px-2 text-stone-500">{formatDate(l.start_date, lang)}</td>
                              <td className="py-4 px-2 font-bold text-stone-700">{l.days_requested}</td>
                              <td className="py-4 px-2 text-right">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold border uppercase
                                  ${l.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                    l.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' : 
                                    'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                  {l.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'attendance' && (
              <div className={CARD}>
                <div className="p-8">
                  <h3 className="text-xl font-bold text-stone-900 mb-6">บันทึกเวลาเข้า-ออก</h3>
                  {tabLoading ? (
                    <div className="py-12 flex justify-center"><div className="animate-spin h-6 w-6 border-b-2 border-stone-900 rounded-full" /></div>
                  ) : attendance.length === 0 ? (
                    <div className="py-20 text-center text-stone-400 italic">ไม่พบข้อมูลการเข้างาน</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-[11px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100">
                            <th className="pb-3 px-2">วันที่</th>
                            <th className="pb-3 px-2 text-center">เวลาเข้า</th>
                            <th className="pb-3 px-2 text-center">เวลาออก</th>
                            <th className="pb-3 px-2 text-right">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                          {attendance.map(a => (
                            <tr key={a.id} className="text-[13.5px]">
                              <td className="py-4 px-2 font-medium text-stone-900">{formatDate(a.work_date, lang)}</td>
                              <td className="py-4 px-2 text-center font-mono text-stone-600">
                                {a.clock_in ? new Date(a.clock_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                              </td>
                              <td className="py-4 px-2 text-center font-mono text-stone-600">
                                {a.clock_out ? new Date(a.clock_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                              </td>
                              <td className="py-4 px-2 text-right">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold border uppercase
                                  ${a.status === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                    a.status === 'late' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                                    'bg-red-50 text-red-700 border-red-100'}`}>
                                  {a.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'payroll' && (
              <div className={CARD}>
                <div className="p-8">
                  <h3 className="text-xl font-bold text-stone-900 mb-6">ประวัติเงินเดือนและสลิป</h3>
                  {tabLoading ? (
                    <div className="py-12 flex justify-center"><div className="animate-spin h-6 w-6 border-b-2 border-stone-900 rounded-full" /></div>
                  ) : payroll.length === 0 ? (
                    <div className="py-20 text-center text-stone-400 italic">ไม่พบประวัติการจ่ายเงินเดือน</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-[11px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100">
                            <th className="pb-3 px-2">งวดเดือน</th>
                            <th className="pb-3 px-2">รหัสรายการ</th>
                            <th className="pb-3 px-2 text-right">เงินรับสุทธิ</th>
                            <th className="pb-3 px-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                          {payroll.map(p => (
                            <tr key={p.id} className="text-[13.5px]">
                              <td className="py-4 px-2 font-bold text-stone-900">
                                {p.period_month}/{p.period_year + (lang === 'th' ? 543 : 0)}
                              </td>
                              <td className="py-4 px-2 font-mono text-stone-500">{p.run_number}</td>
                              <td className="py-4 px-2 font-bold text-indigo-600 text-right">{formatCurrency(p.net_pay, lang)}</td>
                              <td className="py-4 px-2 text-right">
                                <Link
                                  href={`/api/hr/payroll-runs/${p.run_id}/slip/${p.id}`}
                                  target="_blank"
                                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-stone-200 text-stone-400 hover:text-stone-900 hover:border-stone-400 transition-all shadow-sm"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Column */}
          <div className="space-y-8">
            {/* Compensation Summary */}
            <div className={`${CARD} !border-indigo-100 bg-indigo-50/20`}>
              <div className="p-6">
                <h3 className="text-[13px] font-bold text-indigo-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  รายได้ประจำ
                </h3>
                <div className="space-y-1">
                  <div className="text-[32px] font-bold text-indigo-900 tracking-tighter">
                    {formatCurrency(employee.base_salary, lang)}
                  </div>
                  <p className="text-[13px] text-indigo-700/60 font-medium">เงินเดือนพื้นฐาน (Base Salary)</p>
                </div>
                
                <div className="mt-8 pt-6 border-t border-indigo-100/50 space-y-4">
                  <div className="flex justify-between items-center text-[13.5px]">
                    <span className="text-indigo-900/60 font-medium">ระดับเงินเดือน</span>
                    <span className="font-bold text-indigo-900">{employee.salary_grade_name || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13.5px]">
                    <span className="text-indigo-900/60 font-medium">รอบการจ่าย</span>
                    <span className="font-bold text-indigo-900">รายเดือน</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className={CARD}>
              <div className="p-6">
                <h3 className="text-[13px] font-bold text-stone-900 uppercase tracking-wider mb-4">ข้อมูลอื่นๆ</h3>
                <div className="space-y-6">
                  <div>
                    <div className="text-[12px] font-medium text-stone-400 mb-1">อายุงานปัจจุบัน</div>
                    <div className="text-[15px] font-bold text-stone-900">
                      {getTenure(employee.hired_date)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium text-stone-400 mb-1">สาขาหลัก</div>
                    <div className="text-[15px] font-bold text-stone-900">
                      สำนักงานใหญ่
                    </div>
                  </div>
                  <div className="pt-4 border-t border-stone-100">
                    <button className="w-full h-10 rounded-xl bg-stone-50 border border-stone-200 text-[13px] font-bold text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-all">
                      ออกเอกสารรับรองพนักงาน
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DirectionalTransition>
  );
}

function InfoBlock({ label, value, editing, input }: { label: string; value: React.ReactNode; editing?: boolean; input?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11.5px] font-bold text-stone-400 uppercase tracking-wider">{label}</label>
      {editing && input ? (
        input
      ) : (
        <div className="text-[15px] font-semibold text-stone-900">{value || '—'}</div>
      )}
    </div>
  );
}

function getTenure(dateStr: string | null) {
  if (!dateStr) return '—';
  const start = new Date(dateStr);
  const end = new Date();
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years > 0) return `${years} ปี ${months} เดือน`;
  return `${months} เดือน`;
}
