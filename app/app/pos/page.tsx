'use client';

import { useState, useEffect } from 'react';
import { get, post } from '@/lib/api-client';
import { formatCurrency, formatDatetime } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Link from 'next/link';
import type { PosSession, Warehouse, PosShift } from '@/types';
import { useRouter } from 'next/navigation';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-sm overflow-hidden';

export default function PosHomePage() {
  const [sessions, setSessions] = useState<PosSession[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shifts, setShifts] = useState<PosShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  // Form state
  const [warehouseId, setWarehouseId] = useState('');
  const [openingFloat, setOpeningFloat] = useState('0');
  const [shiftId, setShiftId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [sessionsRes, warehousesRes, shiftsRes] = await Promise.all([
        get<{ data: PosSession[] }>('/api/pos/sessions?status=open'),
        get<Warehouse[]>('/api/admin/warehouses'),
        get<PosShift[]>('/api/pos/shifts'),
      ]);
      setSessions(sessionsRes.data);
      setWarehouses(warehousesRes.filter(w => w.is_active));
      setShifts(shiftsRes);
      if (warehousesRes.length > 0) setWarehouseId(warehousesRes[0].id);
    } catch (error) {
      console.error('Failed to fetch POS data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenSession(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await post<PosSession>('/api/pos/sessions', {
        warehouse_id: warehouseId,
        opening_float: parseFloat(openingFloat),
        shift_id: shiftId || undefined,
        notes: notes || undefined,
      });
      router.push(`/app/pos/session/${res.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to open session');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">ขายหน้าร้าน / POS</h1>
          <p className="text-stone-500 text-sm">จัดการรอบการขายและเปิดเครื่องบันทึกเงินสด</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/pos/sessions">
            <Button variant="outline">ประวัติรอบ / History</Button>
          </Link>
          <Button onClick={() => setIsModalOpen(true)}>เปิดรอบใหม่ / Open Session</Button>
        </div>
      </div>

      <div className="grid gap-4">
        <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wider">รอบที่กำลังเปิดอยู่ / Active Sessions</h2>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : sessions.length === 0 ? (
          <div className={`${CARD} p-12 text-center`}>
            <div className="text-4xl mb-3">🏪</div>
            <p className="text-stone-500">ยังไม่มีรอบการขายที่เปิดอยู่</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setIsModalOpen(true)}
            >
              คลิกที่นี่เพื่อเริ่มรอบใหม่
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((s) => (
              <Link key={s.id} href={`/app/pos/session/${s.id}`}>
                <div className={`${CARD} p-5 hover:border-emerald-500 transition-colors cursor-pointer group`}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-stone-900">{s.session_number}</span>
                        <StatusBadge status="open" />
                      </div>
                      <p className="text-sm text-stone-600">
                        คลัง: <span className="font-medium text-stone-900">{s.warehouse_name_th}</span>
                        {s.shift_name_th && <span className="ml-2 text-emerald-600">| กะ: <span className="font-bold">{s.shift_name_th}</span></span>}
                      </p>
                      <p className="text-xs text-stone-400">
                        เปิดเมื่อ: {formatDatetime(s.opened_at)} โดย {s.opened_by_name}
                      </p>
                    </div>
                    <div className="text-right space-y-2">
                      <div className="text-xs text-stone-400 uppercase font-medium">ยอดขายปัจจุบัน</div>
                      <div className="text-xl font-bold text-emerald-600">{formatCurrency(s.total_sales ?? 0)}</div>
                      <div className="text-xs text-stone-400">{s.transaction_count ?? 0} รายการ</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-stone-100 flex justify-end">
                    <span className="text-sm font-medium text-emerald-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                      เข้าสู่หน้าขาย / Go to Terminal →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="เปิดรอบการขายใหม่ / Open POS Session"
      >
        <form onSubmit={handleOpenSession} className="space-y-4 pt-2">
          <Select
            label="เลือกคลังสินค้า / Warehouse"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            required
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name_th}
              </option>
            ))}
          </Select>

          <Select
            label="เลือกกะการทำงาน / Shift (Optional)"
            value={shiftId}
            onChange={(e) => setShiftId(e.target.value)}
          >
            <option value="">-- ไม่ระบุกะ --</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_th} ({s.start_time} - {s.end_time})
              </option>
            ))}
          </Select>

          <Input
            label="เงินทอนเริ่มต้น / Opening Float"
            type="number"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
            min="0"
            step="0.01"
            required
          />

          <Input
            label="หมายเหตุ / Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="เช่น รอบเช้า, ตู้ที่ 1"
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              ยกเลิก / Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              ยืนยันเปิดรอบ / Open Session
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
