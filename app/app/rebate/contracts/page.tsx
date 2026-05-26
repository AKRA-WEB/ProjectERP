'use client';

import { useState, useEffect, useCallback } from 'react';
import { get, post, patch } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/format';
import { Button, Input, Select, Modal, ModalHeader, ModalBody, ModalFooter, Table, Thead, Tbody, Th, Td, Pagination } from '@/components/ui';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { useSession } from 'next-auth/react';
import type { VendorRebateContract, Vendor } from '@/types';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

interface JoinedContract extends VendorRebateContract {
  vendor_code: string;
  vendor_name_th: string;
  vendor_name_en: string;
}

export default function RebateContractsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [contracts, setContracts] = useState<JoinedContract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filterVendor, setFilterVendor] = useState('');
  
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<JoinedContract | null>(null);
  
  // Form states
  const [form, setForm] = useState({
    vendor_id: '',
    threshold_amount: '',
    rebate_rate: '',
    period: 'monthly',
    valid_from: '',
    valid_to: '',
  });
  
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load vendors list for selectors
  useEffect(() => {
    get<{ data: Vendor[] }>('/api/vendors?limit=200')
      .then(res => setVendors(res.data))
      .catch(err => console.error('Failed to load vendors:', err));
  }, []);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (filterVendor) params.set('vendor_id', filterVendor);
      
      const res = await get<{ data: JoinedContract[]; total: number }>(`/api/rebate/contracts?${params}`);
      setContracts(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterVendor]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  function handleOpenCreate() {
    setForm({
      vendor_id: vendors[0]?.id || '',
      threshold_amount: '',
      rebate_rate: '',
      period: 'monthly',
      valid_from: new Date().toISOString().split('T')[0],
      valid_to: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0], // Dec 31
    });
    setFormError('');
    setIsCreateOpen(true);
  }

  function handleOpenEdit(c: JoinedContract) {
    setEditingContract(c);
    setForm({
      vendor_id: c.vendor_id,
      threshold_amount: String(c.threshold_amount),
      rebate_rate: String(c.rebate_rate),
      period: c.period,
      valid_from: c.valid_from ? new Date(c.valid_from).toISOString().split('T')[0] : '',
      valid_to: c.valid_to ? new Date(c.valid_to).toISOString().split('T')[0] : '',
    });
    setFormError('');
    setIsEditOpen(true);
  }

  async function handleCreateSubmit() {
    setFormError('');
    
    if (!form.vendor_id || !form.threshold_amount || !form.rebate_rate || !form.valid_from || !form.valid_to) {
      setFormError('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง');
      return;
    }

    setSubmitting(true);
    try {
      await post('/api/rebate/contracts', {
        vendor_id: form.vendor_id,
        threshold_amount: parseFloat(form.threshold_amount),
        rebate_rate: parseFloat(form.rebate_rate),
        period: form.period,
        valid_from: form.valid_from,
        valid_to: form.valid_to
      });
      setIsCreateOpen(false);
      fetchContracts();
    } catch (err) {
      const apiErr = err as { message?: string };
      setFormError(apiErr?.message || 'เกิดข้อผิดพลาดในการสร้างสัญญา');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSubmit() {
    if (!editingContract) return;
    setFormError('');

    if (!form.threshold_amount || !form.rebate_rate || !form.valid_from || !form.valid_to) {
      setFormError('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง');
      return;
    }

    setSubmitting(true);
    try {
      await patch(`/api/rebate/contracts/${editingContract.id}`, {
        threshold_amount: parseFloat(form.threshold_amount),
        rebate_rate: parseFloat(form.rebate_rate),
        valid_from: form.valid_from,
        valid_to: form.valid_to
      });
      setIsEditOpen(false);
      fetchContracts();
    } catch (err) {
      const apiErr = err as { message?: string };
      setFormError(apiErr?.message || 'เกิดข้อผิดพลาดในการแก้ไขสัญญา');
    } finally {
      setSubmitting(false);
    }
  }

  const periodLabelsMap: Record<string, string> = {
    monthly: 'รายเดือน (Monthly)',
    quarterly: 'รายไตรมาส (Quarterly)',
    annual: 'รายปี (Annual)'
  };

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              สัญญาเงินคืนของคู่ค้า / Vendor Rebate Contracts
            </h1>
            <p className="text-[13.5px] text-stone-500">
              Rebate Contracts · {loading ? '—' : total} รายการ
            </p>
          </div>
          <div className="flex items-center gap-2">
            {role !== 'auditor' && (
              <Button
                variant="primary"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5"
              >
                + สร้างสัญญาใหม่
              </Button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 bg-stone-50 p-3.5 rounded-lg border border-stone-200">
          <div className="w-64">
            <Select
              placeholder="คู่ค้าทั้งหมด / All Vendors"
              value={filterVendor}
              onChange={(e) => { setFilterVendor(e.target.value); setPage(1); }}
              options={vendors.map(v => ({ value: v.id, label: `${v.code} — ${v.name_th}` }))}
            />
          </div>
        </div>

        {/* Table card */}
        <div className={CARD}>
          <Table>
            <Thead>
              <tr>
                <Th className="pl-5">รหัสคู่ค้า / Vendor Code</Th>
                <Th>ชื่อคู่ค้า / Vendor Name</Th>
                <Th>รอบสะสม / Period</Th>
                <Th className="text-right">ยอดซื้อขั้นต่ำ / Threshold</Th>
                <Th className="text-right">อัตราเงินคืน / Rebate Rate</Th>
                <Th>วันเริ่มสัญญา / Start Date</Th>
                <Th>วันสิ้นสุดสัญญา / End Date</Th>
                <Th className="pr-5"></Th>
              </tr>
            </Thead>
            <Tbody>
              {loading ? (
                <tr>
                  <Td colSpan={8} className="py-12 text-center text-stone-600">กำลังโหลด...</Td>
                </tr>
              ) : contracts.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="py-12 text-center text-stone-600">ไม่พบสัญญาเงินคืน</Td>
                </tr>
              ) : (
                contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/60 border-b border-stone-100 last:border-0 transition-colors">
                    <Td className="pl-5 font-mono text-[12.5px] font-medium text-stone-900">{c.vendor_code}</Td>
                    <Td>
                      <div className="font-medium text-stone-900">{c.vendor_name_th}</div>
                      <div className="text-[11px] text-stone-500 font-mono">{c.vendor_name_en}</div>
                    </Td>
                    <Td className="font-medium text-stone-700">{periodLabelsMap[c.period] ?? c.period}</Td>
                    <Td className="text-right font-mono tabular-nums text-stone-900 font-medium">
                      {formatCurrency(c.threshold_amount)}
                    </Td>
                    <Td className="text-right font-mono tabular-nums text-emerald-700 font-medium">
                      {c.rebate_rate}%
                    </Td>
                    <Td className="font-mono text-stone-500">{formatDate(c.valid_from)}</Td>
                    <Td className="font-mono text-stone-500">{formatDate(c.valid_to)}</Td>
                    <Td className="pr-5 text-right">
                      {role !== 'auditor' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenEdit(c)}
                        >
                          แก้ไข / Edit
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

        {/* Create Modal */}
        {isCreateOpen && (
          <Modal onClose={() => setIsCreateOpen(false)}>
            <ModalHeader>+ สร้างสัญญาเงินคืนคู่ค้า / Create Rebate Contract</ModalHeader>
            <ModalBody className="space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-[13px] border border-red-200">
                  {formError}
                </div>
              )}
              
              <Select
                label="เลือกคู่ค้า / Vendor"
                value={form.vendor_id}
                onChange={(e) => setForm(f => ({ ...f, vendor_id: e.target.value }))}
                options={vendors.map(v => ({ value: v.id, label: `${v.code} — ${v.name_th}` }))}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="ยอดซื้อขั้นต่ำสะสม (THB) / Threshold"
                  type="number"
                  placeholder="เช่น 100000"
                  value={form.threshold_amount}
                  onChange={(e) => setForm(f => ({ ...f, threshold_amount: e.target.value }))}
                />
                <Input
                  label="อัตราเงินคืน (%) / Rebate Rate"
                  type="number"
                  step="0.01"
                  placeholder="เช่น 2.00"
                  value={form.rebate_rate}
                  onChange={(e) => setForm(f => ({ ...f, rebate_rate: e.target.value }))}
                />
              </div>

              <Select
                label="รอบสะสมยอดเงินคืน / Period"
                value={form.period}
                onChange={(e) => setForm(f => ({ ...f, period: e.target.value }))}
                options={[
                  { value: 'monthly', label: 'รายเดือน / Monthly' },
                  { value: 'quarterly', label: 'รายไตรมาส / Quarterly' },
                  { value: 'annual', label: 'รายปี / Annual' }
                ]}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="วันเริ่มสัญญา / Start Date"
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm(f => ({ ...f, valid_from: e.target.value }))}
                />
                <Input
                  label="วันสิ้นสุดสัญญา / End Date"
                  type="date"
                  value={form.valid_to}
                  onChange={(e) => setForm(f => ({ ...f, valid_to: e.target.value }))}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button onClick={() => setIsCreateOpen(false)}>ยกเลิก / Cancel</Button>
              <Button variant="primary" onClick={handleCreateSubmit} loading={submitting}>
                ยืนยันสร้างสัญญา / Confirm
              </Button>
            </ModalFooter>
          </Modal>
        )}

        {/* Edit Modal */}
        {isEditOpen && (
          <Modal onClose={() => setIsEditOpen(false)}>
            <ModalHeader>แก้ไขสัญญาเงินคืนคู่ค้า / Edit Rebate Contract</ModalHeader>
            <ModalBody className="space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-[13px] border border-red-200">
                  {formError}
                </div>
              )}
              
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-1">
                <div className="text-[12px] text-stone-500">คู่ค้า / Vendor</div>
                <div className="text-[14px] font-medium text-stone-800">
                  {editingContract?.vendor_code} — {editingContract?.vendor_name_th}
                </div>
                <div className="text-[11.5px] text-stone-500">
                  รอบสะสม: {editingContract && periodLabelsMap[editingContract.period]}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="ยอดซื้อขั้นต่ำสะสม (THB) / Threshold"
                  type="number"
                  placeholder="เช่น 100000"
                  value={form.threshold_amount}
                  onChange={(e) => setForm(f => ({ ...f, threshold_amount: e.target.value }))}
                />
                <Input
                  label="อัตราเงินคืน (%) / Rebate Rate"
                  type="number"
                  step="0.01"
                  placeholder="เช่น 2.00"
                  value={form.rebate_rate}
                  onChange={(e) => setForm(f => ({ ...f, rebate_rate: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="วันเริ่มสัญญา / Start Date"
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm(f => ({ ...f, valid_from: e.target.value }))}
                />
                <Input
                  label="วันสิ้นสุดสัญญา / End Date"
                  type="date"
                  value={form.valid_to}
                  onChange={(e) => setForm(f => ({ ...f, valid_to: e.target.value }))}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button onClick={() => setIsEditOpen(false)}>ยกเลิก / Cancel</Button>
              <Button variant="primary" onClick={handleEditSubmit} loading={submitting}>
                บันทึกการแก้ไข / Save Changes
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </div>
    </DirectionalTransition>
  );
}
