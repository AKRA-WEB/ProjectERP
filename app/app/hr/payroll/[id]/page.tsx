'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import React, { useState, useEffect, use, useMemo, useCallback } from 'react';
import { get, patch } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import type { PayrollRun, PayrollLine } from '@/types';

// --- Local Components ---

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

function KpiCard({ label, value, sub, accent = 'text-stone-900' }: { label: string; value: string | number; sub: string; accent?: string }) {
  return (
    <div className="flex-1 px-5 py-4 border-r border-stone-100 last:border-r-0 text-center sm:text-left">
      <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">{label}</div>
      <div className={`text-[20px] font-bold mt-0.5 ${accent}`}>{value}</div>
      <div className="text-[11px] text-stone-400 mt-0.5">{sub}</div>
    </div>
  );
}

const STEPS = [
  { key: 'draft',      label: 'ร่าง',      sub: 'รวบรวมข้อมูล' },
  { key: 'processing', label: 'ตรวจสอบ',  sub: 'ตรวจรายการ' },
  { key: 'approved',   label: 'อนุมัติ',   sub: 'ผู้บริหารเซ็น' },
  { key: 'paid',       label: 'จ่ายแล้ว',  sub: 'โอนเงิน' },
];

// --- Main Page ---

export default function PayrollRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { lang } = useLanguage();
  const [run, setRun] = useState<PayrollRun & { lines: PayrollLine[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [search, setSearch] = useState('');
  const [otOnly, setOtOnly] = useState(false);
  
  const fetchRun = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<PayrollRun & { lines: PayrollLine[] }>(`/api/hr/payroll-runs/${id}`);
      setRun(res);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchRun(); }, [fetchRun]);

  const handleAction = async (action: string) => {
    setActing(true);
    try {
      await patch(`/api/hr/payroll-runs/${id}`, { action });
      fetchRun();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setActing(false); }
  };

  const filteredLines = useMemo(() => {
    if (!run?.lines) return [];
    return run.lines.filter(l => {
      const matchesSearch = l.employee_name_th.toLowerCase().includes(search.toLowerCase()) || 
                           (l.employee_id_code || '').toLowerCase().includes(search.toLowerCase());
      const matchesOt = otOnly ? l.ot_pay > 0 : true;
      return matchesSearch && matchesOt;
    });
  }, [run?.lines, search, otOnly]);

  if (loading || !run) {
    return <div className="p-8 text-stone-400 text-sm">กำลังโหลด...</div>;
  }

  const stepIdx = STEPS.findIndex((s) => s.key === run.status);
  const totals = {
    base: filteredLines.reduce((s, l) => s + l.base_salary, 0),
    ot: filteredLines.reduce((s, l) => s + l.ot_pay, 0),
    gross: filteredLines.reduce((s, l) => s + l.gross_pay, 0),
    sso: filteredLines.reduce((s, l) => s + l.sso_employee, 0),
    tax: filteredLines.reduce((s, l) => s + l.income_tax, 0),
    net: filteredLines.reduce((s, l) => s + l.net_pay, 0),
  };

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[26px] font-semibold tracking-tight text-stone-900">
              งวดเดือน {run.period_month}/{run.period_year}
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-[12px] font-bold border uppercase tracking-wider
              ${run.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                run.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                run.status === 'processing' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-stone-50 text-stone-600 border-stone-200'}`}>
              {run.status}
            </span>
          </div>
          <p className="text-[13.5px] text-stone-500 font-mono mt-1 uppercase">{run.run_number}</p>
        </div>
        <div className="flex gap-2">
          {run.status === 'draft' && (
            <button
              onClick={() => handleAction('submit_review')}
              disabled={acting}
              className="h-9 px-4 rounded-md text-[13.5px] font-bold text-white bg-stone-900 hover:bg-stone-800 transition-colors"
            >
              ส่งให้ผู้จัดการตรวจสอบ
            </button>
          )}
          {run.status === 'processing' && (
            <button
              onClick={() => handleAction('approve')}
              disabled={acting}
              className="h-9 px-4 rounded-md text-[13.5px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              ส่งให้ผู้บริหารอนุมัติ
            </button>
          )}
          {run.status === 'approved' && (
            <button
              onClick={() => handleAction('post_to_accounting')}
              disabled={acting}
              className="h-9 px-4 rounded-md text-[13.5px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
            >
              ยืนยันการจ่ายเงิน (GL)
            </button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm p-5">
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((s, i) => {
            const done = i < stepIdx || run.status === 'paid';
            const current = i === stepIdx && run.status !== 'paid';
            return (
              <div key={s.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full grid place-items-center text-[12px] font-bold border-2 transition-colors ${
                    done ? 'bg-stone-900 border-stone-900 text-white' :
                    current ? 'bg-white border-stone-900 text-stone-900' :
                    'bg-white border-stone-200 text-stone-400'
                  }`}>
                    {done ? '✓' : i + 1}
                  </div>
                  {i < STEPS.length - 1 && <div className={`w-px h-6 my-1 ${done ? 'bg-stone-900' : 'bg-stone-200'}`} />}
                </div>
                <div>
                  <div className={`text-[13.5px] font-bold ${current ? 'text-stone-900' : done ? 'text-stone-700' : 'text-stone-400'}`}>{s.label}</div>
                  <div className="text-[11.5px] text-stone-400 font-medium">{s.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="flex bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
        <KpiCard label="ยอดรวม (Gross)" value={formatCurrency(run.total_gross, lang)} sub={`${run.lines.length} พนักงาน`} />
        <KpiCard label="ประกันสังคม (5%)" value={formatCurrency(run.total_sso_emp, lang)} sub="หักจากพนักงาน" />
        <KpiCard label="กองทุนสำรองฯ" value={formatCurrency(0, lang)} sub="—" />
        <KpiCard label="ภาษีหัก ณ ที่จ่าย" value={formatCurrency(run.total_tax, lang)} sub="ภ.ง.ด.1" />
        <KpiCard label="ยอดสุทธิ (Net)" value={formatCurrency(run.total_net, lang)} accent="text-emerald-700" sub="ยอดโอนจริง" />
      </div>

      {/* Table Section */}
      <div className="bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/30">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-stone-900 text-[15px]">รายละเอียดรายบุคคล</h2>
            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-md px-2 py-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                placeholder="ค้นพนักงาน..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-0 outline-none text-[12.5px] w-40"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={otOnly} onChange={(e) => setOtOnly(e.target.checked)} className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900" />
              <span className="text-[12.5px] text-stone-600 font-medium">เฉพาะผู้มี OT</span>
            </label>
          </div>
          <span className="text-[12px] text-stone-400 font-medium">แสดง {filteredLines.length} จาก {run.lines.length} รายการ</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                <th className="px-5 py-3">พนักงาน</th>
                <th className="px-5 py-3 text-right">ฐานเดือน</th>
                <th className="px-5 py-3 text-right">OT</th>
                <th className="px-5 py-3 text-right">เบี้ยเลี้ยง</th>
                <th className="px-5 py-3 text-right text-stone-900">Gross</th>
                <th className="px-5 py-3 text-right">SSO</th>
                <th className="px-5 py-3 text-right">ภาษี</th>
                <th className="px-5 py-3 text-right text-emerald-700 font-bold">Net Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filteredLines.map((l) => (
                <tr key={l.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={l.employee_name_th} size={28} />
                      <div>
                        <div className="text-[13px] font-medium text-stone-900">{l.employee_name_th}</div>
                        <div className="text-[10.5px] text-stone-400 font-mono uppercase">{l.employee_id_code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] text-stone-600">{formatCurrency(l.base_salary, lang)}</td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] text-stone-500">{l.ot_pay > 0 ? formatCurrency(l.ot_pay, lang) : '—'}</td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] text-stone-500">—</td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] font-bold text-stone-900">{formatCurrency(l.gross_pay, lang)}</td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] text-red-600">−{formatCurrency(l.sso_employee, lang)}</td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] text-red-600">{l.income_tax > 0 ? `−${formatCurrency(l.income_tax, lang)}` : '—'}</td>
                  <td className="px-5 py-3 text-right font-mono text-[13px] font-bold text-emerald-700 bg-emerald-50/30">{formatCurrency(l.net_pay, lang)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-stone-50 font-bold text-stone-900 border-t-2 border-stone-200">
              <tr>
                <td className="px-5 py-4 text-[13px]">รวมสุทธิ ({filteredLines.length} คน)</td>
                <td className="px-5 py-4 text-right font-mono text-[13px]">{formatCurrency(totals.base, lang)}</td>
                <td className="px-5 py-4 text-right font-mono text-[13px]">{formatCurrency(totals.ot, lang)}</td>
                <td className="px-5 py-4 text-right font-mono text-[13px]">—</td>
                <td className="px-5 py-4 text-right font-mono text-[13px]">{formatCurrency(totals.gross, lang)}</td>
                <td className="px-5 py-4 text-right font-mono text-[13px] text-red-700">−{formatCurrency(totals.sso, lang)}</td>
                <td className="px-5 py-4 text-right font-mono text-[13px] text-red-700">−{formatCurrency(totals.tax, lang)}</td>
                <td className="px-5 py-4 text-right font-mono text-[14px] text-emerald-700 bg-emerald-50">{formatCurrency(totals.net, lang)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      </div>
    </DirectionalTransition>
  );
}
