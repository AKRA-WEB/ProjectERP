'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Thead, Tbody, Th, Td, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Input, Select } from '@/components/ui';
import { get, post, patch, del } from '@/lib/api-client';
import type { Warehouse } from '@/types';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import { ChevronDown, ChevronRight, Plus, Trash2, Edit2, ShieldAlert } from 'lucide-react';

interface WarehouseWithStats extends Warehouse {
  user_count?: number;
}

interface WarehouseZone {
  id: string;
  warehouse_id: string;
  code: string;
  thermal_type: 'ambient' | 'sensitive' | 'chilled' | 'frozen';
  created_at: string;
}

interface VirtualLocation {
  id: string;
  code: string;
  purpose: 'buffer' | 'damage' | 'clearance' | 'scrap' | 'repack';
  is_sellable: boolean;
  visible_channels: string[];
  created_at: string;
}

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editWh, setEditWh] = useState<Warehouse | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: '', name_th: '', name_en: '', address_th: '', address_en: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Expandable Row State
  const [expandedWhId, setExpandedWhId] = useState<string | null>(null);
  const [zones, setZones] = useState<Record<string, WarehouseZone[]>>({});
  const [virtualLocs, setVirtualLocs] = useState<VirtualLocation[]>([]);

  // Zone Form State
  const [zoneModal, setZoneModal] = useState<{ open: boolean; warehouseId: string; zoneId?: string } | null>(null);
  const [zoneForm, setZoneForm] = useState({ code: '', thermal_type: 'ambient' as 'ambient' | 'sensitive' | 'chilled' | 'frozen' });
  const [zoneSaving, setZoneSaving] = useState(false);
  const [zoneError, setZoneError] = useState('');

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<WarehouseWithStats[]>('/api/admin/warehouses');
      setWarehouses(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
    get<VirtualLocation[]>('/api/admin/virtual-locations')
      .then(setVirtualLocs)
      .catch((e) => console.error('Failed to load virtual locations', e));
  }, [fetchWarehouses]);

  const loadZones = useCallback(async (whId: string) => {
    try {
      const res = await get<WarehouseZone[]>(`/api/admin/warehouse-zones?warehouse_id=${whId}`);
      setZones((z) => ({ ...z, [whId]: res }));
    } catch (e) {
      console.error('Failed to load zones', e);
    }
  }, []);

  const toggleExpand = useCallback(async (whId: string) => {
    if (expandedWhId === whId) {
      setExpandedWhId(null);
    } else {
      setExpandedWhId(whId);
      await loadZones(whId);
    }
  }, [expandedWhId, loadZones]);

  function openCreate() {
    setForm({ code: '', name_th: '', name_en: '', address_th: '', address_en: '' });
    setError('');
    setShowCreate(true);
  }

  function openEdit(wh: Warehouse) {
    setForm({ 
      code: wh.code, 
      name_th: wh.name_th, 
      name_en: wh.name_en, 
      address_th: wh.address_th ?? '', 
      address_en: wh.address_en ?? '' 
    });
    setError('');
    setEditWh(wh);
  }

  function setF(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      if (editWh) {
        await patch(`/api/admin/warehouses/${editWh.id}`, { name_th: form.name_th, name_en: form.name_en, address_th: form.address_th || null, address_en: form.address_en || null });
        setEditWh(null);
      } else {
        await post('/api/admin/warehouses', form);
        setShowCreate(false);
      }
      fetchWarehouses();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  // Zone Management Handlers
  function openAddZone(whId: string) {
    setZoneForm({ code: '', thermal_type: 'ambient' });
    setZoneError('');
    setZoneModal({ open: true, warehouseId: whId });
  }

  function openEditZone(whId: string, zone: WarehouseZone) {
    setZoneForm({ code: zone.code, thermal_type: zone.thermal_type });
    setZoneError('');
    setZoneModal({ open: true, warehouseId: whId, zoneId: zone.id });
  }

  async function handleDeleteZone(whId: string, zoneId: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบโซนควบคุมอุณหภูมินี้? / Are you sure you want to delete this thermal zone?')) return;
    try {
      await del(`/api/admin/warehouse-zones/${zoneId}`);
      await loadZones(whId);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'ลบโซนล้มเหลว');
    }
  }

  async function handleSaveZone() {
    if (!zoneForm.code.trim()) {
      setZoneError('กรุณากรอกรหัสโซน / Please provide zone code');
      return;
    }
    setZoneError('');
    setZoneSaving(true);
    const { warehouseId, zoneId } = zoneModal!;
    try {
      if (zoneId) {
        await patch(`/api/admin/warehouse-zones/${zoneId}`, zoneForm);
      } else {
        await post('/api/admin/warehouse-zones', { warehouse_id: warehouseId, ...zoneForm });
      }
      setZoneModal(null);
      await loadZones(warehouseId);
    } catch (e: unknown) {
      setZoneError(e instanceof Error ? e.message : 'บันทึกโซนล้มเหลว');
    } finally {
      setZoneSaving(false);
    }
  }

  const isOpen = showCreate || !!editWh;
  const isEdit = !!editWh;

  const thermalTypeBadges: Record<string, { label: string; variant: 'gray' | 'yellow' | 'blue' | 'red' }> = {
    ambient: { label: 'Ambient (ทั่วไป)', variant: 'gray' },
    sensitive: { label: 'Sensitive (อ่อนไหว)', variant: 'yellow' },
    chilled: { label: 'Chilled (แช่เย็น)', variant: 'blue' },
    frozen: { label: 'Frozen (แช่แข็ง)', variant: 'red' },
  };

  const virtualPurposeLabels: Record<string, string> = {
    buffer: 'Buffer (สำรอง)',
    damage: 'Damage & Claims (กักกัน/เสียหาย)',
    clearance: 'Clearance (สต็อกรอระบาย)',
    scrap: 'Scrap & Write-off (เศษซาก)',
    repack: 'Repack Staging (รอรีแพ็ค)',
  };

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">คลังสินค้า / Warehouses</h1>
            <p className="text-sm text-gray-500">{warehouses.length} คลัง</p>
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto">+ เพิ่มคลัง</Button>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <Table>
            <Thead>
              <tr>
                <Th className="w-[40px]"></Th>
                <Th>รหัส / Code</Th>
                <Th>ชื่อ (TH)</Th>
                <Th className="hidden sm:table-cell">Name (EN)</Th>
                <Th className="hidden sm:table-cell">ผู้ใช้ / Users</Th>
                <Th>สถานะ</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {loading ? (
                <tr><Td colSpan={7}><div className="py-8 text-center text-gray-400">กำลังโหลด...</div></Td></tr>
              ) : (
                warehouses.map((w) => {
                  const isExpanded = expandedWhId === w.id;
                  return (
                    <Tbody key={w.id}>
                      <tr className={`hover:bg-gray-50/80 transition-colors ${isExpanded ? 'bg-stone-50/40' : ''}`}>
                        <Td>
                          <button onClick={() => toggleExpand(w.id)} className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors focus:outline-none">
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                        </Td>
                        <Td className="font-mono font-medium text-sm text-stone-700">{w.code}</Td>
                        <Td className="text-sm font-medium text-stone-900">{w.name_th}</Td>
                        <Td className="text-sm text-gray-500 hidden sm:table-cell">{w.name_en}</Td>
                        <Td className="text-sm hidden sm:table-cell text-stone-600">{w.user_count ?? 0} คน</Td>
                        <Td>
                          <Badge variant={w.is_active ? 'green' : 'gray'}>
                            {w.is_active ? 'ใช้งาน' : 'ปิด'}
                          </Badge>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-3">
                            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium" onClick={() => openEdit(w)}>แก้ไข</button>
                            <button className="text-sm text-stone-500 hover:text-stone-700 font-medium" onClick={() => toggleExpand(w.id)}>
                              {isExpanded ? 'ซ่อนโซน' : 'ดูโซน'}
                            </button>
                          </div>
                        </Td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-stone-50/50">
                          <Td colSpan={7} className="px-8 py-6 border-b border-stone-100">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                              {/* Thermal Zones Column */}
                              <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-stone-200/60 pb-2">
                                  <div>
                                    <h3 className="font-bold text-stone-900 text-sm">โซนควบคุมอุณหภูมิ / Thermal Zones</h3>
                                    <p className="text-[11px] text-stone-400">ควบคุมและกักกันประเภทอุณหภูมิสำหรับ Cold-Chain</p>
                                  </div>
                                  <Button onClick={() => openAddZone(w.id)} size="sm" className="h-7 text-xs px-2.5 flex items-center gap-1 bg-stone-900 hover:bg-stone-800">
                                    <Plus size={14} /> เพิ่มโซน / Add Zone
                                  </Button>
                                </div>

                                <div className="bg-white rounded-lg border border-stone-200/50 overflow-hidden shadow-xs">
                                  <Table>
                                    <Thead>
                                      <tr>
                                        <Th className="py-2 text-[11px] font-bold text-stone-500">รหัสโซน / Code</Th>
                                        <Th className="py-2 text-[11px] font-bold text-stone-500">ประเภทอุณหภูมิ / Type</Th>
                                        <Th className="py-2"></Th>
                                      </tr>
                                    </Thead>
                                    <Tbody>
                                      {!zones[w.id] || zones[w.id].length === 0 ? (
                                        <tr><Td colSpan={3} className="py-6 text-center text-xs text-stone-400">ไม่มีโซนควบคุม / No Thermal Zones</Td></tr>
                                      ) : (
                                        zones[w.id].map((z) => (
                                          <tr key={z.id} className="hover:bg-stone-50/50">
                                            <Td className="py-2.5 font-mono text-xs font-semibold text-stone-700">{z.code}</Td>
                                            <Td className="py-2.5">
                                              <Badge variant={thermalTypeBadges[z.thermal_type]?.variant ?? 'gray'} className="text-[11px] px-2 py-0.5 font-medium">
                                                {thermalTypeBadges[z.thermal_type]?.label ?? z.thermal_type}
                                              </Badge>
                                            </Td>
                                            <Td className="py-2.5 text-right pr-4">
                                              <div className="flex items-center justify-end gap-3.5">
                                                <button onClick={() => openEditZone(w.id, z)} className="text-stone-400 hover:text-blue-600 transition-colors p-1" title="แก้ไข">
                                                  <Edit2 size={13} />
                                                </button>
                                                <button onClick={() => handleDeleteZone(w.id, z.id)} className="text-stone-400 hover:text-red-600 transition-colors p-1" title="ลบ">
                                                  <Trash2 size={13} />
                                                </button>
                                              </div>
                                            </Td>
                                          </tr>
                                        ))
                                      )}
                                    </Tbody>
                                  </Table>
                                </div>
                              </div>

                              {/* Virtual Locations Reference Column */}
                              <div className="space-y-4">
                                <div className="border-b border-stone-200/60 pb-2">
                                  <h3 className="font-bold text-stone-900 text-sm">คลังเสมือน / Virtual Locations</h3>
                                  <p className="text-[11px] text-stone-400">คลังทางสถิติและกักกันระดับระบบ (Global / Non-Physical)</p>
                                </div>

                                <div className="bg-white rounded-lg border border-stone-200/50 overflow-hidden shadow-xs">
                                  <Table>
                                    <Thead>
                                      <tr>
                                        <Th className="py-2 text-[11px] font-bold text-stone-500">รหัส / Code</Th>
                                        <Th className="py-2 text-[11px] font-bold text-stone-500">วัตถุประสงค์ / Purpose</Th>
                                        <Th className="py-2 text-[11px] font-bold text-stone-500 text-center">พร้อมขาย / Sellable</Th>
                                        <Th className="py-2 text-[11px] font-bold text-stone-500">ช่องทางขาย / Channels</Th>
                                      </tr>
                                    </Thead>
                                    <Tbody>
                                      {virtualLocs.length === 0 ? (
                                        <tr><Td colSpan={4} className="py-6 text-center text-xs text-stone-400">ไม่มีข้อมูลคลังเสมือน / No Virtual Locations</Td></tr>
                                      ) : (
                                        virtualLocs.map((vl) => (
                                          <tr key={vl.id} className="hover:bg-stone-50/50">
                                            <Td className="py-2.5 font-mono text-xs font-bold text-stone-700">{vl.code}</Td>
                                            <Td className="py-2.5 text-xs text-stone-600 font-medium">{virtualPurposeLabels[vl.purpose] ?? vl.purpose}</Td>
                                            <Td className="py-2.5 text-center">
                                              <Badge variant={vl.is_sellable ? 'green' : 'gray'} className="text-[10px] px-1.5 py-0.2">
                                                {vl.is_sellable ? 'Yes' : 'No'}
                                              </Badge>
                                            </Td>
                                            <Td className="py-2.5">
                                              {vl.visible_channels && vl.visible_channels.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                  {vl.visible_channels.map(c => (
                                                    <span key={c} className="text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">{c}</span>
                                                  ))}
                                                </div>
                                              ) : (
                                                <span className="text-[11px] text-stone-400">ทุกช่องทาง / All</span>
                                              )}
                                            </Td>
                                          </tr>
                                        ))
                                      )}
                                    </Tbody>
                                  </Table>
                                </div>
                              </div>
                            </div>
                          </Td>
                        </tr>
                      )}
                    </Tbody>
                  );
                })
              )}
            </Tbody>
          </Table>
        </div>

        {/* Warehouse Create/Edit Modal */}
        {isOpen && (
          <Modal open onClose={() => { setShowCreate(false); setEditWh(null); }}>
            <ModalHeader>{isEdit ? 'แก้ไขคลังสินค้า' : 'เพิ่มคลังสินค้าใหม่'}</ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <Input label="รหัสคลัง / Code *" value={form.code} onChange={(e) => setF('code', e.target.value)} disabled={isEdit} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="ชื่อ (TH) *" value={form.name_th} onChange={(e) => setF('name_th', e.target.value)} />
                  <Input label="Name (EN) *" value={form.name_en} onChange={(e) => setF('name_en', e.target.value)} />
                  <Input label="ที่อยู่ (TH)" value={form.address_th} onChange={(e) => setF('address_th', e.target.value)} />
                  <Input label="Address (EN)" value={form.address_en} onChange={(e) => setF('address_en', e.target.value)} />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setEditWh(null); }}>ยกเลิก</Button>
              <Button onClick={handleSave} loading={saving}>{isEdit ? 'บันทึก' : 'สร้างคลัง'}</Button>
            </ModalFooter>
          </Modal>
        )}

        {/* Zone Add/Edit Modal */}
        {zoneModal?.open && (
          <Modal open onClose={() => setZoneModal(null)}>
            <ModalHeader>{zoneModal.zoneId ? 'แก้ไขโซนควบคุมอุณหภูมิ / Edit Zone' : 'เพิ่มโซนควบคุมอุณหภูมิ / Add Zone'}</ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <Input 
                  label="รหัสโซน / Zone Code *" 
                  placeholder="เช่น S1, C1, Z-FREEZE" 
                  value={zoneForm.code} 
                  onChange={(e) => setZoneForm(z => ({ ...z, code: e.target.value }))}
                />
                
                <Select
                  label="ประเภทการคุมอุณหภูมิ / Thermal Type *"
                  value={zoneForm.thermal_type}
                  onChange={(e) => setZoneForm(z => ({ ...z, thermal_type: e.target.value as 'ambient' | 'sensitive' | 'chilled' | 'frozen' }))}
                  options={[
                    { value: 'ambient', label: 'Ambient (ควบคุมอุณหภูมิปกติ)' },
                    { value: 'sensitive', label: 'Sensitive (อ่อนไหวต่อสิ่งแวดล้อม)' },
                    { value: 'chilled', label: 'Chilled (แช่เย็น / Cold Chain)' },
                    { value: 'frozen', label: 'Frozen (แช่แข็ง / Deep Cold)' }
                  ]}
                />

                {zoneError && (
                  <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-100">
                    <ShieldAlert size={14} className="shrink-0" />
                    <span>{zoneError}</span>
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setZoneModal(null)}>ยกเลิก</Button>
              <Button onClick={handleSaveZone} loading={zoneSaving}>
                {zoneModal.zoneId ? 'บันทึก / Save' : 'เพิ่มโซน / Add Zone'}
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </div>
    </DirectionalTransition>
  );
}
