'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, SearchInput, Table, Thead, Tbody, Th, Td, Pagination, StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { PaginatedResponse } from '@/types';
import Link from 'next/link';

interface GRN {
  id: string;
  grn_number: string;
  status: string;
  po_number: string;
  warehouse_code: string;
  warehouse_name: string;
  received_by_name: string;
  received_date: string;
  line_count: number;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'draft', label: 'ร่าง' },
  { value: 'received', label: 'รับแล้ว' },
  { value: 'qc_pending', label: 'รอ QC' },
  { value: 'qc_passed', label: 'QC ผ่าน' },
  { value: 'qc_failed', label: 'QC ไม่ผ่าน' },
  { value: 'stocked', label: 'นำเข้าคลัง' },
];

export default function GRNPage() {
  const [data, setData] = useState<PaginatedResponse<GRN> | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchGRNs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (status) params.set('status', status);
      const res = await get<PaginatedResponse<GRN>>(`/api/grn?${params}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchGRNs(); }, [fetchGRNs]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ใบรับสินค้า / Goods Receipt Notes</h1>
          <p className="text-sm text-gray-500">{data?.total ?? '—'} รายการ</p>
        </div>
        <Link href="/app/grn/new"><Button>+ สร้าง GRN</Button></Link>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100">
        <Table>
          <Thead>
            <tr>
              <Th>เลข GRN</Th>
              <Th>เลข PO</Th>
              <Th>คลังสินค้า</Th>
              <Th>ผู้รับ</Th>
              <Th>วันที่รับ</Th>
              <Th>รายการ</Th>
              <Th>สถานะ</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
            ) : data?.data.length === 0 ? (
              <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">ไม่พบข้อมูล</div></Td></tr>
            ) : (
              data?.data.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <Td className="font-mono font-medium text-sm">{g.grn_number}</Td>
                  <Td className="font-mono text-sm text-blue-600">
                    <Link href={`/app/purchase-orders/${g.id}`}>{g.po_number}</Link>
                  </Td>
                  <Td className="text-sm">{g.warehouse_code}</Td>
                  <Td className="text-sm">{g.received_by_name}</Td>
                  <Td className="text-sm">{formatDate(g.received_date)}</Td>
                  <Td className="text-sm text-center">{g.line_count}</Td>
                  <Td><StatusBadge status={g.status} /></Td>
                  <Td>
                    <Link href={`/app/grn/${g.id}`} className="text-sm text-blue-600 hover:underline">ดู</Link>
                  </Td>
                </tr>
              ))
            )}
          </Tbody>
        </Table>
      </div>

      {data && (
        <div className="mt-4">
          <Pagination currentPage={page} totalPages={data.total_pages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
