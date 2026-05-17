'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get, patch } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Link from 'next/link';
import type { Account } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function AccountDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name_th: '',
    name_en: '',
    is_active: true,
    description: '',
  });

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<Account>(`/api/accounting/accounts/${id}`);
      setAccount(res);
      setFormData({
        name_th: res.name_th,
        name_en: res.name_en,
        is_active: res.is_active,
        description: res.description || '',
      });
    } catch (error) {
      console.error('Failed to fetch account:', error);
      router.push('/app/accounting/chart-of-accounts');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await patch(`/api/accounting/accounts/${id}`, formData);
      alert('บันทึกสำเร็จ / Saved successfully');
      fetchAccount();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><LoadingSpinner /></div>;
  if (!account) return <div className="text-center py-24">Account not found</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/accounting/chart-of-accounts" className="text-stone-600 hover:text-stone-600">←</Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{account.name_th}</h1>
          <p className="text-stone-500 font-mono text-sm">{account.account_code}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className={`${CARD} p-6 space-y-6`}>
        <div className="grid grid-cols-2 gap-4 bg-stone-50 p-4 rounded-lg border border-stone-100">
           <div>
              <p className="text-xs text-stone-600 uppercase font-bold tracking-wider">Account Type</p>
              <p className="font-medium uppercase">{account.account_type}</p>
           </div>
           <div>
              <p className="text-xs text-stone-600 uppercase font-bold tracking-wider">Normal Balance</p>
              <p className="font-medium uppercase">{account.normal_balance}</p>
           </div>
           <div>
              <p className="text-xs text-stone-600 uppercase font-bold tracking-wider">Allows Direct Posting</p>
              <p className="font-medium">{account.allows_direct_posting ? 'Yes' : 'No (Group Account)'}</p>
           </div>
           <div>
              <p className="text-xs text-stone-600 uppercase font-bold tracking-wider">Parent Account</p>
              <p className="font-medium">{account.parent_code ? `${account.parent_code} - ${account.parent_name_th}` : '-'}</p>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="ชื่อบัญชี (TH) / Name (TH)"
            value={formData.name_th}
            onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
            required
          />
          <Input
            label="ชื่อบัญชี (EN) / Name (EN)"
            value={formData.name_en}
            onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
            required
          />
        </div>

        <Select
          label="สถานะ / Status"
          value={String(formData.is_active)}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
        >
          <option value="true">ใช้งาน / Active</option>
          <option value="false">ยกเลิก / Inactive</option>
        </Select>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">คำอธิบาย / Description</label>
          <textarea
            className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" loading={saving}>บันทึกการเปลี่ยนแปลง / Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
