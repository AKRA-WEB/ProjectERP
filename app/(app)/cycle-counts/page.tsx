'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Thead, Tbody, Th, Td, Pagination, StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { PaginatedResponse } from '@/types';
import Link from 'next/link';

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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ตรวจนับสต็อก / Cycle Counts</h1>
          <p className="text-sm text-gray-500">{data?.total ?? '—'} รายการ</p>
        </div>
        <Link href="/app/cycle-counts/new"><Button>+ สร้างการนับ</Button></Link>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100">
        <Table>
          <Thead>
            <tr><Th>เลขที่</Th><Th>คลัง</Th><Th>ผู้ดำเนินการ</Th><Th>รายการ</Th><Th>นับแล้ว</Th><Th>สถานะ</Th><Th>วันที่</Th><Th></Th></tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
            ) : data?.data.length === 0 ? (
              <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">ไม่พบข้อมูล</div></Td></tr>
            ) : data?.data.map((cc) => (
              <tr key={cc.id} className="hover:bg-gray-50">
                <Td className="font-mono font-medium text-sm">{cc.count_number}</Td>
                <Td className="text-sm">{cc.warehouse_code} — {cc.warehouse_name}</Td>
                <Td className="text-sm">{cc.initiated_by_name}</Td>
                <Td className="text-sm text-center">{cc.line_count}</Td>
                <Td className="text-sm text-center">{cc.counted_lines} / {cc.line_count}</Td>
                <Td><StatusBadge status={cc.status} /></Td>
                <Td className="text-sm text-gray-500">{formatDate(cc.created_at)}</Td>
                <Td><Link href={`/app/cycle-counts/${cc.id}`} className="text-sm text-blue-600 hover:underline">ดู</Link></Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      </div>
      {data && <div className="mt-4"><Pagination currentPage={page} totalPages={data.total_pages} onPageChange={setPage} /></div>}
    </div>
  );
}
