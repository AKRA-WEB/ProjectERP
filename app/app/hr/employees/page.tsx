'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import type { HrEmployee, Department, EmployeeStatus } from '@/types';
import Link from 'next/link';
import { Pagination } from '@/components/ui/Pagination';
import { formatNumber } from '@/lib/format';
import { DirectionalTransition } from '@/components/ui/directional-transition';


const AVATAR_COLORS = [
  '#a78bfa', '#fb923c', '#22c55e', '#0ea5e9', '#f43f5e',
  '#f59e0b', '#6366f1', '#14b8a6', '#8b5cf6', '#ec4899',
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

interface PaginatedEmployees {
  data: HrEmployee[];
  total: number;
  page: number;
  limit: number;
}

export default function EmployeesPage() {
  const [data, setData] = useState<PaginatedEmployees | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | ''>('');
  const [loading, setLoading] = useState(true);

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

  const fetchDepts = async () => {
    const res = await get<Department[]>('/api/hr/departments');
    setDepartments(res);
  };

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { fetchDepts(); }, []);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5">

        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              พนักงาน / Employees
            </h1>
            <p className="text-[13.5px] text-stone-500">
              {loading ? '—' : formatNumber(data?.total ?? 0)} คน
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 w-full max-w-[240px] bg-stone-50 border border-stone-200 rounded-[8px] px-3 py-[6px] text-stone-400 text-[13px] focus-within:border-stone-300 focus-within:bg-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              placeholder="ค้นหาชื่อ, รหัส, อีเมล..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="flex-1 bg-transparent border-0 outline-none text-stone-700 placeholder:text-stone-400 text-[13px]"
            />
          </div>

          {/* Dept Filter */}
          <select
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            className="h-8 px-3 rounded-[8px] border border-stone-200 bg-stone-50 text-[13px] text-stone-700 outline-none focus:bg-white transition-colors"
          >
            <option value="">ทุกแผนก</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name_th}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as EmployeeStatus | ''); setPage(1); }}
            className="h-8 px-3 rounded-[8px] border border-stone-200 bg-stone-50 text-[13px] text-stone-700 outline-none focus:bg-white transition-colors"
          >
            <option value="">ทุกสถานะ</option>
            <option value="active">ใช้งาน (Active)</option>
            <option value="inactive">พักงาน (Inactive)</option>
            <option value="resigned">ลาออก (Resigned)</option>
          </select>
        </div>

        {/* Table card */}
        <div className={CARD}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {[
                    { h: 'พนักงาน',    sm: false },
                    { h: 'รหัสพนักงาน', sm: false },
                    { h: 'แผนก',       sm: true },
                    { h: 'ตำแหน่ง',    sm: true },
                    { h: 'ประเภทการจ้าง', sm: true },
                    { h: 'สถานะ',      sm: false },
                    { h: '',           sm: false },
                  ].map(({ h, sm }, i) => (
                    <th key={i} className={`text-left py-2.5 px-3.5 text-[11.5px] font-medium tracking-[.04em] uppercase text-stone-400 bg-stone-50 border-y border-stone-200 first:pl-5 last:pr-5 ${sm ? 'hidden lg:table-cell' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-[13px] text-stone-400">กำลังโหลด...</td></tr>
                ) : data?.data.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-[13px] text-stone-400">ไม่พบข้อมูลพนักงาน</td></tr>
                ) : data?.data.map((v: HrEmployee) => {
                  const color = avatarColor(v.name_en);
                  return (
                    <tr key={v.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 cursor-default transition-colors">
                      <td className="py-0 h-12 px-3.5 pl-5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-6 h-6 rounded-[6px] shrink-0 grid place-items-center text-[11px] font-semibold uppercase"
                            style={{ background: color + '22', color }}
                          >
                            {v.name_en.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-medium text-stone-900">{v.name_th}</div>
                            <div className="text-[11.5px] text-stone-400">{v.name_en}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-0 h-12 px-3.5 font-mono text-[12.5px] text-stone-600">{v.employee_id || '—'}</td>
                      <td className="py-0 h-12 px-3.5 text-stone-500 hidden lg:table-cell">{v.department_name_th || '—'}</td>
                      <td className="py-0 h-12 px-3.5 text-stone-500 hidden lg:table-cell">{v.position_name_th || '—'}</td>
                      <td className="py-0 h-12 px-3.5 text-stone-500 hidden lg:table-cell uppercase text-[11px]">{v.employment_type.replace('_', ' ')}</td>
                      <td className="py-0 h-12 px-3.5">
                        <span className={`inline-flex items-center gap-[5px] px-2 py-[2px] text-[11.5px] font-medium rounded-full border leading-[1.5] before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-current 
                          ${v.employee_status === 'active' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 
                            v.employee_status === 'inactive' ? 'text-amber-700 border-amber-200 bg-amber-50' : 
                            'text-stone-500 border-stone-200 bg-stone-50'}`}>
                          {v.employee_status === 'active' ? 'ใช้งาน' : v.employee_status === 'inactive' ? 'พักงาน' : 'ลาออก'}
                        </span>
                      </td>
                      <td className="py-0 h-12 px-3.5 pr-5">
                        <Link href={`/app/hr/employees/${v.id}`} transitionTypes={['nav-forward']} className="text-stone-300 hover:text-emerald-600 transition-colors inline-flex h-8 w-8 items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {data && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            limit={pageSize}
            onLimitChange={setPageSize}
          />
        )}
      </div>
    </DirectionalTransition>
  );
}
