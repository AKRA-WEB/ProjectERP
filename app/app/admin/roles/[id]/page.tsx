'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Input, Badge } from '@/components/ui';
import { get, patch } from '@/lib/api-client';
import type { Permission, EmployeeRole } from '@/types';

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [role, setRole] = useState<EmployeeRole | null>(null);
  const [catalog, setCatalog] = useState<Record<string, Permission[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name_th: '',
    name_en: '',
    description: '',
  });
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([
        get<EmployeeRole>(`/api/admin/roles/${id}`),
        get<Record<string, Permission[]>>('/api/admin/permissions'),
      ]);
      setRole(r);
      setCatalog(c);
      setFormData({
        name_th: r.name_th,
        name_en: r.name_en,
        description: r.description ?? '',
      });
      setSelectedPerms(r.permission_ids ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function togglePerm(permId: string) {
    setSelectedPerms((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      await patch(`/api/admin/roles/${id}`, {
        ...formData,
        permission_ids: selectedPerms,
      });
      fetchData();
      alert('บันทึกสำเร็จ');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-16 text-center text-gray-600">กำลังโหลด...</div>;
  if (!role) return <div className="py-16 text-center text-gray-600">ไม่พบข้อมูล</div>;

  const MODULE_LABELS: Record<string, string> = {
    inbound_order: 'Inbound Order (รับสินค้า LINE)',
    purchase_request: 'ใบขอซื้อ',
    purchase_order: 'ใบสั่งซื้อ',
    grn: 'ใบรับสินค้า (GRN)',
    rma: 'การคืนสินค้า (RMA)',
    claim: 'การเคลม',
    transfer: 'การโอนสินค้า',
    cycle_count: 'การนับสต็อก',
    inventory: 'สต็อก / คลัง',
    admin: 'จัดการระบบ',
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
          <h1 className="text-2xl font-bold text-gray-900 font-mono flex items-center gap-3">
            {role.code}
            {role.is_system && <Badge variant="green">System</Badge>}
          </h1>
        </div>
        <Button onClick={handleSave} loading={saving}>บันทึกการเปลี่ยนแปลง</Button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="ชื่อภาษาไทย *" value={formData.name_th} onChange={(e) => setFormData({ ...formData, name_th: e.target.value })} disabled={role.is_system} />
          <Input label="ชื่อภาษาอังกฤษ *" value={formData.name_en} onChange={(e) => setFormData({ ...formData, name_en: e.target.value })} disabled={role.is_system} />
        </div>
        <Input label="คำอธิบาย" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} disabled={role.is_system} />

        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 border-b pb-2 uppercase tracking-wider">สิทธิ์การใช้งาน / Permissions</h2>
          <div className="space-y-8">
            {Object.entries(catalog).map(([module, perms]) => (
              <div key={module}>
                <h3 className="text-xs font-bold text-gray-600 uppercase mb-3 bg-gray-50 px-2 py-1 inline-block rounded">{MODULE_LABELS[module] ?? module.replace(/_/g, ' ')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {perms.map((p) => (
                    <label key={p.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input type="checkbox" className="mt-1 rounded text-blue-600 focus:ring-blue-500" checked={selectedPerms.includes(p.id)} onChange={() => togglePerm(p.id)} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{p.name_th}</p>
                        <p className="text-xs text-gray-600 truncate">{p.id}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
