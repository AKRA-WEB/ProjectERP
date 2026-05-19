'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Thead, Tbody, Th, Td, Pagination, StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { PaginatedResponse } from '@/types';
import Link from 'next/link';
import { DirectionalTransition } from '@/components/ui/directional-transition';

interface CC { id: string; count_number: string; status: string; warehouse_code: string; warehouse_name: string; initiated_by_name: string; line_count: number; counted_lines: number; created_at: string; }

export default function CycleCountsPage() {
  const [data, setData] = useState<PaginatedResponse<CC> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { setData(await get<PaginatedResponse<CC>>(`/api/cycle-counts?page=${page}&limit=25`)); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ตรวจนับสต็อก / Cycle Counts</h1>
            <p className="text-sm text-gray-500">{data?.total ?? '—'} รายการ</p>
          </div>
          <Link href="/app/cycle-counts/new" transitionTypes={['nav-forward']}><Button className="w-full sm:w-auto">+ สร้างการนับ</Button></Link>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-gray-100">
          <Table>
            <Thead>
              <tr>
                <Th>เลขที่</Th>
                <Th className="hidden sm:table-cell">คลัง</Th>
                <Th className="hidden sm:table-cell">ผู้ดำ��นการ</Th>
                <Th className="hidden sm:table-cell">รายการ</Th>
                <Th className="hidden sm:table-cell">นับแล้ว</Th>
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
              ) : data?.data.map((cc) => (
                <tr key={cc.id} className="hover:bg-gray-50">
                  <Td className="font-mono font-medium text-sm">{cc.count_number}</Td>
                  <Td className="text-sm hidden sm:table-cell">{cc.warehouse_code} — {cc.warehouse_name}</Td>
                  <Td className="text-sm hidden sm:table-cell">{cc.initiated_by_name}</Td>
                  <Td className="text-sm text-center hidden sm:table-cell">{cc.line_count}</Td>
                  <Td className="text-sm text-center hidden sm:table-cell">{cc.counted_lines} / {cc.line_count}</Td>
                  <Td><StatusBadge status={cc.status} /></Td>
                  <Td className="text-sm text-gray-500 hidden sm:table-cell">{formatDate(cc.created_at)}</Td>
                  <Td><Link href={`/app/cycle-counts/${cc.id}`} transitionTypes={['nav-forward']} className="text-sm text-blue-600 hover:underline">ดู</Link></Td>
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
