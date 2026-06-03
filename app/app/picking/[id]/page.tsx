'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button, StatusBadge, Input, Modal, ModalHeader, ModalBody, ModalFooter, Select } from '@/components/ui';
import { get, post, patch } from '@/lib/api-client';
import { formatDate, formatQty } from '@/lib/format';
import type { SessionUser } from '@/lib/authz';
import type { PickList, User, PickListLine } from '@/types';
import Link from 'next/link';
import { OverridePinModal } from '@/components/auth/OverridePinModal';
import { Barcode } from 'lucide-react';

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';

export default function PickListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const currentUser = session?.user as unknown as SessionUser;
  
  const [pickList, setPickList] = useState<PickList | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  
  // Modals
  const [showAssign, setShowAssign] = useState(false);
  const [showShipment, setShowShipment] = useState(false);
  
  // Modal states
  const [staff, setStaff] = useState<{ value: string; label: string }[]>([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [shipmentData, setShipmentData] = useState({
    ship_date: new Date().toISOString().split('T')[0],
    carrier: '',
    tracking_number: '',
    notes: '',
  });

  const [fefoViolation, setFefoViolation] = useState<{
    line_id: string;
    lot_id: string;
    earliest_lot_id: string;
    earliest_expiry: string;
  } | null>(null);

  const [showScan, setShowScan] = useState(false);
  const [scanningLine, setScanningLine] = useState<PickListLine | null>(null);
  const [lotBarcode, setLotBarcode] = useState('');

  const fetchPickList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<PickList>(`/api/pick-lists/${id}`);
      setPickList(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to fetch pick list');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPickList();
  }, [fetchPickList]);

  useEffect(() => {
    if (showAssign) {
      get<{ data: User[] }>('/api/admin/users?role=staff&limit=100').then((res) => {
        setStaff(res.data.map(u => ({ value: u.id, label: u.name_th || u.name_en })));
      }).catch(() => {
        // Fallback to employees if admin/users fails (for managers)
        get<{ data: User[] }>('/api/hr/employees?pageSize=100').then((res) => {
          setStaff(res.data.map(e => ({ value: e.id, label: e.name_th || e.name_en })));
        });
      });
    }
  }, [showAssign]);

  const handleAction = async (action: string, body: Record<string, unknown> = {}) => {
    setActing(true);
    setError('');
    try {
      await patch(`/api/pick-lists/${id}`, { action, ...body });
      await fetchPickList();
      setShowAssign(false);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || `Failed to ${action} pick list`);
    } finally {
      setActing(false);
    }
  };

  const handleCreateShipment = async () => {
    setActing(true);
    setError('');
    try {
      const res = await post<{ id: string }>('/api/shipments', {
        pick_list_id: id,
        ...shipmentData
      });
      router.push(`/app/shipments/${res.id}`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to create shipment');
      setActing(false);
    }
  };

  const handleUpdateLine = async (lineId: string, qty_picked?: number, storage_location?: string) => {
    try {
      await patch(`/api/pick-lists/${id}/lines/${lineId}`, {
        qty_picked,
        storage_location
      });
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to update line');
    }
  };

  async function handleScanLot(lotId: string, overrideToken?: string) {
    if (!scanningLine) return;
    setActing(true);
    try {
      await post(`/api/pick-lists/${id}/scan-lot`, {
        line_id: scanningLine.id,
        lot_id: lotId,
        override_token: overrideToken
      });
      setShowScan(false);
      setFefoViolation(null);
      await fetchPickList();
    } catch (err: unknown) {
      const e = err as { status?: number; details?: { code?: string; earliest_lot_id: string; earliest_expiry: string } };
      if (e.status === 409 && e.details?.code === 'FEFO_VIOLATION') {
        setFefoViolation({
          line_id: scanningLine.id,
          lot_id: lotId,
          earliest_lot_id: e.details.earliest_lot_id,
          earliest_expiry: e.details.earliest_expiry
        });
      } else {
        alert((err as Error).message || 'Scan failed');
      }
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div className="py-16 text-center text-stone-400 animate-pulse text-[13px]">กำลังโหลดข้อมูล...</div>;
  if (!pickList) return <div className="py-16 text-center text-red-500 text-[13px]">ไม่พบข้อมูลรายการหยิบสินค้า</div>;

  const isManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isAssigned = currentUser?.id === pickList.assigned_to;
  const canEditLines = pickList.status === 'picking' && (isManager || isAssigned);

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/app/picking" transitionTypes={['nav-back']} className="text-[13px] text-stone-400 hover:text-stone-600 mb-1 flex items-center gap-1 transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ย้อนกลับ
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-stone-900 font-mono tracking-tight">{pickList.pick_number}</h1>
            <StatusBadge status={pickList.status} />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {pickList.status === 'draft' && isManager && (
            <Button onClick={() => handleAction('open')} loading={acting} className="bg-blue-600 hover:bg-blue-700 text-white">
              เปิดรายการหยิบ (Open)
            </Button>
          )}
          
          {pickList.status === 'open' && isManager && (
            <Button onClick={() => setShowAssign(true)} variant="secondary">
              มอบหมายผู้หยิบสินค้า
            </Button>
          )}
          
          {pickList.status === 'picking' && (isManager || isAssigned) && (
            <Button onClick={() => handleAction('complete')} loading={acting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              ยืนยันหยิบครบถ้วน
            </Button>
          )}
          
          {pickList.status === 'completed' && isManager && (
            <Button onClick={() => setShowShipment(true)} className="bg-stone-900 hover:bg-stone-800 text-white">
              สร้างการจัดส่ง (Create Shipment)
            </Button>
          )}
          
          {(pickList.status === 'draft' || pickList.status === 'open') && isManager && (
            <Button onClick={() => handleAction('cancel')} variant="ghost" className="text-red-500 hover:bg-red-50">
              ยกเลิก
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 space-y-6">
          <div className={`${CARD} p-5 space-y-4`}>
            <h2 className="text-[11px] font-bold text-stone-400 uppercase tracking-[0.05em]">ข้อมูลทั่วไป</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <p className="text-[12px] text-stone-400 mb-0.5">คลังสินค้า</p>
                <p className="text-[14px] font-medium text-stone-900">{pickList.warehouse_name}</p>
              </div>
              <div>
                <p className="text-[12px] text-stone-400 mb-0.5">อ้างอิงใบสั่งขาย (SO)</p>
                {pickList.sales_order_id ? (
                  <Link href={`/app/sales-orders/${pickList.sales_order_id}`} className="text-[14px] font-medium text-blue-600 hover:underline font-mono">
                    {pickList.so_number}
                  </Link>
                ) : <p className="text-[14px] font-medium text-stone-400">—</p>}
              </div>
              <div>
                <p className="text-[12px] text-stone-400 mb-0.5">ผู้รับผิดชอบ</p>
                <p className="text-[14px] font-medium text-stone-900">{pickList.assigned_to_name || <span className="text-stone-400 italic">ยังไม่ได้มอบหมาย</span>}</p>
              </div>
              <div>
                <p className="text-[12px] text-stone-400 mb-0.5">สร้างโดย / เมื่อวันที่</p>
                <p className="text-[14px] font-medium text-stone-900">{pickList.created_by_name} · {formatDate(pickList.created_at)}</p>
              </div>
            </div>
            {pickList.notes && (
              <div className="pt-2 border-t border-stone-50">
                <p className="text-[12px] text-stone-400 mb-1">หมายเหตุ</p>
                <p className="text-[13px] text-stone-600 leading-relaxed">{pickList.notes}</p>
              </div>
            )}
          </div>

          <div className={`${CARD} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-stone-100 bg-stone-50/50">
              <h2 className="text-[11px] font-bold text-stone-400 uppercase tracking-[0.05em]">รายการสินค้าในใบหยิบ</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50/30 text-[11px] font-semibold text-stone-400 uppercase tracking-wider border-b border-stone-100 text-left">
                    <th className="px-5 py-2.5">สินค้า / SKU</th>
                    <th className="px-5 py-2.5">Suggested Lot (FEFO)</th>
                    <th className="px-5 py-2.5 text-right">ที่ต้องการ</th>
                    <th className="px-5 py-2.5 text-right">ที่หยิบได้</th>
                    <th className="px-5 py-2.5">ตำแหน่งเก็บ</th>
                    <th className="px-5 py-2.5 text-center">สถานะ</th>
                    {canEditLines && <th className="px-5 py-2.5 text-center">Scan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {pickList.lines?.map((line) => (
                    <tr key={line.id} className="hover:bg-stone-50/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-mono text-[11px] text-stone-400 leading-none mb-1">{line.product_sku}</div>
                        <div className="text-[13px] font-medium text-stone-900">{line.product_name}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-[12px] font-medium text-stone-900">{line.suggested_lot_number || '—'}</div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          {line.suggested_expiry ? formatDate(line.suggested_expiry) : 'No Expiry'}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-stone-500">
                        {formatQty(line.qty_requested)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canEditLines ? (
                          <input
                            type="number"
                            min="0"
                            max={line.qty_requested}
                            defaultValue={line.qty_picked}
                            onBlur={(e) => handleUpdateLine(line.id, Number(e.target.value))}
                            className="w-20 h-8 rounded border border-stone-200 px-2 py-1 text-[13px] font-mono text-right outline-none focus:border-emerald-400"
                          />
                        ) : (
                          <span className={`font-mono ${line.status === 'short_picked' ? 'text-amber-600 font-bold' : 'text-stone-900'}`}>
                            {formatQty(line.qty_picked)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {canEditLines ? (
                          <input
                            type="text"
                            defaultValue={line.storage_location || ''}
                            onBlur={(e) => handleUpdateLine(line.id, undefined, e.target.value)}
                            placeholder="ระบุตำแหน่ง..."
                            className="w-full h-8 rounded border border-stone-200 px-2 py-1 text-[12px] outline-none focus:border-emerald-400"
                          />
                        ) : (
                          <span className="text-[12px] text-stone-500">{line.storage_location || '—'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {line.status !== 'pending' ? (
                          <StatusBadge status={line.status} />
                        ) : (
                          <span className="text-[11px] text-stone-300">รอดำเนินการ</span>
                        )}
                      </td>
                      {canEditLines && (
                        <td className="px-5 py-3 text-center">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => { setScanningLine(line); setShowScan(true); }}
                            className="h-8 px-2"
                          >
                            <Barcode className="w-4 h-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Timeline or Summary can go here */}
          <div className={`${CARD} p-5`}>
            <h2 className="text-[11px] font-bold text-stone-400 uppercase tracking-[0.05em] mb-4 text-center">สรุปการหยิบสินค้า</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-stone-500">รวมรายการ</span>
                <span className="text-[15px] font-semibold text-stone-900">{pickList.lines?.length || 0} รายการ</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-stone-500">หยิบครบแล้ว</span>
                <span className="text-[15px] font-semibold text-emerald-600">
                  {pickList.lines?.filter(l => l.status === 'picked').length || 0}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-stone-500">หยิบไม่ครบ</span>
                <span className="text-[15px] font-semibold text-amber-600">
                  {pickList.lines?.filter(l => l.status === 'short_picked').length || 0}
                </span>
              </div>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-[12px] text-red-600 flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v4M8 11h0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} size="md">
        <ModalHeader onClose={() => setShowAssign(false)}>มอบหมายผู้หยิบสินค้า</ModalHeader>
        <ModalBody>
          <div className="space-y-4 py-2">
            <Select
              label="เลือกพนักงานที่รับผิดชอบ"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              options={staff}
              placeholder="ค้นหาชื่อพนักงาน..."
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowAssign(false)}>ยกเลิก</Button>
          <Button onClick={() => handleAction('assign', { assigned_to: assignedTo })} disabled={!assignedTo || acting} loading={acting}>
            ยืนยันการมอบหมาย
          </Button>
        </ModalFooter>
      </Modal>

      {/* Create Shipment Modal */}
      <Modal open={showShipment} onClose={() => setShowShipment(false)} size="md">
        <ModalHeader onClose={() => setShowShipment(false)}>สร้างใบจัดส่งสินค้า (Create Shipment)</ModalHeader>
        <ModalBody>
          <div className="space-y-4 py-2">
            <Input
              label="วันที่ส่งสินค้า"
              type="date"
              value={shipmentData.ship_date}
              onChange={(e) => setShipmentData({ ...shipmentData, ship_date: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="ผู้ขนส่ง (Carrier)"
                value={shipmentData.carrier}
                onChange={(e) => setShipmentData({ ...shipmentData, carrier: e.target.value })}
                placeholder="เช่น Kerry, Flash"
              />
              <Input
                label="เลข Tracking"
                value={shipmentData.tracking_number}
                onChange={(e) => setShipmentData({ ...shipmentData, tracking_number: e.target.value })}
                placeholder="ระบุถ้ามี"
              />
            </div>
            <Input
              label="หมายเหตุการจัดส่ง"
              value={shipmentData.notes}
              onChange={(e) => setShipmentData({ ...shipmentData, notes: e.target.value })}
              placeholder="ระบุข้อมูลเพิ่มเติมสำหรับการจัดส่ง"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowShipment(false)}>ยกเลิก</Button>
          <Button onClick={handleCreateShipment} disabled={acting} loading={acting} className="bg-stone-900 text-white">
            สร้างและบันทึกการจัดส่ง
          </Button>
        </ModalFooter>
      </Modal>

      {/* Scan Lot Modal */}
      <Modal open={showScan} onClose={() => setShowScan(false)} size="md">
        <ModalHeader onClose={() => setShowScan(false)}>สแกน Lot สินค้า</ModalHeader>
        <ModalBody>
          <div className="space-y-4 py-2">
            <div className="bg-stone-50 p-4 rounded-lg">
              <p className="text-[11px] font-bold text-stone-400 uppercase mb-1">สินค้าที่กำลังสแกน</p>
              <p className="text-[14px] font-medium text-stone-900">{scanningLine?.product_name}</p>
              <p className="text-[11px] font-mono text-stone-500">{scanningLine?.product_sku}</p>
            </div>
            
            <Input
              label="Lot ID / Barcode"
              value={lotBarcode}
              onChange={(e) => setLotBarcode(e.target.value)}
              placeholder="สแกนหรือระบุรหัส Lot..."
              autoFocus
            />
            
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
              <Barcode className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-[12px] text-blue-700">
                <strong>Suggested Lot:</strong> {scanningLine?.suggested_lot_number || '—'}
                <br />
                <strong>Expiry:</strong> {scanningLine?.suggested_expiry ? formatDate(scanningLine.suggested_expiry) : 'No Expiry'}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowScan(false)}>ยกเลิก</Button>
          <Button onClick={() => handleScanLot(lotBarcode)} disabled={!lotBarcode || acting} loading={acting}>
            ยืนยันการสแกน
          </Button>
        </ModalFooter>
      </Modal>

      {/* Override PIN Modal */}
      {fefoViolation && (
        <OverridePinModal
          isOpen={!!fefoViolation}
          action="fefo_violation"
          onSuccess={(token) => {
            if (fefoViolation) {
              handleScanLot(fefoViolation.lot_id, token);
            }
          }}
          onClose={() => setFefoViolation(null)}
        />
      )}
    </div>
  );
}
