'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@/components/ui';
import { get, post } from '@/lib/api-client';
import type { User, Warehouse } from '@/types';

interface Props {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}

export default function UserWarehouseModal({ user, onClose, onSaved }: Props) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then(setWarehouses);
    get<User & { assigned_warehouse_ids?: string[] }>(`/api/admin/users/${user.id}`).then((u) => {
      if (u.assigned_warehouse_ids) {
        setSelected(new Set(u.assigned_warehouse_ids));
      }
    });
  }, [user.id]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      await post(`/api/admin/users/${user.id}/warehouses`, { warehouse_ids: Array.from(selected) });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose}>
      <ModalHeader>กำหนดคลังสินค้า — {user.name_th ?? user.name_en}</ModalHeader>
      <ModalBody>
        <div className="space-y-2">
          {warehouses.map((w) => (
            <label key={w.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggle(w.id)} />
              <div>
                <div className="text-sm font-medium">{w.code} — {w.name_th}</div>
                <div className="text-xs text-gray-400">{w.name_en}</div>
              </div>
            </label>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
        <Button onClick={handleSave} loading={saving}>บันทึก</Button>
      </ModalFooter>
    </Modal>
  );
}
