'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api-client';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useT, useLanguage, localeName } from '@/lib/i18n';
import { Pagination } from '@/components/ui/Pagination';
import { useSession } from 'next-auth/react';
import type { HrEmployee, Department, EmployeeStatus, SessionUser } from '@/types';
import EmployeeFormModal from './EmployeeFormModal';

// --- Local Types & Components ---

interface ExtendedHrEmployee extends HrEmployee {
  branch_name: string | null;
  hire_date: string | null;
}

const AVATAR_PALETTE = [
  { bg: '#fde68a', txt: '#92400e' }, { bg: '#bbf7d0', txt: '#14532d' },
  { bg: '#bfdbfe', txt: '#1e3a8a' }, { bg: '#fecaca', txt: '#7f1d1d' },
  { bg: '#e9d5ff', txt: '#581c87' }, { bg: '#fed7aa', txt: '#7c2d12' },
  { bg: '#cffafe', txt: '#164e63' }, { bg: '#fce7f3', txt: '#831843' },
];

function nameToColor(name: string) {
  if (!name) return AVATAR_PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function nameToInitials(name: string) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const { bg, txt } = nameToColor(name);
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-[11px] shrink-0"
      style={{ backgroundColor: bg, color: txt, width: size, height: size }}
    >
      {nameToInitials(name)}
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
  if (years > 0) return `${years} ปี ${months} ด.`;
  return `${months} เดือน`;
}

interface PaginatedEmployees {
  data: ExtendedHrEmployee[];
  total: number;
  page: number;
  limit: number;
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function EmployeesPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<PaginatedEmployees | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const t = useT();
  const { lang } = useLanguage();
  const user = session?.user as unknown as SessionUser;
  const canSeeSalary = user?.role === 'admin' || user?.role === 'manager';

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ 
        page: String(page),
        pageSize: String(pageSize)
      });
      if (search) params.set('search', search);
      if (deptFilter) params.set('department_id', deptFilter);
      if (statusFilter) params.set('employee_status', statusFilter);
      
      const res = await get<PaginatedEmployees>(`/api/hr/employees?${params}`);
      setData(res);
    } finally { setLoading(false); }
  }, [page, pageSize, search, deptFilter, statusFilter]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  
  useEffect(() => {
    get<Department[]>('/api/hr/departments').then(setDepartments);
  }, []);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tight text-stone-900">
            {t('page.employees')}
          </h1>
          <p className="text-[13.5px] text-stone-500 mt-1">
            {loading ? '—' : formatNumber(data?.total ?? 0, lang)} {t('label.employee')} ในระบบ
          </p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'admin' && (
            <button className="h-9 px-3.5 rounded-md text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50">
              นำเข้าข้อมูล
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white bg-stone-900 hover:bg-stone-800 inline-flex items-center gap-1.5"
          >
            + {t('action.create')}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-stone-50/50 p-1.5 rounded-xl border border-stone-100">
        <div className="flex items-center gap-2 w-full max-w-[280px] bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-stone-400 focus-within:border-stone-400 transition-colors">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
            <path d="M14.5 14.5L10.5 10.5M12 6.5C12 9.53757 9.53757 12 6.5 12C3.46243 12 1 9.53757 1 6.5C1 3.46243 3.46243 1 6.5 1C9.53757 1 12 3.46243 12 6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            placeholder={t('label.search_placeholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 bg-transparent border-0 outline-none text-stone-700 placeholder:text-stone-400 text-[13.5px]"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-lg border border-stone-200 bg-white text-[13px] text-stone-700 outline-none hover:border-stone-300"
        >
          <option value="">ทุกแผนก</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{localeName(d.name_th, d.name_en, lang)}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as EmployeeStatus | ''); setPage(1); }}
          className="h-9 px-3 rounded-lg border border-stone-200 bg-white text-[13px] text-stone-700 outline-none hover:border-stone-300"
        >
          <option value="">ทุกสถานะ</option>
          <option value="active">{t('status.active')}</option>
          <option value="inactive">{t('status.inactive')}</option>
          <option value="resigned">พ้นสภาพ</option>
        </select>

        <div className="ml-auto text-[12px] text-stone-400 font-medium px-2">
          หน้า {page} จาก {totalPages || 1}
        </div>
      </div>

      {/* Employees Table */}
      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr className="text-[10.5px] font-semibold text-stone-500 uppercase tracking-wider">
                <th className="px-5 py-3">พนักงาน</th>
                <th className="px-5 py-3">แผนก / สาขา</th>
                <th className="px-5 py-3">อายุงาน</th>
                {canSeeSalary && <th className="px-5 py-3">เงินเดือน</th>}
                <th className="px-5 py-3">สถานะ</th>
                <th className="px-5 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {loading ? (
                <tr><td colSpan={canSeeSalary ? 6 : 5} className="py-24 text-center text-[13.5px] text-stone-400">กำลังโหลด...</td></tr>
              ) : data?.data.length === 0 ? (
                <tr><td colSpan={canSeeSalary ? 6 : 5} className="py-24 text-center text-[13.5px] text-stone-400">ไม่พบข้อมูลพนักงาน</td></tr>
              ) : data?.data.map((emp) => (
                <tr key={emp.id} className="hover:bg-stone-50/60 transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={emp.name_th} size={32} />
                      <div>
                        <div className="text-[13.5px] font-medium text-stone-900">{emp.name_th}</div>
                        <div className="text-[11px] text-stone-400 uppercase font-mono tracking-tighter">{emp.employee_id} · {emp.position_name_th}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-[13px] text-stone-700 font-medium">{emp.department_name_th || '—'}</div>
                    <div className="text-[11px] text-stone-500">{emp.branch_name || '—'}</div>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-stone-600">
                    {getTenure(emp.hire_date)}
                  </td>
                  {canSeeSalary && (
                    <td className="px-5 py-3 font-mono text-[13px] text-stone-900 font-medium">
                      {formatCurrency(emp.base_salary)}
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium border
                      ${emp.employee_status === 'active' ? 'bg-green-50 text-green-700 border-green-100' : 
                        emp.employee_status === 'inactive' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                        'bg-stone-50 text-stone-500 border-stone-200'}`}>
                      {emp.employee_status === 'active' ? 'กำลังทำงาน' : emp.employee_status === 'inactive' ? 'ระงับงาน' : 'พ้นสภาพ'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/app/hr/employees/${emp.id}`}
                      className="w-8 h-8 rounded-full border border-transparent hover:border-stone-200 hover:bg-white flex items-center justify-center text-stone-300 hover:text-stone-900 transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.total > data.limit && (
          <div className="px-5 py-4 border-t border-stone-100">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              limit={pageSize}
              onLimitChange={setPageSize}
            />
          </div>
        )}
      </div>

      {showForm && (
        <EmployeeFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            fetchEmployees();
          }}
        />
      )}
    </div>
  );
}
