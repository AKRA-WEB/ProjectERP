'use client';

import { useState, useEffect, use } from 'react';
import { get, patch } from '@/lib/api-client';
import type { PayrollRun } from '@/types';
import { Button, StatusBadge } from '@/components/ui';
import { formatCurrency } from '@/lib/format';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function PayrollRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const res = await get<PayrollRun>(`/api/hr/payroll-runs/${id}`);
        setRun(res);
      } finally { setLoading(false); }
    }
    fetch();
  }, [id]);

  async function handleAction(action: string) {
    setActing(true);
    try {
      await patch(`/api/hr/payroll-runs/${id}`, { action });
      const updated = await get<PayrollRun>(`/api/hr/payroll-runs/${id}`);
      setRun(updated);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setActing(false); }
  }

  if (loading) return <div className="py-12 text-center text-stone-400">กำลังโหลด...</div>;
  if (!run) return <div className="py-12 text-center text-stone-400">ไม่พบข้อมูล</div>;

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-semibold tracking-tight text-stone-950">Payroll Run: {run.period_month}/{run.period_year}</h1>
            <StatusBadge status={run.status} />
          </div>
          <p className="text-[14px] text-stone-500 font-mono mt-1 uppercase">{run.run_number}</p>
        </div>
        <div className="flex gap-2">
          {run.status === 'draft' && (
            <Button onClick={() => handleAction('approve')} loading={acting}>อนุมัติข้อมูล</Button>
          )}
          {run.status === 'approved' && (
            <Button onClick={() => handleAction('post_to_accounting')} loading={acting}>ลงบันทึกบัญชี (GL)</Button>
          )}
          {run.status === 'paid' && run.journal_entry_id && (
            <div className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 text-emerald-700 text-[13px] font-medium">
              ลงบัญชีเรียบร้อยแล้ว (GL)
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="ยอดรวมเงินเดือน (Gross)" value={run.total_gross} />
        <StatCard label="ยอดรวมจ่ายสุทธิ (Net)" value={run.total_net} />
        <StatCard label="ประกันสังคม (พนักงาน)" value={run.total_sso_emp} />
        <StatCard label="ภาษีหัก ณ ที่จ่าย" value={run.total_tax} />
      </div>

      <div className={CARD}>
        <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-stone-950">รายละเอียดรายบุคคล</h3>
          <span className="text-[12px] text-stone-500">{run.lines?.length || 0} คน</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="text-left py-2 px-4">พนักงาน</th>
                <th className="text-right py-2 px-4">เงินเดือนพื้นฐาน</th>
                <th className="text-right py-2 px-4">OT</th>
                <th className="text-right py-2 px-4 text-emerald-600">รวมรายรับ</th>
                <th className="text-right py-2 px-4 text-red-600">ประกันสังคม</th>
                <th className="text-right py-2 px-4 text-red-600">ภาษี</th>
                <th className="text-right py-2 px-4 font-bold text-stone-900">สุทธิ (Net)</th>
              </tr>
            </thead>
            <tbody>
              {run.lines?.map((l) => (
                <tr key={l.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-stone-900">{l.employee_name_th}</div>
                    <div className="text-[10px] text-stone-400 font-mono">{l.employee_name_en} ({l.employee_id_code})</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(l.base_salary)}</td>
                  <td className="py-3 px-4 text-right font-mono">{l.ot_pay > 0 ? formatCurrency(l.ot_pay) : '—'}</td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-emerald-700">{formatCurrency(l.gross_pay)}</td>
                  <td className="py-3 px-4 text-right font-mono text-red-600">{formatCurrency(l.sso_employee)}</td>
                  <td className="py-3 px-4 text-right font-mono text-red-600">{l.income_tax > 0 ? formatCurrency(l.income_tax) : '—'}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-stone-950">{formatCurrency(l.net_pay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string, value: number }) {
  return (
    <div className="bg-white border border-stone-200 p-4 rounded-[10px]">
      <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{label}</p>
      <p className="text-[20px] font-bold text-stone-950 mt-1">{formatCurrency(value)}</p>
    </div>
  );
}
