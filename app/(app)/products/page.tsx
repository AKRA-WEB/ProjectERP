'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, SearchInput, Table, Thead, Tbody, Th, Td, Pagination, Badge, StatusBadge } from '@/components/ui';
import { get } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import type { PaginatedResponse, Product } from '@/types';
import ProductFormModal from './ProductFormModal';

export default function ProductsPage() {
  const [data, setData] = useState<PaginatedResponse<Product> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('search', search);
      if (showInactive) params.set('show_inactive', 'true');
      const res = await get<PaginatedResponse<Product>>(`/api/products?${params}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, search, showInactive]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function handleSearchChange(val: string) {
    setSearch(val);
    setPage(1);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">สินค้า / Products</h1>
          <p className="text-sm text-gray-500">{data?.total ?? '—'} รายการ</p>
        </div>
        <Button onClick={() => { setSelected(null); setShowForm(true); }}>
          + เพิ่มสินค้า
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <SearchInput
          placeholder="ค้นหา SKU / ชื่อสินค้า..."
          onSearch={handleSearchChange}
          className="w-72"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => { setShowInactive(e.target.checked); setPage(1); }}
          />
          แสดงสินค้าที่ปิดใช้งาน
        </label>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100">
        <Table>
          <Thead>
            <tr>
              <Th>SKU</Th>
              <Th>ชื่อสินค้า / Name</Th>
              <Th>หมวดหมู่ / Category</Th>
              <Th>หน่วย / UOM</Th>
              <Th>ราคาทุน / Cost</Th>
              <Th>ติดตาม / Tracking</Th>
              <Th>สถานะ / Status</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
            ) : data?.data.length === 0 ? (
              <tr><Td colSpan={8}><div className="py-8 text-center text-gray-400">ไม่พบข้อมูล</div></Td></tr>
            ) : (
              data?.data.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <Td className="font-mono text-sm font-medium">{p.sku}</Td>
                  <Td>
                    <div className="font-medium text-gray-900">{p.name_th}</div>
                    <div className="text-xs text-gray-400">{p.name_en}</div>
                  </Td>
                  <Td className="text-sm text-gray-500">{(p as any).category_name ?? '—'}</Td>
                  <Td className="text-sm">{(p as any).uom_code}</Td>
                  <Td className="text-sm">{formatCurrency(p.unit_cost)}</Td>
                  <Td>
                    {p.is_lot_tracked && <Badge variant="blue">Lot</Badge>}
                    {p.is_serial_tracked && <Badge variant="purple">Serial</Badge>}
                    {!p.is_lot_tracked && !p.is_serial_tracked && <span className="text-gray-400 text-xs">—</span>}
                  </Td>
                  <Td>
                    <Badge variant={p.is_active ? 'green' : 'gray'}>
                      {p.is_active ? 'ใช้งาน' : 'ปิด'}
                    </Badge>
                  </Td>
                  <Td>
                    <button
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => { setSelected(p); setShowForm(true); }}
                    >
                      แก้ไข
                    </button>
                  </Td>
                </tr>
              ))
            )}
          </Tbody>
        </Table>
      </div>

      {data && (
        <div className="mt-4">
          <Pagination
            currentPage={page}
            totalPages={data.total_pages}
            onPageChange={setPage}
          />
        </div>
      )}

      {showForm && (
        <ProductFormModal
          product={selected}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchProducts(); }}
        />
      )}
    </div>
  );
}
