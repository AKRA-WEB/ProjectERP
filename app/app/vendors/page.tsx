'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Thead, Tbody, Th, Td, Pagination, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Input } from '@/components/ui';
import { get, post, patch } from '@/lib/api-client';
import type { PaginatedResponse } from '@/types';

interface Vendor {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  tax_id: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  payment_terms_days: number;
  is_active: boolean;
}

const emptyForm = { code: '', name_th: '', name_en: '', tax_id: '', contact_name: '', phone: '', email: '', payment_terms_days: '30' };

export default function VendorsPage() {
  const [data, setData] = useState<PaginatedResponse<Vendor> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('search', search);
      setData(await get<PaginatedResponse<Vendor>>(`/api/vendors?${params}`));
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  }

  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({
      code: v.code,
      name_th: v.name_th,
      name_en: v.name_en ?? '',
      tax_id: v.tax_id ?? '',
      contact_name: v.contact_name ?? '',
      phone: v.phone ?? '',
      email: v.email ?? '',
      payment_terms_days: String(v.payment_terms_days),
    });
    setError('');
    setShowModal(true);
  }

  function setF(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSave() {
    if (!form.code.trim() || !form.name_th.trim() || !form.name_en.trim()) {
      setError('รหัส ชื่อไทย และชื่ออังกฤษจำเป็น');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name_th: form.name_th,
        name_en: form.name_en,
        tax_id: form.tax_id || undefined,
        contact_name: form.contact_name || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        payment_terms_days: parseInt(form.payment_terms_days) || 30,
      };
      if (editing) {
        await patch(`/api/vendors/${editing.id}`, payload);
      } else {
        await post('/api/vendors', payload);
      }
      setShowModal(false);
      await fetchVendors();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ผู้จำหน่าย / Vendors</h1>
          <p className="text-sm text-gray-500">{data?.total ?? 'โ€”'} รายการ</p>
        </div>
        <Button onClick={openNew} className="w-full sm:w-auto">+ เพิ่มผู้จำหน่าย</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="ค้นหารหัสหรือชื่อ..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full sm:w-64"
        />
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100">
        <Table>
          <Thead>
            <tr>
              <Th>รหัส</Th>
              <Th>ชื่อ</Th>
              <Th className="hidden sm:table-cell">เลขผู้เสียภาษี</Th>
              <Th className="hidden sm:table-cell">ติดต่อ</Th>
              <Th className="text-center hidden sm:table-cell">เครดิต (วัน)</Th>
              <Th>สถานะ</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {loading ? (
              <tr><Td colSpan={7}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
            ) : data?.data.length === 0 ? (
              <tr><Td colSpan={7}><div className="py-8 text-center text-gray-400">ไม่พบข้อมูล</div></Td></tr>
            ) : data?.data.map((v: Vendor) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <Td className="font-mono font-medium text-sm">{v.code}</Td>
                <Td>
                  <div className="text-sm font-medium">{v.name_th}</div>
                  <div className="text-xs text-gray-400">{v.name_en}</div>
                </Td>
                <Td className="text-sm text-gray-500 hidden sm:table-cell">{v.tax_id ?? 'โ€”'}</Td>
                <Td className="text-sm text-gray-600 hidden sm:table-cell">
                  {v.contact_name && <div>{v.contact_name}</div>}
                  {v.phone && <div className="text-xs text-gray-400">{v.phone}</div>}
                </Td>
                <Td className="text-sm text-center hidden sm:table-cell">{v.payment_terms_days}</Td>
                <Td>
                  <Badge variant={v.is_active ? 'green' : 'gray'}>
                    {v.is_active ? 'ใช้งาน' : 'ปิดใช้'}
                  </Badge>
                </Td>
                <Td>
                  <button onClick={() => openEdit(v)} className="text-sm text-blue-600 hover:underline">แก้ไข</button>
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      </div>
      {data && <div className="mt-4"><Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} /></div>}

      {showModal && (
        <Modal open onClose={() => setShowModal(false)}>
          <ModalHeader>{editing ? 'แก้ไขผู้จำหน่าย' : 'เพิ่มผู้จำหน่ายใหม่'}</ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="รหัส *" value={form.code} onChange={(e) => setF('code', e.target.value)} disabled={!!editing} />
                <Input label="ชื่อ (ไทย) *" value={form.name_th} onChange={(e) => setF('name_th', e.target.value)} />
                <Input label="ชื่อ (อังกฤษ) *" value={form.name_en} onChange={(e) => setF('name_en', e.target.value)} />
                <Input label="เลขผู้เสียภาษี" value={form.tax_id} onChange={(e) => setF('tax_id', e.target.value)} />
                <Input label="ผู้ติดต่อ" value={form.contact_name} onChange={(e) => setF('contact_name', e.target.value)} />
                <Input label="โทรศัพท์" value={form.phone} onChange={(e) => setF('phone', e.target.value)} />
                <Input label="อีเมล" type="email" value={form.email} onChange={(e) => setF('email', e.target.value)} />
                <Input label="เครดิต (วัน)" type="number" value={form.payment_terms_days} onChange={(e) => setF('payment_terms_days', e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowModal(false)}>ยกเลิก</Button>
            <Button onClick={handleSave} loading={saving}>บันทึก</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

