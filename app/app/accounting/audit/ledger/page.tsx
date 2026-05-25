'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Account } from '@/types';
import Link from 'next/link';

interface LedgerLine {
  id: string;
  debit_amount: string | number;
  credit_amount: string | number;
  line_number: number;
  description: string;
  entry_number: string;
  entry_date: string;
  entry_description: string;
  entry_type: string;
  account_code: string;
  account_name_th: string;
  account_name_en: string;
}

interface PaginatedLedger {
  ledger_lines: LedgerLine[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export default function AuditLedgerPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [accountId, setAccountId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    get<Account[]>('/api/accounting/accounts').then(setAccounts).catch(console.error);
  }, []);

  const fetchLedger = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '50',
      });
      if (accountId) params.set('account_id', accountId);
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);

      const res = await get<PaginatedLedger>(`/api/accounting/audit/ledger?${params}`);
      setLines(res.ledger_lines);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.total_pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [accountId, fromDate, toDate]);

  useEffect(() => {
    fetchLedger(1);
  }, [fetchLedger]);

  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-widest">Auditor Access</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">สมุดบัญชีแยกประเภท (สำหรับผู้ตรวจสอบ) / Audit General Ledger</h1>
          <p className="text-stone-500 text-sm mt-0.5">ตรวจสอบทุกรายการเคลื่อนไหวทางบัญชีแบบแยกประเภทอย่างละเอียด</p>
        </div>
        <Link href="/app/dashboard" className="h-8 px-3 rounded-lg text-xs font-medium text-stone-600 bg-stone-50 border border-stone-200 hover:bg-stone-100 flex items-center gap-1.5">
          ← กลับหน้าแดชบอร์ด
        </Link>
      </div>

      {/* Filter panel */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-stone-600 uppercase mb-1.5">รหัสหรือชื่อบัญชี / Select Account</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          >
            <option value="">ทั้งหมด / All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.account_code} — {a.name_th}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-600 uppercase mb-1.5">ตั้งแต่วันที่ / From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-600 uppercase mb-1.5">ถึงวันที่ / To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          />
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
          <span className="text-xs text-stone-500 font-semibold">
            พบลำดับรายการเคลื่อนไหวทั้งหมด {total.toLocaleString('th-TH')} รายการ
          </span>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-stone-200 text-stone-600 bg-stone-50/70 font-semibold">
              <th className="py-3 px-4">วันที่ / Date</th>
              <th className="py-3 px-4">เลขที่ใบสำคัญ / JE No.</th>
              <th className="py-3 px-4">ประเภทบัญชี / Code & Account</th>
              <th className="py-3 px-4">รายละเอียด / Memo</th>
              <th className="py-3 px-4 text-right">เดบิต / Debit</th>
              <th className="py-3 px-4 text-right">เครดิต / Credit</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-stone-400 italic">กำลังดึงข้อมูลสมุดบัญชีแยกประเภท...</td></tr>
            ) : lines.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-stone-400 italic">ไม่พบบันทึกการเคลื่อนไหวทางบัญชีตามตัวกรองที่เลือก</td></tr>
            ) : lines.map((line) => (
              <tr key={line.id} className="border-b border-stone-100 hover:bg-stone-50/30 transition-colors">
                <td className="py-3.5 px-4 text-stone-500 font-mono">{formatDate(line.entry_date)}</td>
                <td className="py-3.5 px-4 font-mono font-bold text-stone-900">
                  <Link href={`/app/accounting/journal-entries/${line.id}`} className="hover:underline text-blue-600">
                    {line.entry_number}
                  </Link>
                </td>
                <td className="py-3.5 px-4">
                  <div className="font-semibold text-stone-800">{line.account_code}</div>
                  <div className="text-[11px] text-stone-500">{line.account_name_th}</div>
                </td>
                <td className="py-3.5 px-4 text-stone-600 max-w-xs truncate" title={line.description || line.entry_description}>
                  {line.description || line.entry_description}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-900">
                  {Number(line.debit_amount) > 0 ? formatCurrency(line.debit_amount) : '—'}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                  {Number(line.credit_amount) > 0 ? formatCurrency(line.credit_amount) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500 bg-stone-50/20">
            <span>หน้า {page} จาก {totalPages}</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => fetchLedger(page - 1)}
                disabled={page === 1}
                className="h-8 px-3 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                ← ก่อนหน้า
              </button>
              <button
                onClick={() => fetchLedger(page + 1)}
                disabled={page === totalPages}
                className="h-8 px-3 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                ถัดไป →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
