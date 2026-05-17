'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge } from '@/components/ui';
import { get, post, del } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import type { User, EmployeeRole } from '@/types';

interface UserRoleAssignment {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  assigned_at: string;
  assigned_by_name: string;
}

interface Props {
  user: User;
  onClose: () => void;
  onSaved?: () => void;
}

export default function UserRoleModal({ user, onClose }: Props) {
  const [assignedRoles, setAssignedRoles] = useState<UserRoleAssignment[]>([]);
  const [allRoles, setAllRoles] = useState<EmployeeRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [assigned, roles] = await Promise.all([
        get<UserRoleAssignment[]>(`/api/admin/users/${user.id}/roles`),
        get<EmployeeRole[]>('/api/admin/roles'),
      ]);
      setAssignedRoles(assigned);
      setAllRoles(roles);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAdd() {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      await post(`/api/admin/users/${user.id}/roles`, { role_id: selectedRoleId });
      setSelectedRoleId('');
      fetchData();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(roleId: string) {
    if (!confirm('ยืนยันการถอนบทบาทนี้?')) return;
    setSaving(true);
    try {
      await del(`/api/admin/users/${user.id}/roles`, { role_id: roleId });
      fetchData();
    } finally {
      setSaving(false);
    }
  }

  const unassigned = allRoles.filter((r) => !assignedRoles.find((a) => a.id === r.id));

  return (
    <Modal open onClose={onClose} size="md">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <span>บทบาทของ: {user.name_th ?? user.name_en}</span>
          <Badge variant="blue">{user.role}</Badge>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-xs text-yellow-800">
            หมายเหตุ: การเปลี่ยนบทบาทจะมีผลหลังจากผู้ใช้ล็อกอินใหม่ (New session required)
          </div>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">บทบาทปัจจุบัน / Assigned Roles</h3>
            {loading ? (
              <p className="py-4 text-center text-sm text-gray-600">กำลังโหลด...</p>
            ) : assignedRoles.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400 italic">ยังไม่มีบทบาทที่กำหนดเฉพาะ</p>
            ) : (
              <div className="space-y-2">
                {assignedRoles.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{r.name_th}</span>
                        <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1 rounded uppercase">{r.code}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">กำหนดโดย {r.assigned_by_name} เมื่อ {formatDate(r.assigned_at)}</p>
                    </div>
                    <button
                      onClick={() => handleRemove(r.id)}
                      className="text-xs text-red-600 hover:underline"
                      disabled={saving}
                    >
                      ถอนสิทธิ์
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">เพิ่มบทบาทใหม่</h3>
            <div className="flex gap-2">
              <select
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
              >
                <option value="">เลือกบทบาท...</option>
                {unassigned.map((r) => (
                  <option key={r.id} value={r.id}>{r.name_th} ({r.code})</option>
                ))}
              </select>
              <Button size="sm" onClick={handleAdd} disabled={!selectedRoleId || saving} loading={saving}>เพิ่ม</Button>
            </div>
          </section>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>ปิด</Button>
      </ModalFooter>
    </Modal>
  );
}
