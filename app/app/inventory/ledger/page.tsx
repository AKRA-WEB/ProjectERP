'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Thead, Tbody, Th, Td, Pagination, Badge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDatetime, formatQty } from '@/lib/format';
import type { PaginatedResponse, Warehouse } from '@/types';

interface LedgerRow {
  id: string;
  entry_type: string;
  qty_change: number;
  qty_after: number;
  unit_cost: number | null;
  reference_type: string | null;
  sku: string;
  name_th: string;
  warehouse_code: string;
  created_by_name: string | null;
  created_at: string;
}

export default function LedgerPage() {
  const [data, setData] = useState<PaginatedResponse<LedgerRow> | null>(null);
  const [page, setPage] = useState(1);
  const [warehouseId, setWarehouseId] = useState('');
  const [entryType, setEntryType] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses); }, []);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (warehouseId) params.set('warehouse_id', warehouseId);
      if (entryType) params.set('entry_type', entryType);
      setData(await get<PaginatedResponse<LedgerRow>>(`/api/stock/ledger?${params}`));
    } finally { setLoading(false); }
  }, [page, warehouseId, entryType]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  const ENTRY_TYPES = [
    'grn_receipt', 'grn_qc_reject', 'rma_return', 'rma_vendor_return',
    'transfer_out', 'transfer_in', 'cycle_count_adjustment', 'manual_adjustment',
  ];

  const ENTRY_LABELS: Record<string, string> = {
    grn_receipt: 'รับสินค้า (GRN)',
    grn_qc_reject: 'ตีคืน QC',
    rma_return: 'รับคืน RMA',
    rma_vendor_return: 'คืนผู้จำหน่าย',
    transfer_out: 'โอนออก',
    transfer_in: 'โอนเข้า',
    cycle_count_adjustment: 'ปรับสต็อก (นับ)',
    manual_adjustment: 'ปรับสต็อก (manual)',
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">บัญชีสต็อก / Stock Ledger</h1>
        <p className="text-sm text-gray-500">{data?.total ?? '—'} รายการ</p>
      </div>

      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}>
          <option value="">ทุกคลัง</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>)}
        </select>
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={entryType} onChange={(e) => { setEntryType(e.target.value); setPage(1); }}>
          <option value="">ทุกประเภท</option>
          {ENTRY_TYPES.map((t) => <option key={t} value={t}>{ENTRY_LABELS[t] ?? t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100">
        <Table>
          <Thead>
            <tr>
              <Th>วันที่</Th>
              <Th>SKU</Th>
              <Th>สินค้า</Th>
              <Th>คลัง</Th>
              <Th>ประเภท</Th>
              <Th className="text-right">เปลี่ยนแปลง</Th>
              <Th className="text-right">ยอดหลังรายการ</Th>
              <Th>ผู้ดำ��นการ</Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
            ) : data?.data.length === 0 ? (
              <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">ไม่พบข้อมูล</div></Td></tr>
            ) : data?.data.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <Td className="text-xs text-gray-500">{formatDatetime(l.created_at)}</Td>
                <Td className="font-mono text-xs">{l.sku}</Td>
                <Td className="text-sm">{l.name_th}</Td>
                <Td className="text-sm">{l.warehouse_code}</Td>
                <Td className="text-xs">
                  <Badge variant="gray">{ENTRY_LABELS[l.entry_type] ?? l.entry_type.replace(/_/g, ' ')}</Badge>
                </Td>
                <Td className="text-right">
                  <Badge variant={Number(l.qty_change) >= 0 ? 'green' : 'red'}>
                    {Number(l.qty_change) > 0 ? '+' : ''}{formatQty(l.qty_change)}
                  </Badge>
                </Td>
                <Td className="text-sm text-right">{formatQty(l.qty_after)}</Td>
                <Td className="text-sm text-gray-500">{l.created_by_name ?? '—'}</Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      </div>
      {data && <div className="mt-4"><Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} /></div>}
    </div>
  );
}

