'use client';

import { useState, useEffect, useCallback } from 'react';
import { get, post } from '@/lib/api-client';
import type { PayrollRun } from '@/types';
import Link from 'next/link';
import { Button, StatusBadge, Modal, ModalHeader, ModalBody, ModalFooter, Input } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { Pagination } from '@/components/ui/Pagination';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

interface PaginatedPayrollRuns {
  data: PayrollRun[];
  total: number;
  page: number;
  limit: number;
}

export default function PayrollRunsPage() {
  const [data, setData] = useState<PaginatedPayrollRuns | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form, setForm] = useState({ period_month: new Date().getMonth() + 1, period_year: new Date().getFullYear() });
  const [saving, setSaving] = useState(false);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ 
        year: String(form.period_year),
        page: String(page),
        pageSize: String(pageSize)
      });
      const res = await get<PaginatedPayrollRuns>(`/api/hr/payroll-runs?${params}`);
      setData(res);
    } finally { setLoading(false); }
  }, [form.period_year, page, pageSize]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  async function handleCreate() {
    setSaving(true);
    try {
      await post('/api/hr/payroll-runs', form);
      setShowCreate(false);
      fetchRuns();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="max-w-[1200px] mx-auto pb-12 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-950">ประวัติการจ่ายเงินเดือน / Payroll</h1>
          <p className="text-[14px] text-stone-500">สรุปการจ่ายค่าจ้างรายเดือนและการส่งข้อมูลบัญชี</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/app/hr/payroll/settings" className="text-[13px] text-stone-500 hover:text-stone-950 transition-colors">
            ⚙️ ตั้งค่าบัญชี
          </Link>
          <Button onClick={() => setShowCreate(true)}>+ เริ่ม Payroll รอบใหม่</Button>
        </div>
      </div>

      <div className={CARD}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200 text-stone-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="text-left py-3 px-4">เลขที่</th>
              <th className="text-left py-3 px-4">ประจำรอบ</th>
              <th className="text-right py-3 px-4">ยอดรวม Gross</th>
              <th className="text-right py-3 px-4">ยอดรวม Net</th>
              <th className="text-center py-3 px-4">สถานะ</th>
              <th className="text-right py-3 px-4">ผู้ทำรายการ</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-stone-400">กำลังโหลด...</td></tr>
            ) : !data || data.data.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-stone-400">ไม่พบข้อมูล</td></tr>
            ) : data.data.map((r) => (
              <tr key={r.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors">
                <td className="py-4 px-4 font-mono font-medium text-stone-600">{r.run_number}</td>
                <td className="py-4 px-4 font-semibold text-stone-900">{r.period_month}/{r.period_year}</td>
                <td className="py-4 px-4 text-right font-mono">{formatCurrency(r.total_gross)}</td>
                <td className="py-4 px-4 text-right font-mono font-bold text-stone-900">{formatCurrency(r.total_net)}</td>
                <td className="py-4 px-4 text-center">
                  <StatusBadge status={r.status} />
                </td>
                <td className="py-4 px-4 text-right text-stone-500">{r.created_by_name_th || r.created_by_name_en}</td>
                <td className="py-4 px-4 text-right">
                  <Link href={`/app/hr/payroll/${r.id}`} className="text-stone-300 hover:text-emerald-600 transition-colors inline-flex h-8 w-8 items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          limit={pageSize}
          onLimitChange={setPageSize}
        />
      )}

      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)}>
          <ModalHeader>เริ่ม Payroll รอบใหม่</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">เดือน</label>
                <select 
                  className="w-full h-9 px-3 rounded-md border border-stone-200"
                  value={form.period_month}
                  onChange={e => setForm({...form, period_month: parseInt(e.target.value)})}
                >
                  {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{new Date(2024, m-1).toLocaleString('th-TH', {month: 'long'})}</option>
                  ))}
                </select>
              </div>
              <Input 
                label="ปี (ค.ศ.)" 
                type="number" 
                value={form.period_year} 
                onChange={e => setForm({...form, period_year: parseInt(e.target.value)})} 
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>ยกเลิก</Button>
            <Button onClick={handleCreate} loading={saving}>ตกลง</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
