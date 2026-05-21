'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';
import type { JournalEntry, PaginatedResponse, FiscalPeriod } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function JournalEntriesPage() {
  const { lang } = useLanguage();
  const [data, setData] = useState<PaginatedResponse<JournalEntry> | null>(null);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [periodId, setPeriodId] = useState('');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status }),
        ...(periodId && { fiscal_period_id: periodId }),
      });
      const res = await get<PaginatedResponse<JournalEntry>>(`/api/accounting/journal-entries?${query}`);
      setData(res);
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    } finally {
      setLoading(false);
    }
  }, [page, status, periodId]);

  useEffect(() => {
    get<FiscalPeriod[]>('/api/accounting/fiscal-periods').then(setPeriods).catch(console.error);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">รายการบัญชี / Journal Entries</h1>
          <p className="text-stone-500 text-sm">บันทึกรายการสมุดรายวันทั่วไปและตรวจสอบสถานะ</p>
        </div>
        <Link href="/app/accounting/journal-entries/new">
          <Button>+ สร้างรายการ / New Entry</Button>
        </Link>
      </div>

      <div className={`${CARD} p-4 flex gap-4 items-end`}>
        <div className="w-48">
          <Select
            label="สถานะ / Status"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">ทั้งหมด / All</option>
            <option value="draft">ฉบับร่าง / Draft</option>
            <option value="posted">บันทึกแล้ว / Posted</option>
            <option value="void">ยกเลิก / Void</option>
          </Select>
        </div>
        <div className="w-64">
          <Select
            label="รอบบัญชี / Fiscal Period"
            value={periodId}
            onChange={(e) => { setPeriodId(e.target.value); setPage(1); }}
          >
            <option value="">ทั้งหมด / All</option>
            {periods.map(p => (
              <option key={p.id} value={p.id}>{lang === 'th' ? p.name_th : (p.name_en || p.name_th)}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className={CARD}>
        <Table
          loading={loading}
          headers={[
            'เลขที่ / JE No.',
            'วันที่ / Date',
            'คำอธิบาย / Description',
            'ประเภท / Type',
            'สถานะ / Status',
            'เดบิต / Debit',
            'เครดิต / Credit',
            '',
          ]}
        >
          {data?.data.map((je) => (
            <tr key={je.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-5 py-4 font-mono font-bold text-stone-900">{je.entry_number}</td>
              <td className="px-5 py-4 text-stone-600">
                {new Date(je.entry_date).toLocaleDateString('th-TH')}
              </td>
              <td className="px-5 py-4 text-stone-600 max-w-[250px] truncate">{je.description}</td>
              <td className="px-5 py-4 uppercase text-[10px] font-bold text-stone-600">{je.entry_type}</td>
              <td className="px-5 py-4"><StatusBadge status={je.status} /></td>
              <td className="px-5 py-4 font-mono text-right font-bold">{formatCurrency(je.total_debit)}</td>
              <td className="px-5 py-4 font-mono text-right font-bold">{formatCurrency(je.total_credit)}</td>
              <td className="px-5 py-4 text-right">
                <Link href={`/app/accounting/journal-entries/${je.id}`}>
                  <Button variant="outline" size="sm">รายละเอียด</Button>
                </Link>
              </td>
            </tr>
          ))}
          {data?.data.length === 0 && !loading && (
            <tr><td colSpan={8} className="px-5 py-12 text-center text-stone-600 italic">ไม่พบรายการบัญชี</td></tr>
          )}
        </Table>

        {data && data.total_pages > 1 && (
          <div className="px-5 py-4 border-t border-stone-100">
            <Pagination
              currentPage={page}
              totalPages={data.total_pages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
