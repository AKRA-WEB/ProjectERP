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
import type { SalesInvoice, PaginatedResponse } from '@/types';
import { DirectionalTransition } from '@/components/ui/directional-transition';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function SalesInvoicesPage() {
  const [data, setData] = useState<PaginatedResponse<SalesInvoice> | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status }),
      });
      const res = await get<PaginatedResponse<SalesInvoice>>(`/api/sales-invoices?${query}`);
      setData(res);
    } catch (error) {
      console.error('Failed to fetch sales invoices:', error);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">ใบแจ้งหนี้ / Sales Invoices</h1>
            <p className="text-stone-500 text-sm">รายการเรียกเก็บเงินและติดตามสถานะการชำระเงิน</p>
          </div>
          <Link href="/app/sales-invoices/new" transitionTypes={['nav-forward']}>
            <Button>+ สร้างใบแจ้งหนี้ / New Invoice</Button>
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
              <option value="issued">ออกเอกสารแล้ว / Issued</option>
              <option value="paid">ชำระเงินแล้ว / Paid</option>
              <option value="void">ยกเลิก / Void</option>
            </Select>
          </div>
        </div>

        <div className={CARD}>
          <Table
            loading={loading}
            headers={[
              'เลขที่ / Inv No.',
              'ลูกค้า / Customer',
              'อ้างอิง SO / SO Ref',
              'สถานะ / Status',
              'วันที่ออก / Date',
              'ครบกำหนด / Due Date',
              'ยอดรวม / Total',
              '',
            ]}
          >
            {data?.data.map((si) => (
              <tr key={si.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-5 py-4 font-mono font-bold text-stone-900">{si.si_number}</td>
                <td className="px-5 py-4 text-stone-600">{si.customer_name_th}</td>
                <td className="px-5 py-4 font-mono text-stone-600">
                  {si.so_number}
                  {si.do_number && <span className="block text-xs text-stone-400">DO: {si.do_number}</span>}
                </td>
                <td className="px-5 py-4"><StatusBadge status={si.status} /></td>
                <td className="px-5 py-4 text-sm text-stone-600">
                  {new Date(si.invoice_date).toLocaleDateString('th-TH')}
                </td>
                <td className="px-5 py-4 text-sm text-stone-600 font-medium">
                  {new Date(si.due_date).toLocaleDateString('th-TH')}
                </td>
                <td className="px-5 py-4 font-mono font-bold text-right">
                  {formatCurrency(si.total_amount)}
                </td>
                <td className="px-5 py-4 text-right">
                  <Link href={`/app/sales-invoices/${si.id}`} transitionTypes={['nav-forward']}>
                    <Button variant="outline" size="sm">รายละเอียด</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {data?.data.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-stone-500">ไม่พบใบแจ้งหนี้</td></tr>
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
    </DirectionalTransition>
  );
}
