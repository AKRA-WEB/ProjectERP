'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect } from 'react';
import { get, post } from '@/lib/api-client';
import type { LeaveType, LeaveBalance } from '@/types';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { useSession } from 'next-auth/react';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function NewLeaveRequestPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    days_requested: 1,
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [types] = await Promise.all([
          get<LeaveType[]>('/api/hr/leave-types'),
        ]);
        setLeaveTypes(types);

        if (session?.user) {
          const user = session.user as { id: string };
          const bals = await get<LeaveBalance[]>(`/api/hr/leave-balances?employee_id=${user.id}`);
          setLeaveBalances(bals);
        }
      } finally { setLoading(false); }
    }
    init();
  }, [session]);

  // Auto compute days when dates change
  useEffect(() => {
    if (form.start_date && form.end_date) {
      const start = new Date(form.start_date);
      const end = new Date(form.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setForm(f => ({ ...f, days_requested: diffDays }));
    }
  }, [form.start_date, form.end_date]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน'); return;
    }
    setSaving(true);
    setError('');
    try {
      await post('/api/hr/leave-requests', form);
      router.push('/app/hr/leave-requests');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  }

  const selectedBalance = balances.find(b => b.leave_type_id === form.leave_type_id);

  if (loading) return <div className="py-12 text-center text-stone-400">กำลังโหลด...</div>;

  return (
    <div className="max-w-[600px] mx-auto pb-12 space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-stone-950">สร้างใบลา / New Leave Request</h1>
        <p className="text-[14px] text-stone-500">กรอกรายละเอียดเพื่อขออนุมัติการลา</p>
      </div>

      <form onSubmit={handleSubmit} className={CARD}>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-stone-700">ประเภทการลา *</label>
              <select
                className="h-9 px-3 rounded-md border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-stone-950/10 transition-all"
                value={form.leave_type_id}
                onChange={e => setForm({ ...form, leave_type_id: e.target.value })}
              >
                <option value="">เลือกประเภทการลา</option>
                {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name_th} ({t.name_en})</option>)}
              </select>
              {selectedBalance && (
                <p className="text-[12px] text-emerald-600 font-medium">
                  สิทธิ์คงเหลือ: {selectedBalance.days_remaining} วัน จาก {selectedBalance.days_entitled} วัน
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="วันที่เริ่มลา *"
                type="date"
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
              />
              <Input
                label="สิ้นสุดวันที่ *"
                type="date"
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
              />
            </div>

            <Input
              label="จำนวนวันที่ขอลา *"
              type="number"
              step="0.5"
              value={form.days_requested}
              onChange={e => setForm({ ...form, days_requested: parseFloat(e.target.value) })}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-stone-700">เหตุผล / หมายเหตุ</label>
              <textarea
                className="w-full min-h-[100px] p-3 rounded-md border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-stone-950/10 transition-all resize-none"
                placeholder="ระบุเหตุผลการลา..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex items-center justify-end gap-3 rounded-b-[10px]">
          <Button variant="ghost" type="button" onClick={() => router.back()}>ยกเลิก</Button>
          <Button type="submit" loading={saving}>ส่งใบลา</Button>
        </div>
      </form>
    </div>
  );
}
