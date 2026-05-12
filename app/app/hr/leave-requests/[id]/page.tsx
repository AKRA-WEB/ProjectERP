'use client';

import { useState, useEffect, use } from 'react';
import { get, patch } from '@/lib/api-client';
import type { LeaveRequest, LeaveBalance } from '@/types';
import { Button, StatusBadge, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui';
import { useSession } from 'next-auth/react';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function LeaveRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const user = session?.user as { id: string; role: string } | undefined;
  const isOwner = user?.id === request?.employee_id;
  const isAdmin = user && ['admin', 'manager'].includes(user.role);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const req = await get<LeaveRequest>(`/api/hr/leave-requests/${id}`);
        setRequest(req);
        const bals = await get<LeaveBalance[]>(`/api/hr/leave-balances?employee_id=${req.employee_id}&year=${new Date(req.start_date).getFullYear()}`);
        setBalance(bals.find(b => b.leave_type_id === req.leave_type_id) || null);
      } finally { setLoading(false); }
    }
    init();
  }, [id]);

  async function handleAction(action: string, extra = {}) {
    setActing(true);
    try {
      await patch(`/api/hr/leave-requests/${id}`, { action, ...extra });
      const updated = await get<LeaveRequest>(`/api/hr/leave-requests/${id}`);
      setRequest(updated);
      setShowRejectModal(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setActing(false); }
  }

  if (loading) return <div className="py-12 text-center text-stone-400">กำลังโหลด...</div>;
  if (!request) return <div className="py-12 text-center text-stone-400">ไม่พบรายการลา</div>;

  return (
    <div className="max-w-[800px] mx-auto pb-12 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-stone-950">รายละเอียดการลา</h1>
          <p className="text-[14px] text-stone-500 font-mono uppercase">{request.request_number}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className={CARD}>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-y-6">
                <InfoRow label="พนักงาน" value={request.employee_name} />
                <InfoRow label="ประเภทการลา" value={request.leave_type_name_th} />
                <InfoRow label="วันที่เริ่มลา" value={new Date(request.start_date).toLocaleDateString('th-TH')} />
                <InfoRow label="สิ้นสุดวันที่" value={new Date(request.end_date).toLocaleDateString('th-TH')} />
                <InfoRow label="จำนวนวัน" value={`${request.days_requested} วัน`} />
                <InfoRow label="วันที่ยื่น" value={new Date(request.created_at).toLocaleString('th-TH')} />
              </div>
              <div className="pt-6 border-t border-stone-100">
                <InfoRow label="เหตุผล / หมายเหตุ" value={request.notes || '—'} />
              </div>

              {request.status === 'rejected' && (
                <div className="pt-6 border-t border-red-100 mt-4">
                  <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <p className="text-[12px] font-semibold text-red-900 uppercase tracking-wider mb-1">เหตุผลที่ปฏิเสธ</p>
                    <p className="text-[14px] text-red-700">{request.reject_reason}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={CARD}>
             <div className="p-5 space-y-4">
                <h3 className="text-[14px] font-semibold text-stone-950 uppercase tracking-wider">สิทธิ์การลา</h3>
                {balance ? (
                  <div className="space-y-3">
                    <BalanceItem label="ได้รับทั้งหมด" value={`${balance.days_entitled} วัน`} />
                    <BalanceItem label="ใช้ไปแล้ว" value={`${balance.days_used} วัน`} />
                    <BalanceItem label="คงเหลือ" value={`${balance.days_remaining} วัน`} highlight />
                  </div>
                ) : (
                  <p className="text-[13px] text-stone-400">ไม่พบข้อมูลสิทธิ์การลา</p>
                )}
             </div>
          </div>

          <div className="space-y-2">
            {request.status === 'draft' && isOwner && (
              <Button className="w-full" onClick={() => handleAction('submit')} loading={acting}>
                ส่งอนุมัติ
              </Button>
            )}
            {request.status === 'submitted' && isAdmin && (
              <>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => handleAction('approve')} loading={acting}>
                  อนุมัติการลา
                </Button>
                <Button variant="ghost" className="w-full text-red-600 hover:bg-red-50" onClick={() => setShowRejectModal(true)}>
                  ปฏิเสธ
                </Button>
              </>
            )}
            {['draft', 'submitted'].includes(request.status) && (isOwner || isAdmin) && (
              <Button variant="ghost" className="w-full" onClick={() => handleAction('cancel')} loading={acting}>
                ยกเลิกรายการ
              </Button>
            )}
          </div>
        </div>
      </div>

      {showRejectModal && (
        <Modal open onClose={() => setShowRejectModal(false)}>
          <ModalHeader>ระบุเหตุผลที่ปฏิเสธ</ModalHeader>
          <ModalBody>
            <textarea
              className="w-full min-h-[100px] p-3 rounded-md border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-stone-950/10 transition-all resize-none"
              placeholder="เหตุผลที่ไม่สามารถอนุมัติได้..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowRejectModal(false)}>ยกเลิก</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => handleAction('reject', { reject_reason: rejectReason })} loading={acting}>
              ยืนยันการปฏิเสธ
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[12px] font-medium text-stone-400 uppercase tracking-wider">{label}</p>
      <p className="text-[15px] text-stone-900 font-medium">{value}</p>
    </div>
  );
}

function BalanceItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-stone-500">{label}</span>
      <span className={`font-semibold ${highlight ? 'text-emerald-600' : 'text-stone-900'}`}>{value}</span>
    </div>
  );
}
