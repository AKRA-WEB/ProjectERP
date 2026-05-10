'use client';

import { useState, useEffect, useCallback } from 'react';
import { SearchInput, Table, Thead, Tbody, Th, Td, Pagination, Badge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatQty } from '@/lib/format';
import type { PaginatedResponse, Warehouse } from '@/types';

interface StockRow {
  warehouse_id: string;
  product_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  reorder_point: number;
  uom_code: string;
  warehouse_code: string;
  warehouse_name: string;
}

export default function InventoryPage() {
  const [data, setData] = useState<PaginatedResponse<StockRow> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses);
  }, []);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (search) params.set('search', search);
      if (warehouseId) params.set('warehouse_id', warehouseId);
      if (lowStock) params.set('low_stock', 'true');
      setData(await get<PaginatedResponse<StockRow>>(`/api/stock?${params}`));
    } finally { setLoading(false); }
  }, [page, search, warehouseId, lowStock]);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">สต็อกสินค้า / Inventory</h1>
        <p className="text-sm text-gray-500">{data?.total ?? '—'} รายการ</p>
      </div>

      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <SearchInput placeholder="ค้นหา SKU / ชื่อสินค้า..." onSearch={(v) => { setSearch(v); setPage(1); }} className="w-64" />
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}>
          <option value="">ทุกคลัง</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={lowStock} onChange={(e) => { setLowStock(e.target.checked); setPage(1); }} />
          สินค้าต่ำกว่า reorder point
        </label>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100">
        <Table>
          <Thead>
            <tr>
              <Th>SKU</Th>
              <Th>สินค้า</Th>
              <Th>คลัง</Th>
              <Th className="text-right">ยอดคงเหลือ</Th>
              <Th className="text-right">จอง</Th>
              <Th className="text-right">พร้อมใช้</Th>
              <Th className="text-right">Reorder</Th>
              <Th>หน่วย</Th>
              <Th>สถานะ</Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={9}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
            ) : data?.data.length === 0 ? (
              <tr><Td colSpan={9}><div className="py-8 text-center text-gray-400">ไม่พบข้อมูล</div></Td></tr>
            ) : data?.data.map((s, i) => {
              const isLow = Number(s.qty_available) <= Number(s.reorder_point);
              return (
                <tr key={i} className={`hover:bg-gray-50 ${isLow ? 'bg-red-50' : ''}`}>
                  <Td className="font-mono text-sm font-medium">{s.sku}</Td>
                  <Td>
                    <div className="text-sm font-medium">{s.name_th}</div>
                    <div className="text-xs text-gray-400">{s.name_en}</div>
                  </Td>
                  <Td className="text-sm">{s.warehouse_code}</Td>
                  <Td className="text-sm text-right">{formatQty(s.qty_on_hand)}</Td>
                  <Td className="text-sm text-right text-gray-400">{formatQty(s.qty_reserved)}</Td>
                  <Td className={`text-sm text-right font-medium ${isLow ? 'text-red-600' : 'text-green-600'}`}>{formatQty(s.qty_available)}</Td>
                  <Td className="text-sm text-right text-gray-500">{formatQty(s.reorder_point)}</Td>
                  <Td className="text-sm">{s.uom_code}</Td>
                  <Td>{isLow ? <Badge variant="red">ต่ำ</Badge> : <Badge variant="green">ปกติ</Badge>}</Td>
                </tr>
              );
            })}
          </Tbody>
        </Table>
      </div>

      {data && <div className="mt-4"><Pagination currentPage={page} totalPages={data.total_pages} onPageChange={setPage} /></div>}
    </div>
  );
}
