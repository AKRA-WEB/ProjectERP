'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Thead, Tbody, Th, Td, StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatDate, formatQty } from '@/lib/format';
import type { Warehouse } from '@/types';
import Link from 'next/link';

interface PendingPO {
  id: string;
  po_number: string;
  status: string;
  expected_date: string | null;
  vendor_name: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  total_lines: number;
  total_qty_remaining: string | number;
}

interface PendingIO {
  id: string;
  io_number: string;
  status: string;
  created_at: string;
  vendor_name: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  total_lines: number;
  total_qty_remaining: string | number;
}

interface QueueResponse {
  pending_pos: PendingPO[];
  inbound_orders: PendingIO[];
}

export default function ReceivingQueuePage() {
  const [data, setData] = useState<QueueResponse>({ pending_pos: [], inbound_orders: [] });
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (warehouseId) params.set('warehouse_id', warehouseId);
      const res = await get<QueueResponse>(`/api/grn/receiving-queue?${params}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses);
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รายการรอรับสินค้า / Receiving Queue</h1>
          <p className="text-sm text-gray-500">รายการทั้งหมดที่พร้อมรับเข้าคลัง</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/inbound-orders/new">
            <Button variant="secondary" size="sm">+ สร้าง IO ใหม่ (LINE)</Button>
          </Link>
          <Link href="/app/grn" className="text-sm text-blue-600 hover:underline flex items-center">← ไปหน้าประวัติ GRN</Link>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          className="w-full sm:w-auto rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
        >
          <option value="">ทุกคลังสินค้า</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>)}
        </select>
      </div>

      <div className="space-y-10">
        {/* Inbound Orders Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📋</span>
            <h2 className="text-lg font-bold text-gray-800">Inbound Orders (สั่งผ่าน LINE)</h2>
            <Badge variant="blue" className="ml-2">{data.inbound_orders.length}</Badge>
          </div>
          <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
            <Table>
              <Thead>
                <tr>
                  <Th>เลข IO</Th>
                  <Th>ผู้จำหน่าย / Vendor</Th>
                  <Th className="hidden sm:table-cell">คลังสินค้า</Th>
                  <Th className="hidden sm:table-cell text-right">จำนวนค้างรับ</Th>
                  <Th className="hidden sm:table-cell">วันที่สร้าง</Th>
                  <Th>สถานะ</Th>
                  <Th></Th>
                </tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <tr><Td colSpan={7}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
                ) : data.inbound_orders.length === 0 ? (
                  <tr><Td colSpan={7}><div className="py-8 text-center text-gray-400 italic">ไม่มีรายการ IO ค้างรับ</div></Td></tr>
                ) : (
                  data.inbound_orders.map((io) => (
                    <tr key={io.id} className="hover:bg-gray-50">
                      <Td className="font-mono font-medium text-sm text-blue-600">
                        <Link href={`/app/inbound-orders/${io.id}`}>{io.io_number}</Link>
                      </Td>
                      <Td className="text-sm">{io.vendor_name}</Td>
                      <Td className="text-sm hidden sm:table-cell">{io.warehouse_code}</Td>
                      <Td className="text-right font-mono text-sm hidden sm:table-cell">{formatQty(io.total_qty_remaining)}</Td>
                      <Td className="text-sm text-gray-500 hidden sm:table-cell">{formatDate(io.created_at)}</Td>
                      <Td><StatusBadge status={io.status} /></Td>
                      <Td className="text-right">
                        <Link href={`/app/grn/new?io_id=${io.id}`}>
                          <Button size="sm">รับสินค้า</Button>
                        </Link>
                      </Td>
                    </tr>
                  ))
                )}
              </Tbody>
            </Table>
          </div>
        </section>

        {/* Purchase Orders Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📦</span>
            <h2 className="text-lg font-bold text-gray-800">Purchase Orders (ระบบปกติ)</h2>
            <Badge variant="blue" className="ml-2">{data.pending_pos.length}</Badge>
          </div>
          <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
            <Table>
              <Thead>
                <tr>
                  <Th>เลข PO</Th>
                  <Th>ผู้จำหน่าย / Vendor</Th>
                  <Th className="hidden sm:table-cell">คลังสินค้า</Th>
                  <Th className="hidden sm:table-cell text-right">จำนวนค้างรับ</Th>
                  <Th className="hidden sm:table-cell">วันที่คาดรับ</Th>
                  <Th>สถานะ</Th>
                  <Th></Th>
                </tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <tr><Td colSpan={7}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
                ) : data.pending_pos.length === 0 ? (
                  <tr><Td colSpan={7}><div className="py-8 text-center text-gray-400 italic">ไม่มีรายการ PO ค้างรับ</div></Td></tr>
                ) : (
                  data.pending_pos.map((po) => (
                    <tr key={po.id} className="hover:bg-gray-50">
                      <Td className="font-mono font-medium text-sm text-blue-600">
                        <Link href={`/app/purchase-orders/${po.id}`}>{po.po_number}</Link>
                      </Td>
                      <Td className="text-sm">{po.vendor_name}</Td>
                      <Td className="text-sm hidden sm:table-cell">{po.warehouse_code}</Td>
                      <Td className="text-right font-mono text-sm hidden sm:table-cell">{formatQty(po.total_qty_remaining)}</Td>
                      <Td className="text-sm text-gray-500 hidden sm:table-cell">{po.expected_date ? formatDate(po.expected_date) : '—'}</Td>
                      <Td><StatusBadge status={po.status} /></Td>
                      <Td className="text-right">
                        <Link href={`/app/grn/new?po_id=${po.id}`}>
                          <Button size="sm">รับสินค้า</Button>
                        </Link>
                      </Td>
                    </tr>
                  ))
                )}
              </Tbody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Badge({ children, variant, className }: { children: React.ReactNode, variant: 'blue' | 'gray', className?: string }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-700'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[variant]} ${className}`}>
      {children}
    </span>
  );
}
