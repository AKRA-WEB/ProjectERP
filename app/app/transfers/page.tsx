'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Thead, Tbody, Th, Td, Pagination, StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { PaginatedResponse } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

interface Transfer { id: string; transfer_number: string; status: string; source_code: string; source_name: string; dest_code: string; dest_name: string; initiated_by_name: string; line_count: number; created_at: string; }

export default function TransfersPage() {
  const [data, setData] = useState<PaginatedResponse<Transfer> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      setData(await get<PaginatedResponse<Transfer>>(`/api/transfers?page=${page}&limit=25`));
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchTransfers(); }, [fetchTransfers]);

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">โอนสินค้าระหว่างคลัง / Transfers</h1>
            <p className="text-sm text-gray-500">{data?.total ?? '—'} รายการ</p>
          </div>
          <Link href="/app/transfers/new" transitionTypes={['nav-forward']}><Button className="w-full sm:w-auto">+ สร้างการโอน</Button></Link>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-gray-100">
          <Table>
            <Thead>
              <tr>
                <Th>เลขที่โอน</Th>
                <Th className="hidden sm:table-cell">จากคลัง</Th>
                <Th className="hidden sm:table-cell">ไปคลัง</Th>
                <Th className="hidden sm:table-cell">ผู้ดำเนินการ</Th>
                <Th className="hidden sm:table-cell">รายการ</Th>
                <Th>สถานะ</Th>
                <Th className="hidden sm:table-cell">วันที่</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {loading ? (
                <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
              ) : data?.data.length === 0 ? (
                <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">ไม่พบข้อมูล</div></Td></tr>
              ) : data?.data.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <Td className="font-mono font-medium text-sm">{t.transfer_number}</Td>
                  <Td className="text-sm hidden sm:table-cell">{t.source_code} — {t.source_name}</Td>
                  <Td className="text-sm hidden sm:table-cell">{t.dest_code} — {t.dest_name}</Td>
                  <Td className="text-sm hidden sm:table-cell">{t.initiated_by_name}</Td>
                  <Td className="text-sm text-center hidden sm:table-cell">{t.line_count}</Td>
                  <Td><StatusBadge status={t.status} /></Td>
                  <Td className="text-sm text-gray-500 hidden sm:table-cell">{formatDate(t.created_at)}</Td>
                  <Td><Link href={`/app/transfers/${t.id}`} transitionTypes={['nav-forward']} className="text-sm text-blue-600 hover:underline">ดู</Link></Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </div>
        {data && <div className="mt-4"><Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} /></div>}
      </div>
    </DirectionalTransition>
  );
}
