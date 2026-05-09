'use client';

import { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, Select } from '@/components/ui';
import { post, patch } from '@/lib/api-client';
import type { User } from '@/types';

interface Props {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function UserFormModal({ user, onClose, onSaved }: Props) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    email: user?.email ?? '',
    name_th: user?.name_th ?? '',
    name_en: user?.name_en ?? '',
    role: user?.role ?? 'staff',
    password: '',
    is_active: user?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key: string, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      if (isEdit) {
        const payload: any = { name_th: form.name_th, name_en: form.name_en, role: form.role, is_active: form.is_active };
        await patch(`/api/admin/users/${user.id}`, payload);
      } else {
        if (!form.password) { setError('กรุณาระบุรหัสผ่าน'); setSaving(false); return; }
        await post('/api/admin/users', form);
      }
      onSaved();
    } catch (e: any) {
      setError(e.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose}>
      <ModalHeader>{isEdit ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}</ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <Input label="อีเมล / Email *" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={isEdit} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="ชื่อ (TH)" value={form.name_th} onChange={(e) => set('name_th', e.target.value)} />
            <Input label="Name (EN) *" value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
          </div>
          <Select
            label="บทบาท / Role *"
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
            options={[
              { value: 'admin', label: 'ผู้ดูแลระบบ / Admin' },
              { value: 'manager', label: 'ผู้จัดการ / Manager' },
              { value: 'staff', label: 'พนักงาน / Staff' },
            ]}
          />
          {!isEdit && (
            <Input label="รหัสผ่าน / Password *" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} helperText="อย่างน้อย 8 ตัวอักษร" />
          )}
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              เปิดใช้งาน / Active
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
        <Button onClick={handleSave} loading={saving}>{isEdit ? 'บันทึก' : 'สร้างบัญชี'}</Button>
      </ModalFooter>
    </Modal>
  );
}
