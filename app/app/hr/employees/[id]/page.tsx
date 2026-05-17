'use client';

import { useState, useEffect, use } from 'react';
import { get, patch, del } from '@/lib/api-client';
import type { HrEmployee, Department, Position, SalaryGrade, SessionUser } from '@/types';
import { useSession } from 'next-auth/react';
import { formatDate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { useRouter } from 'next/navigation';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const [employee, setEmployee] = useState<HrEmployee | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [salaryGrades, setSalaryGrades] = useState<SalaryGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'leave' | 'attendance' | 'payroll'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<HrEmployee>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const user = session?.user as SessionUser | undefined;
  const canEdit = user && ['admin', 'manager'].includes(user.role);
  const canDelete = user?.role === 'admin';

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [emp, depts, pos, grades] = await Promise.all([
          get<HrEmployee>(`/api/hr/employees/${id}`),
          get<Department[]>('/api/hr/departments'),
          get<Position[]>('/api/hr/positions'),
          get<SalaryGrade[]>('/api/hr/salary-grades'),
        ]);
        setEmployee(emp);
        setForm(emp);
        setDepartments(depts);
        setPositions(pos);
        setSalaryGrades(grades);
      } finally { setLoading(false); }
    }
    init();
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await patch(`/api/hr/employees/${id}`, form);
      const updated = await get<HrEmployee>(`/api/hr/employees/${id}`);
      setEmployee(updated);
      setForm(updated);
      setIsEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลพนักงานนี้? การลบไม่สามารถเรียกคืนได้ และอาจล้มเหลวหากพนักงานมีประวัติการทำรายการในระบบ')) return;
    setSaving(true);
    setError('');
    try {
      await del(`/api/hr/employees/${id}`);
      router.push('/app/hr/employees');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการลบ');
      setSaving(false);
    }
  }

  if (loading) return <div className="py-12 text-center text-stone-400">กำลังโหลด...</div>;
  if (!employee) return <div className="py-12 text-center text-stone-400">ไม่พบข้อมูลพนักงาน</div>;

  return (
    <DirectionalTransition>
      <div className="max-w-[1000px] mx-auto pb-12 space-y-6">
        {/* Back Link */}
        <Link href="/app/hr/employees" transitionTypes={['nav-back']} className="inline-flex items-center gap-1.5 text-[13px] text-stone-400 hover:text-stone-700 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          พนักงานทั้งหมด
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[14px] bg-stone-900 text-white flex items-center justify-center text-2xl font-bold uppercase">
              {employee.name_en.slice(0, 2)}
            </div>
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight text-stone-950">{employee.name_th}</h1>
              <h2 className="text-[16px] text-stone-500 -mt-1">{employee.name_en}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[13px] font-mono text-stone-500">{employee.employee_id || 'ไม่มีรหัส'}</span>
                <span className="text-stone-300">·</span>
                <span className="text-[13px] text-stone-500">{employee.department_name_th || 'ไม่ระบุแผนก'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && !isEditing && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="h-8 px-4 rounded-[7px] border border-red-200 bg-red-50 text-[13px] font-medium text-red-600 hover:bg-red-100 transition-colors shadow-sm disabled:opacity-50"
              >
                ลบพนักงาน
              </button>
            )}
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="h-8 px-4 rounded-[7px] border border-stone-200 bg-white text-[13px] font-medium text-stone-600 hover:bg-stone-50 transition-colors shadow-sm"
              >
                แก้ไขข้อมูล
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200 gap-6">
          {[
            { id: 'info', label: 'ข้อมูลพื้นฐาน' },
            { id: 'leave', label: 'วันลา' },
            { id: 'attendance', label: 'การเข้างาน' },
            { id: 'payroll', label: 'เงินเดือน' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as 'info' | 'leave' | 'attendance' | 'payroll')}
              className={`pb-3 text-[14px] font-medium transition-colors relative ${
                tab === t.id ? 'text-stone-950' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {t.label}
              {tab === t.id && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-stone-950 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'info' && (
          <div className={CARD}>
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                {/* Profile Section */}
                <div className="space-y-4">
                  <h3 className="text-[14px] font-semibold text-stone-950">ข้อมูลส่วนตัว</h3>
                  <div className="space-y-3">
                    <InfoRow label="ชื่อ - นามสกุล (ไทย)" value={employee.name_th} />
                    <InfoRow label="Full Name (EN)" value={employee.name_en} />
                    <InfoRow label="อีเมล" value={employee.email} />
                    <InfoRow label="เบอร์โทรศัพท์" value={employee.phone || '—'} 
                      editing={isEditing} 
                      content={<input className="w-full border rounded px-2 py-1" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} />}
                    />
                    <InfoRow label="รหัสพนักงาน" value={employee.employee_id || '—'} 
                      editing={isEditing}
                      content={<input className="w-full border rounded px-2 py-1" value={form.employee_id || ''} onChange={e => setForm({...form, employee_id: e.target.value})} />}
                    />
                  </div>
                </div>

                {/* Employment Section */}
                <div className="space-y-4">
                  <h3 className="text-[14px] font-semibold text-stone-950">การจ้างงาน</h3>
                  <div className="space-y-3">
                    <InfoRow label="แผนก" value={employee.department_name_th || '—'} 
                      editing={isEditing}
                      content={
                        <select className="w-full border rounded px-2 py-1" value={form.department_id || ''} onChange={e => setForm({...form, department_id: e.target.value})}>
                          <option value="">เลือกแผนก</option>
                          {departments.map(d => <option key={d.id} value={d.id}>{d.name_th}</option>)}
                        </select>
                      }
                    />
                    <InfoRow label="ตำแหน่ง" value={employee.position_name_th || '—'} 
                      editing={isEditing}
                      content={
                        <select className="w-full border rounded px-2 py-1" value={form.position_id || ''} onChange={e => setForm({...form, position_id: e.target.value})}>
                          <option value="">เลือกตำแหน่ง</option>
                          {positions.filter(p => !form.department_id || p.department_id === form.department_id).map(p => <option key={p.id} value={p.id}>{p.name_th}</option>)}
                        </select>
                      }
                    />
                    <InfoRow label="ระดับเงินเดือน" value={employee.salary_grade_name || '—'} 
                      editing={isEditing}
                      content={
                        <select className="w-full border rounded px-2 py-1" value={form.salary_grade_id || ''} onChange={e => setForm({...form, salary_grade_id: e.target.value})}>
                          <option value="">เลือกระดับ</option>
                          {salaryGrades.map(sg => <option key={sg.id} value={sg.id}>{sg.name_th}</option>)}
                        </select>
                      }
                    />
                    <InfoRow label="เงินเดือนพื้นฐาน" value={employee.base_salary ? formatCurrency(employee.base_salary) : '—'} 
                      editing={isEditing}
                      content={<input type="number" className="w-full border rounded px-2 py-1" value={form.base_salary || 0} onChange={e => setForm({...form, base_salary: parseFloat(e.target.value)})} />}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-6 border-t border-stone-100">
                 <div className="space-y-3">
                    <InfoRow label="ประเภทการจ้าง" value={employee.employment_type.replace('_', ' ')} uppercase
                      editing={isEditing}
                      content={
                        <select className="w-full border rounded px-2 py-1" value={form.employment_type} onChange={e => setForm({...form, employment_type: e.target.value as HrEmployee['employment_type']})}>
                          <option value="full_time">Full Time</option>
                          <option value="part_time">Part Time</option>
                          <option value="contract">Contract</option>
                        </select>
                      }
                    />
                    <InfoRow label="สถานะพนักงาน" value={employee.employee_status} uppercase
                      editing={isEditing}
                      content={
                        <select className="w-full border rounded px-2 py-1" value={form.employee_status} onChange={e => setForm({...form, employee_status: e.target.value as HrEmployee['employee_status']})}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="resigned">Resigned</option>
                        </select>
                      }
                    />
                 </div>
                 <div className="space-y-3">
                    <InfoRow label="วันที่เริ่มงาน" value={employee.hired_date ? formatDate(employee.hired_date) : '—'} 
                      editing={isEditing}
                      content={<input type="date" className="w-full border rounded px-2 py-1" value={form.hired_date || ''} onChange={e => setForm({...form, hired_date: e.target.value})} />}
                    />
                    {employee.employee_status === 'resigned' && (
                      <InfoRow label="วันที่ลาออก" value={employee.resignation_date ? formatDate(employee.resignation_date) : '—'} 
                        editing={isEditing}
                        content={<input type="date" className="w-full border rounded px-2 py-1" value={form.resignation_date || ''} onChange={e => setForm({...form, resignation_date: e.target.value})} />}
                      />
                    )}
                 </div>
              </div>

              {isEditing && (
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-stone-100">
                  {error && <p className="text-red-500 text-[13px] mr-auto">{error}</p>}
                  <button
                    onClick={() => { setIsEditing(false); setForm(employee); setError(''); }}
                    disabled={saving}
                    className="h-8 px-4 rounded-[7px] border border-stone-200 text-[13px] font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-8 px-4 rounded-[7px] bg-stone-950 text-white text-[13px] font-medium hover:bg-stone-800 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content Placeholder */}
        {tab !== 'info' && (
          <div className={CARD}>
            <div className="p-12 text-center space-y-3">
               <h3 className="text-[16px] font-medium text-stone-950">
                 {tab === 'leave' ? 'ข้อมูลการลา' : tab === 'attendance' ? 'ข้อมูลการเข้างาน' : 'ข้อมูลเงินเดือน'}
               </h3>
               <p className="text-[13.5px] text-stone-500">
                 จะแสดงข้อมูลสรุปของ {employee.name_th} ในเร็วๆ นี้
               </p>
            </div>
          </div>
        )}
      </div>
    </DirectionalTransition>
  );
}

function InfoRow({ label, value, editing, content, uppercase }: { label: string; value: string; editing?: boolean; content?: React.ReactNode; uppercase?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-stone-400">{label}</span>
      {editing && content ? (
        content
      ) : (
        <span className={`text-[14px] text-stone-900 ${uppercase ? 'uppercase' : ''}`}>{value}</span>
      )}
    </div>
  );
}
