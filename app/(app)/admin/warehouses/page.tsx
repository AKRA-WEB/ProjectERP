'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Thead, Tbody, Th, Td, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Input } from '@/components/ui';
import { get, post, patch } from '@/lib/api-client';
import type { Warehouse } from '@/types';

interface WarehouseWithStats extends Warehouse {
  user_count?: number;
}

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editWh, setEditWh] = useState<Warehouse | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: '', name_th: '', name_en: '', address_th: '', address_en: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<WarehouseWithStats[]>('/api/admin/warehouses');
      setWarehouses(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);

  function openCreate() {
    setForm({ code: '', name_th: '', name_en: '', address_th: '', address_en: '' });
    setError('');
    setShowCreate(true);
  }

  function openEdit(wh: Warehouse) {
    setForm({ 
      code: wh.code, 
      name_th: wh.name_th, 
      name_en: wh.name_en, 
      address_th: wh.address_th ?? '', 
      address_en: wh.address_en ?? '' 
    });
    setError('');
    setEditWh(wh);
  }

  function setF(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      if (editWh) {
        await patch(`/api/admin/warehouses/${editWh.id}`, { name_th: form.name_th, name_en: form.name_en, address_th: form.address_th || null, address_en: form.address_en || null });
        setEditWh(null);
      } else {
        await post('/api/admin/warehouses', form);
        setShowCreate(false);
      }
      fetchWarehouses();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  const isOpen = showCreate || !!editWh;
  const isEdit = !!editWh;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">คลังสินค้า / Warehouses</h1>
          <p className="text-sm text-gray-500">{warehouses.length} คลัง</p>
        </div>
        <Button onClick={openCreate}>+ เพิ่มคลัง</Button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100">
        <Table>
          <Thead>
            <tr>
              <Th>รหัส / Code</Th>
              <Th>ชื่อ (TH)</Th>
              <Th>Name (EN)</Th>
              <Th>ผู้ใช้ / Users</Th>
              <Th>สถานะ</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={6}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
            ) : (
              warehouses.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <Td className="font-mono font-medium text-sm">{w.code}</Td>
                  <Td className="text-sm">{w.name_th}</Td>
                  <Td className="text-sm text-gray-500">{w.name_en}</Td>
                  <Td className="text-sm">{w.user_count ?? 0} คน</Td>
                  <Td>
                    <Badge variant={w.is_active ? 'green' : 'gray'}>
                      {w.is_active ? 'ใช้งาน' : 'ปิด'}
                    </Badge>
                  </Td>
                  <Td>
                    <button className="text-sm text-blue-600 hover:underline" onClick={() => openEdit(w)}>แก้ไข</button>
                  </Td>
                </tr>
              ))
            )}
          </Tbody>
        </Table>
      </div>

      {isOpen && (
        <Modal open onClose={() => { setShowCreate(false); setEditWh(null); }}>
          <ModalHeader>{isEdit ? 'แก้ไขคลังสินค้า' : 'เพิ่มคลังสินค้าใหม่'}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input label="รหัสคลัง / Code *" value={form.code} onChange={(e) => setF('code', e.target.value)} disabled={isEdit} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="ชื่อ (TH) *" value={form.name_th} onChange={(e) => setF('name_th', e.target.value)} />
                <Input label="Name (EN) *" value={form.name_en} onChange={(e) => setF('name_en', e.target.value)} />
                <Input label="ที่อยู่ (TH)" value={form.address_th} onChange={(e) => setF('address_th', e.target.value)} />
                <Input label="Address (EN)" value={form.address_en} onChange={(e) => setF('address_en', e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => { setShowCreate(false); setEditWh(null); }}>ยกเลิก</Button>
            <Button onClick={handleSave} loading={saving}>{isEdit ? 'บันทึก' : 'สร้างคลัง'}</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
