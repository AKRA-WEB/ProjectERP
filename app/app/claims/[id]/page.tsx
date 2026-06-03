'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, StatusBadge, Input, Select } from '@/components/ui';
import { get, patch } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/format';
import type { ClaimStatus, ClaimResolutionType } from '@/types';

interface ClaimDetail {
  id: string;
  claim_number: string;
  status: ClaimStatus;
  vendor_code: string;
  vendor_name: string;
  warehouse_code: string;
  warehouse_name: string;
  claim_amount: string;
  created_at: string;
  description: string;
  resolution_type?: ClaimResolutionType;
  credit_note_ref?: string;
  credit_note_amount?: string;
  resolution_notes?: string;
}

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const [resolveForm, setResolveForm] = useState({
    resolution_type: 'credit_note' as ClaimResolutionType | 'both',
    credit_note_ref: '',
    credit_note_amount: '',
    resolution_notes: '',
  });

  const fetchClaim = useCallback(async () => {
    setLoading(true);
    try { setClaim(await get<ClaimDetail>(`/api/vendor-claims/${id}`)); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchClaim(); }, [fetchClaim]);

  async function action(body: object) {
    setError('');
    setActing(true);
    try {
      await patch(`/api/vendor-claims/${id}`, body);
      await fetchClaim();
      setShowResolve(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally { setActing(false); }
  }

  function setRF(key: string, val: string) { setResolveForm((f) => ({ ...f, [key]: val })); }

  if (loading) return <div className="py-16 text-center text-gray-400">กำลังโหลด...</div>;
  if (!claim) return <div className="py-16 text-center text-gray-400">ไม่พบข้อมูล</div>;

  const resolutionTypeLabel = {
    credit_note: 'ใบลดหนี้',
    replacement_shipment: 'จัดส่งสินค้าทดแทน',
    both: 'ทั้งสองวิธี',
  } as Record<string, string>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{claim.claim_number}</h1>
        </div>
        <StatusBadge status={claim.status} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'ผู้จำหน่าย', value: `${claim.vendor_code} — ${claim.vendor_name}` },
          { label: 'คลังสินค้า', value: `${claim.warehouse_code} — ${claim.warehouse_name}` },
          { label: 'มูลค่าเรียกร้อง', value: formatCurrency(claim.claim_amount) },
          { label: 'วันที่สร้าง', value: formatDate(claim.created_at) },
        ].map((f) => (
          <div key={f.label} className="rounded-lg bg-white border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">{f.label}</p>
            <p className="text-sm font-medium">{f.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-xs text-gray-400 mb-1">รายละเอียดการเรียกร้อง</h2>
        <p className="text-sm">{claim.description}</p>
      </div>

      {claim.resolution_type && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-green-800 mb-3">ผลการแก้ไข</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">วิธีแก้ไข: </span><strong>{resolutionTypeLabel[claim.resolution_type]}</strong></div>
            {claim.credit_note_ref && <div><span className="text-gray-500">เลขใบลดหนี้: </span><strong>{claim.credit_note_ref}</strong></div>}
            {claim.credit_note_amount && <div><span className="text-gray-500">มูลค่าใบลดหนี้: </span><strong>{formatCurrency(claim.credit_note_amount)}</strong></div>}
            <div className="col-span-2"><span className="text-gray-500">หมายเหตุ: </span>{claim.resolution_notes}</div>
          </div>
        </div>
      )}

      {showResolve && (
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">บันทึกการแก้ไข</h2>
          <div className="space-y-4">
            <Select
              label="วิธีแก้ไข *"
              value={resolveForm.resolution_type}
              onChange={(e) => setRF('resolution_type', e.target.value)}
              options={[
                { value: 'credit_note', label: 'ใบลดหนี้' },
                { value: 'replacement_shipment', label: 'จัดส่งสินค้าทดแทน' },
                { value: 'both', label: 'ทั้งสองวิธี' },
              ]}
            />
            {['credit_note', 'both'].includes(resolveForm.resolution_type) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="เลขใบลดหนี้" value={resolveForm.credit_note_ref} onChange={(e) => setRF('credit_note_ref', e.target.value)} />
                <Input label="มูลค่าใบลดหนี้" type="number" value={resolveForm.credit_note_amount} onChange={(e) => setRF('credit_note_amount', e.target.value)} />
              </div>
            )}
            <Input label="รายละเอียดการแก้ไข *" value={resolveForm.resolution_notes} onChange={(e) => setRF('resolution_notes', e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="ghost" onClick={() => setShowResolve(false)}>ยกเลิก</Button>
            <Button onClick={() => action({
              action: 'resolve',
              resolution_type: resolveForm.resolution_type,
              credit_note_ref: resolveForm.credit_note_ref || undefined,
              credit_note_amount: resolveForm.credit_note_amount ? parseFloat(resolveForm.credit_note_amount) : undefined,
              resolution_notes: resolveForm.resolution_notes,
            })} loading={acting}>บันทึก</Button>
          </div>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 justify-end">
        {claim.status === 'open' && (
          <Button variant="secondary" onClick={() => action({ action: 'review' })} loading={acting}>เริ่มพิจารณา</Button>
        )}
        {['open', 'in_review'].includes(claim.status) && !showResolve && (
          <Button onClick={() => setShowResolve(true)}>แก้ไขแล้ว</Button>
        )}
        {claim.status === 'resolved' && (
          <Button variant="secondary" onClick={() => action({ action: 'close' })} loading={acting}>ปิดการเรียกร้อง</Button>
        )}
      </div>
    </div>
  );
}
