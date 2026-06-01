'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import { get, post } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { Button, Select, Table, Thead, Tbody, Th, Td, Pagination, StatusBadge, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { useSession } from 'next-auth/react';
import type { VendorRebateAccrual, Vendor } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

interface JoinedAccrual extends VendorRebateAccrual {
  vendor_code: string;
  vendor_name_th: string;
  vendor_name_en: string;
  threshold_amount: number | string;
  rebate_rate: number | string;
  period: 'monthly' | 'quarterly' | 'annual';
}

const STATUS_OPTIONS = [
  { value: '', label: 'สถานะทั้งหมด / All Status' },
  { value: 'pending', label: 'กำลังสะสมยอด / Pending' },
  { value: 'accrued', label: 'สะสมครบตามเกณฑ์ / Accrued' },
  { value: 'realised', label: 'บันทึกบัญชีแล้ว / Realised' },
  { value: 'expired', label: 'หมดอายุ / Expired' }
];

export default function RebateAccrualsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [accruals, setAccruals] = useState<JoinedAccrual[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filterVendor, setFilterVendor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Recalculating state
  const [recalculating, setRecalculating] = useState(false);
  const [runMessage, setRunMessage] = useState('');

  // Realisation modal state
  const [isRealiseOpen, setIsRealiseOpen] = useState(false);
  const [selectedAccrual, setSelectedAccrual] = useState<JoinedAccrual | null>(null);
  const [creditAccount, setCreditAccount] = useState('4300'); // '4300' (income) or '5100' (cogs)
  const [realising, setRealising] = useState(false);
  const [realiseError, setRealiseError] = useState('');

  // Load vendors list
  useEffect(() => {
    get<{ data: Vendor[] }>('/api/vendors?limit=200')
      .then(res => setVendors(res.data))
      .catch(err => console.error('Failed to load vendors:', err));
  }, []);

  const fetchAccruals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (filterVendor) params.set('vendor_id', filterVendor);
      if (filterStatus) params.set('status', filterStatus);
      
      const res = await get<{ data: JoinedAccrual[]; total: number }>(`/api/rebate/accruals?${params}`);
      setAccruals(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterVendor, filterStatus]);

  useEffect(() => {
    fetchAccruals();
  }, [fetchAccruals]);

  // Recalculate job runner
  async function handleRecalculate() {
    setRecalculating(true);
    setRunMessage('');
    try {
      const res = await post<{ message: string; processedCount: number }>('/api/rebate/accruals', {});
      setRunMessage(`คำนวณเสร็จสิ้น! อัปเดตข้อมูลสำเร็จ ${res.processedCount} รายการ`);
      fetchAccruals();
    } catch (err) {
      const apiErr = err as { message?: string };
      setRunMessage(apiErr?.message || 'เกิดข้อผิดพลาดในการรันงานประมวลผล');
    } finally {
      setRecalculating(false);
    }
  }

  // Open Realise Dialog
  function handleOpenRealise(acc: JoinedAccrual) {
    setSelectedAccrual(acc);
    setCreditAccount('4300');
    setRealiseError('');
    setIsRealiseOpen(true);
  }

  // Confirm Realise Submission
  async function handleRealiseSubmit() {
    if (!selectedAccrual) return;
    setRealiseError('');
    setRealising(true);

    try {
      await post(`/api/rebate/accruals/${selectedAccrual.id}/realise`, {
        credit_account_code: creditAccount
      });
      setIsRealiseOpen(false);
      fetchAccruals();
    } catch (err) {
      const apiErr = err as { message?: string };
      setRealiseError(apiErr?.message || 'เกิดข้อผิดพลาดในการบันทึกบัญชีเงินคืน');
    } finally {
      setRealising(false);
    }
  }

  // Calculate high-signal totals from current loaded rows for client-side quick summary
  const summaryKpis = accruals.reduce((sum, item) => {
    const val = Number(item.accrued_rebate || 0);
    if (item.status === 'realised') {
      sum.realisedVal += val;
      sum.realisedCount++;
    } else if (item.status === 'accrued') {
      sum.accruedVal += val;
      sum.accruedCount++;
    } else if (item.status === 'pending') {
      sum.pendingVal += val;
      sum.pendingCount++;
    }
    return sum;
  }, { realisedVal: 0, realisedCount: 0, accruedVal: 0, accruedCount: 0, pendingVal: 0, pendingCount: 0 });

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              สะสมยอดเงินคืนของคู่ค้า / Vendor Rebate Accruals
            </h1>
            <p className="text-[13.5px] text-stone-500">
              Rebate Accruals · {loading ? '—' : total} รายการ
            </p>
          </div>
          <div className="flex items-center gap-2">
            {role !== 'auditor' && (
              <Button
                variant="accent"
                onClick={handleRecalculate}
                loading={recalculating}
                className="inline-flex items-center gap-1.5"
              >
                🔄 ประมวลผลยอดสะสม / Recalculate
              </Button>
            )}
          </div>
        </div>

        {/* Message notification */}
        {runMessage && (
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-[13.5px] border border-blue-200 flex justify-between items-center">
            <span>{runMessage}</span>
            <button onClick={() => setRunMessage('')} className="font-bold text-[12px] hover:text-blue-900 ml-4">ปิด / Close</button>
          </div>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <span className="text-[12.5px] font-medium text-stone-500">ยอดเงินคืนรับรู้แล้ว / Total Realised (AR)</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-[24px] font-bold text-stone-950 font-mono tabular-nums">
                {formatCurrency(summaryKpis.realisedVal)}
              </span>
              <span className="text-[12px] text-stone-500 font-medium">({summaryKpis.realisedCount} รายการ)</span>
            </div>
            <div className="mt-2 text-[11.5px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-0.5 self-start">
              บันทึกบัญชี AR-Rebate-Receivable แล้ว
            </div>
          </div>

          <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <span className="text-[12.5px] font-medium text-stone-500">ยอดรออนุมัติรับรู้ / Pending Realisation</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-[24px] font-bold text-purple-700 font-mono tabular-nums">
                {formatCurrency(summaryKpis.accruedVal)}
              </span>
              <span className="text-[12px] text-stone-500 font-medium">({summaryKpis.accruedCount} รายการ)</span>
            </div>
            <div className="mt-2 text-[11.5px] text-purple-700 bg-purple-50 border border-purple-100 rounded px-2 py-0.5 self-start">
              บรรลุเป้าหมายยอดซื้อแล้ว รอผู้จัดการอนุมัติ
            </div>
          </div>

          <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <span className="text-[12.5px] font-medium text-stone-500">ยอดอยู่ระหว่างสะสม / Active Accumulating</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-[24px] font-bold text-amber-700 font-mono tabular-nums">
                {formatCurrency(summaryKpis.pendingVal)}
              </span>
              <span className="text-[12px] text-stone-500 font-medium">({summaryKpis.pendingCount} รายการ)</span>
            </div>
            <div className="mt-2 text-[11.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-0.5 self-start">
              รอบสัญญายังเปิดอยู่ ยอดซื้อสะสมเพิ่มขึ้นต่อเนื่อง
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 bg-stone-50 p-3.5 rounded-lg border border-stone-200 flex-wrap">
          <div className="w-64">
            <Select
              placeholder="คู่ค้าทั้งหมด / All Vendors"
              value={filterVendor}
              onChange={(e) => { setFilterVendor(e.target.value); setPage(1); }}
              options={vendors.map(v => ({ value: v.id, label: `${v.code} — ${v.name_th}` }))}
            />
          </div>
          <div className="w-60">
            <Select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              options={STATUS_OPTIONS}
            />
          </div>
        </div>

        {/* Table card */}
        <div className={CARD}>
          <Table>
            <Thead>
              <tr>
                <Th className="pl-5">รอบสะสม / Period</Th>
                <Th>คู่ค้า / Vendor</Th>
                <Th className="text-right">ยอดซื้อสะสม / Purchases</Th>
                <Th className="text-right">เป้าหมายขั้นต่ำ / Target</Th>
                <Th className="text-right">สะสมเงินคืน / Accrued Rebate</Th>
                <Th className="text-center">สถานะ / Status</Th>
                <Th>อ้างอิงบัญชี / GL Ref</Th>
                <Th className="pr-5"></Th>
              </tr>
            </Thead>
            <Tbody>
              {loading ? (
                <tr>
                  <Td colSpan={8} className="py-12 text-center text-stone-600">กำลังโหลด...</Td>
                </tr>
              ) : accruals.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="py-12 text-center text-stone-600">ไม่พบรายการเงินคืนสะสม</Td>
                </tr>
              ) : (
                accruals.map((a) => (
                  <tr key={a.id} className="hover:bg-stone-50/60 border-b border-stone-100 last:border-0 transition-colors">
                    <Td className="pl-5 font-mono text-[13px] font-bold text-stone-850">{a.period_label}</Td>
                    <Td>
                      <div className="font-medium text-stone-900">{a.vendor_name_th}</div>
                      <div className="text-[11px] text-stone-500 font-mono">{a.vendor_code}</div>
                    </Td>
                    <Td className="text-right font-mono tabular-nums text-stone-900 font-medium">
                      {formatCurrency(a.eligible_purchases)}
                    </Td>
                    <Td className="text-right font-mono tabular-nums text-stone-500 text-[12.5px]">
                      {formatCurrency(a.threshold_amount)}
                    </Td>
                    <Td className="text-right font-mono tabular-nums text-purple-700 font-bold text-[14px]">
                      {formatCurrency(a.accrued_rebate)}
                    </Td>
                    <Td className="text-center">
                      <StatusBadge status={a.status} />
                    </Td>
                    <Td>
                      {a.posted_je_id ? (
                        <span className="font-mono text-[11.5px] text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">
                          {a.posted_je_id.substring(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-stone-400">—</span>
                      )}
                    </Td>
                    <Td className="pr-5 text-right">
                      {a.status === 'accrued' && role !== 'auditor' && (
                        <Button
                          size="sm"
                          variant="accent"
                          onClick={() => handleOpenRealise(a)}
                          className="shadow-sm"
                        >
                          รับรู้เงินคืน / Realise
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>

        {total > 20 && (
          <div className="flex justify-end mt-4">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / 20)}
              onPageChange={setPage}
            />
          </div>
        )}

        {/* Realisation Confirmation Modal */}
        {isRealiseOpen && selectedAccrual && (
          <Modal onClose={() => setIsRealiseOpen(false)}>
            <ModalHeader>บันทึกบัญชีรับรู้ยอดเงินคืนคู่ค้า / Realise Rebate Accrual</ModalHeader>
            <ModalBody className="space-y-4">
              {realiseError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-[13px] border border-red-200">
                  {realiseError}
                </div>
              )}

              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2.5">
                <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                  <span className="text-[13px] text-stone-500">คู่ค้า / Vendor</span>
                  <span className="text-[13.5px] font-bold text-stone-900">{selectedAccrual.vendor_code} — {selectedAccrual.vendor_name_th}</span>
                </div>
                <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                  <span className="text-[13px] text-stone-500">รอบสะสม / Period</span>
                  <span className="text-[13.5px] font-mono font-bold text-stone-900">{selectedAccrual.period_label}</span>
                </div>
                <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                  <span className="text-[13px] text-stone-500">ยอดซื้อสะสม / Purchases</span>
                  <span className="text-[13.5px] font-mono text-stone-900">{formatCurrency(selectedAccrual.eligible_purchases)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-stone-500">จำนวนเงินคืนที่ได้รับ / Rebate Earned</span>
                  <span className="text-[16px] font-mono font-bold text-purple-700">{formatCurrency(selectedAccrual.accrued_rebate)}</span>
                </div>
              </div>

              <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-[12.5px] border border-amber-200 leading-relaxed">
                <strong>💡 การบันทึกบัญชีเงินคืนคู่ค้า (Double-Entry Posting):</strong>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li><strong>เดบิต (DR):</strong> 1220 - ลูกหนี้ค่าส่วนลดรับ (Rebate Receivable)</li>
                  <li><strong>เครดิต (CR):</strong> [บัญชีที่เลือกด้านล่าง]</li>
                </ul>
              </div>

              <Select
                label="เลือกบัญชีเครดิตเพื่อรับรู้รายการ / Credit Account Allocation"
                value={creditAccount}
                onChange={(e) => setCreditAccount(e.target.value)}
                options={[
                  { value: '4300', label: '4300 — รายได้ส่วนลดการค้า (Rebate Income)' },
                  { value: '5100', label: '5100 — ลดต้นทุนสินค้าที่ขาย (Reduce COGS)' }
                ]}
              />
            </ModalBody>
            <ModalFooter>
              <Button onClick={() => setIsRealiseOpen(false)}>ยกเลิก / Cancel</Button>
              <Button variant="accent" onClick={handleRealiseSubmit} loading={realising}>
                ยืนยันการรับรู้และบันทึกบัญชี / Confirm & Post
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </div>
    </DirectionalTransition>
  );
}
