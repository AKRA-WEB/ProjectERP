'use client';

import { useState, useEffect, useCallback, forwardRef, useRef, TextareaHTMLAttributes } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, StatusBadge, Input, Select } from '@/components/ui';
import { get, post, patch } from '@/lib/api-client';
import { formatDate, formatQty, formatCurrency } from '@/lib/format';
import type { InboundOrder, SessionUser, Product } from '@/types';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTransition } from '@/lib/react-vts';
import { cn } from '@/lib/utils';
import { z } from 'zod';

// Local Textarea component to match Input style in design system
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col w-full">
        {label && (
          <label htmlFor={inputId} className="text-[13px] font-medium text-ink-2 mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'bg-white border border-line rounded-[8px] px-3 py-2 text-[13.5px] text-ink-1 placeholder:text-ink-4 transition-all min-h-[80px] w-full',
            'focus:outline-none focus:border-accent focus:ring-0 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]',
            error ? 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(220,38,38,0.14)]' : '',
            props.disabled && 'cursor-not-allowed bg-surface-sunken text-ink-3',
            className
          )}
          aria-invalid={!!error}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-[12px] text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// Local Alert components
function Alert({ children, variant = 'destructive', className = '' }: { children: React.ReactNode; variant?: 'destructive' | 'info'; className?: string }) {
  const bgClass = variant === 'destructive' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800';
  return (
    <div className={`p-4 rounded-lg border ${bgClass} ${className}`} role="alert">
      {children}
    </div>
  );
}

function AlertDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium">{children}</p>;
}

interface ProductSearchProps {
  value: string;
  onSelect: (product: Product) => void;
  onClear: () => void;
  disabled?: boolean;
}

function ProductSearch({ value, onSelect, onClear, disabled }: ProductSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await get<{ data: Product[] }>(
          `/api/products?search=${encodeURIComponent(query)}&limit=20`
        );
        const products = Array.isArray(res) 
          ? res 
          : (res && typeof res === 'object' && 'data' in res ? (res as { data: Product[] }).data : []);
        setResults(products);
        setOpen(products.length > 0);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="w-full rounded border px-2 py-1 text-sm bg-white min-h-[36px]"
          placeholder="พิมพ์ชื่อหรือ SKU..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          disabled={disabled}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); onClear(); }}
            className="text-gray-400 hover:text-gray-600 text-xs px-1"
            aria-label="ล้าง"
          >
            ✕
          </button>
        )}
      </div>
      {open && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {loading && (
            <p className="px-3 py-2 text-xs text-gray-400">กำลังค้นหา...</p>
          )}
          {!loading && results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
              onClick={() => {
                const label = `${p.sku} — ${p.name_th}`;
                setQuery(label);
                setOpen(false);
                onSelect(p);
              }}
            >
              <span className="font-mono text-xs text-gray-500 mr-2">{p.sku}</span>
              {p.name_th}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface IOLine {
  id: string;
  product_id: string;
  sku: string;
  name_th: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
  uom_code: string;
  qty_available: number;
}

interface IODetail extends InboundOrder {
  lines: IOLine[];
  grns: Array<{
    id: string;
    grn_number: string;
    status: string;
    received_date: string;
    received_by_name: string;
    rejection_notes?: string | null;
    received_by_names?: string | null;
  }>;
}

const headerSchema = z.object({
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ไม่ถูกต้อง (Format must be YYYY-MM-DD)'),
  notes: z.string().nullable().optional(),
});

const warehouseSchema = z.object({
  warehouse_id: z.string().uuid('รูปแบบรหัสคลังไม่ถูกต้อง (Invalid Warehouse ID)'),
});

const lineQtySchema = z.object({
  qty_ordered: z.number({ message: 'กรุณาระบุจำนวนสินค้า' }).int('จำนวนต้องเป็นจำนวนเต็ม').positive('จำนวนต้องมากกว่า 0'),
});

const lineCostSchema = z.object({
  unit_cost: z.number({ message: 'กรุณาระบุต้นทุนสินค้า' }).nonnegative('ต้นทุนต้องไม่ติดลบ'),
});

export default function InboundOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const session = useSession();
  const [, startTransition] = useTransition();

  const [io, setIo] = useState<IODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendorRef, setVendorRef] = useState('');
  const [error, setError] = useState('');

  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Inline Edit states
  const [editMode, setEditMode] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editWarehouseId, setEditWarehouseId] = useState<string>('');
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name_th: string; code: string }>>([]);
  const [warehousesLoaded, setWarehousesLoaded] = useState(false);
  const [editLines, setEditLines] = useState<Array<{
    id?: string;
    product_id: string;
    sku: string;
    name_th: string;
    qty_ordered: string;
    uom_code: string;
    unit_cost: string;
  }>>([]);

  // Permission Logic
  const userRole = (session.data?.user as unknown as SessionUser | undefined)?.role;
  const isManagerOrAdmin = userRole === 'manager' || userRole === 'admin';
  const canEditHeader = io?.status === 'open';
  const canEditWarehouse = io?.status === 'open' && isManagerOrAdmin;
  const canEditCosts = io?.status !== 'closed' && isManagerOrAdmin;
  const canEditAnything = canEditHeader || canEditWarehouse || canEditCosts;

  const fetchIO = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get<IODetail>(`/api/inbound-orders/${id}`);
      setIo(data);
      if (data.vendor_ref) setVendorRef(data.vendor_ref);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'ไม่สามารถดึงข้อมูลได้ (Failed to fetch Inbound Order)');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchIO(); }, [fetchIO]);

  // Load warehouses lazily if the user has permission to change warehouse
  useEffect(() => {
    if (!canEditWarehouse || warehousesLoaded) return;
    get<Array<{ id: string; name_th: string; code: string }>>('/api/admin/warehouses')
      .then((data) => {
        setWarehouses(data);
        setWarehousesLoaded(true);
      })
      .catch(() => setWarehouses([]));
  }, [canEditWarehouse, warehousesLoaded]);

  const initEditState = useCallback(() => {
    if (!io) return;
    setEditDate(io.order_date.slice(0, 10));
    setEditNotes(io.notes ?? '');
    setEditWarehouseId(String(io.warehouse_id));
    const linesList = io.lines.map((l) => ({
      id: l.id,
      product_id: l.product_id,
      sku: l.sku,
      name_th: l.name_th,
      qty_ordered: String(l.qty_ordered),
      uom_code: l.uom_code,
      unit_cost: String(l.unit_cost),
    }));
    setEditLines(linesList);
    setEditError(null);
  }, [io]);

  const handleEnterEdit = useCallback(() => {
    initEditState();
    setEditMode(true);
  }, [initEditState]);

  const addEditLine = useCallback(() => {
    setEditLines((prev) => [
      ...prev,
      {
        product_id: '',
        sku: '',
        name_th: '',
        qty_ordered: '1',
        uom_code: '',
        unit_cost: '0',
      },
    ]);
  }, []);

  const removeEditLine = useCallback((index: number) => {
    setEditLines((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const selectEditLineProduct = useCallback((index: number, product: Product) => {
    setEditLines((prev) => {
      const newLines = [...prev];
      newLines[index] = {
        ...newLines[index],
        product_id: product.id,
        sku: product.sku,
        name_th: product.name_th,
        uom_code: product.uom_code || '',
        unit_cost: String(product.unit_cost || 0),
      };
      return newLines;
    });
  }, []);

  const clearEditLineProduct = useCallback((index: number) => {
    setEditLines((prev) => {
      const newLines = [...prev];
      newLines[index] = {
        ...newLines[index],
        product_id: '',
        sku: '',
        name_th: '',
        uom_code: '',
        unit_cost: '0',
      };
      return newLines;
    });
  }, []);

  const updateEditLineQty = useCallback((index: number, val: string) => {
    setEditLines((prev) => {
      const newLines = [...prev];
      newLines[index] = { ...newLines[index], qty_ordered: val };
      return newLines;
    });
  }, []);

  const updateEditLineCost = useCallback((index: number, val: string) => {
    setEditLines((prev) => {
      const newLines = [...prev];
      newLines[index] = { ...newLines[index], unit_cost: val };
      return newLines;
    });
  }, []);

  async function handleConfirmGRN(grnId: string) {
    setActionLoading(true); setActionError('');
    try { await post(`/api/grn/${grnId}/confirm`, {}); await fetchIO(); }
    catch (e: unknown) { setActionError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด'); }
    finally { setActionLoading(false); }
  }

  async function handleRejectGRN(grnId: string) {
    if (!rejectReason.trim()) { setActionError('กรุณาระบุเหตุผล'); return; }
    setActionLoading(true); setActionError('');
    try {
      await post(`/api/grn/${grnId}/reject`, { reason: rejectReason });
      setRejecting(false); setRejectReason(''); await fetchIO();
    }
    catch (e: unknown) { setActionError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด'); }
    finally { setActionLoading(false); }
  }

  async function handleClose() {
    if (!vendorRef) { setError('กรุณาระบุเลขที่อ้างอิงจากผู้จำหน่าย'); return; }
    setError('');
    setSaving(true);
    try {
      await post(`/api/inbound-orders/${id}/close`, { vendor_ref: vendorRef });
      await fetchIO();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  async function saveHeader() {
    if (!io) return;
    setSaving(true);
    setEditError(null);
    try {
      const parsed = headerSchema.safeParse({
        order_date: editDate,
        notes: editNotes || null,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0].message);
      }

      await patch(`/api/inbound-orders/${id}`, {
        action: 'update_header',
        order_date: editDate,
        notes: editNotes || null,
      });
      await fetchIO();
      startTransition(() => {
        router.refresh();
      });
      setEditMode(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  async function saveLines() {
    if (!io) return;
    setSaving(true);
    setEditError(null);
    try {
      if (editLines.length === 0) {
        throw new Error('ต้องมีรายการสินค้าอย่างน้อย 1 รายการ');
      }

      const linesData = editLines.map((l, index) => {
        if (!l.product_id) {
          throw new Error(`รายการที่ ${index + 1}: กรุณาเลือกสินค้า`);
        }
        const val = l.qty_ordered;
        const num = val === '' ? undefined : Number(val);
        
        const parsed = lineQtySchema.safeParse({ qty_ordered: num });
        if (!parsed.success) {
          throw new Error(`${l.sku || `รายการที่ ${index + 1}`}: ${parsed.error.issues[0].message}`);
        }
        
        return {
          id: l.id,
          product_id: l.product_id,
          qty_ordered: num as number,
        };
      });

      await patch(`/api/inbound-orders/${id}`, {
        action: 'update_lines',
        lines: linesData,
      });
      await fetchIO();
      startTransition(() => {
        router.refresh();
      });
      setEditMode(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  async function saveWarehouse() {
    if (!io) return;
    setSaving(true);
    setEditError(null);
    try {
      const parsed = warehouseSchema.safeParse({
        warehouse_id: editWarehouseId,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0].message);
      }

      await patch(`/api/inbound-orders/${id}`, {
        action: 'change_warehouse',
        warehouse_id: editWarehouseId,
      });
      await fetchIO();
      startTransition(() => {
        router.refresh();
      });
      setEditMode(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  async function saveCosts() {
    if (!io) return;
    setSaving(true);
    setEditError(null);
    try {
      const costsData = editLines.map((l, index) => {
        if (!l.id) {
          throw new Error('กรุณาบันทึกรายการสินค้าก่อนแก้ไขต้นทุน');
        }
        const val = l.unit_cost;
        const num = val === '' ? undefined : Number(val);
        
        const parsed = lineCostSchema.safeParse({ unit_cost: num });
        if (!parsed.success) {
          throw new Error(`${l.sku || `รายการที่ ${index + 1}`}: ${parsed.error.issues[0].message}`);
        }
        
        return {
          id: l.id,
          unit_cost: num as number,
        };
      });

      await patch(`/api/inbound-orders/${id}`, {
        action: 'update_costs',
        lines: costsData,
      });
      await fetchIO();
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-16 text-center text-gray-400">กำลังโหลด...</div>;
  if (!io) {
    return (
      <div className="py-16 text-center text-gray-400">
        <p className="mb-4">{error || 'ไม่พบข้อมูล (Inbound Order not found)'}</p>
        <Button onClick={fetchIO}>โหลดใหม่ (Reload)</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => router.back()}>← ย้อนกลับ</button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{io.io_number}</h1>
            {canEditAnything && !editMode && (
              <Button variant="outline" size="sm" onClick={handleEnterEdit} className="min-h-[44px] px-4 font-normal text-sm">
                แก้ไข
              </Button>
            )}
            {editMode && (
              <Button variant="ghost" size="sm" onClick={() => { setEditMode(false); setEditError(null); }} disabled={saving} className="min-h-[44px] px-4 font-normal text-sm text-gray-500">
                ยกเลิก
              </Button>
            )}
          </div>
        </div>
        <StatusBadge status={io.status} />
      </div>

      {editError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{editError}</AlertDescription>
        </Alert>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Vendor */}
        <div className="rounded-lg bg-white border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">ผู้จำหน่าย / Vendor</p>
          <p className="text-sm font-medium mt-1">{io.vendor_name}</p>
        </div>

        {/* Warehouse */}
        <div className="rounded-lg bg-white border border-gray-100 p-4 sm:col-span-2">
          <p className="text-xs text-gray-400 mb-1">คลังสินค้า / Warehouse</p>
          {editMode && canEditWarehouse ? (
            <div className="flex gap-2 items-center mt-1">
              <Select
                value={editWarehouseId}
                onChange={(e) => setEditWarehouseId(e.target.value)}
                options={warehouses.map((w) => ({ value: String(w.id), label: `${w.code} — ${w.name_th}` }))}
                disabled={saving}
                placeholder="เลือกคลังสินค้า"
                className="min-h-[44px] flex-1"
              />
              <Button
                onClick={saveWarehouse}
                disabled={saving || editWarehouseId === String(io.warehouse_id)}
                className="min-h-[44px]"
                size="sm"
              >
                {saving ? 'บันทึก...' : 'บันทึกคลัง'}
              </Button>
            </div>
          ) : (
            <p className="text-sm font-medium mt-1">{io.warehouse_code} — {io.warehouse_name}</p>
          )}
        </div>

        {/* Order Date */}
        <div className="rounded-lg bg-white border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">วันที่สั่ง / Order Date</p>
          {editMode && canEditHeader ? (
            <div className="flex gap-2 items-center mt-1">
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="min-h-[44px] w-full"
                disabled={saving}
              />
            </div>
          ) : (
            <p className="text-sm font-medium mt-1">{formatDate(io.order_date)}</p>
          )}
        </div>

        {/* Creator */}
        <div className="rounded-lg bg-white border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">ผู้สร้าง / Creator</p>
          <p className="text-sm font-medium mt-1">{io.created_by_name}</p>
        </div>
      </div>

      {/* Notes / Context */}
      {(io.notes || (editMode && canEditHeader)) && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
          <p className="text-xs text-blue-600 font-medium uppercase tracking-wider mb-1.5">หมายเหตุ / Context from LINE</p>
          {editMode && canEditHeader ? (
            <div className="space-y-3">
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="หมายเหตุ (ถ้ามี)"
                disabled={saving}
                className="min-h-[44px]"
              />
              <div className="flex justify-end">
                <Button onClick={saveHeader} disabled={saving} className="min-h-[44px]">
                  {saving ? 'กำลังบันทึก...' : 'บันทึกหัวเอกสาร'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-blue-900 whitespace-pre-wrap">{io.notes}</p>
          )}
        </div>
      )}

      {/* Items Table */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 mb-6">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold text-gray-700">รายการสินค้า / Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-3 font-medium">SKU / สินค้า</th>
              <th className="text-right p-3 font-medium w-24">สั่ง</th>
              <th className="text-right p-3 font-medium w-24">รับแล้ว</th>
              <th className="text-right p-3 font-medium w-24">สต็อก WH</th>
              <th className="text-right p-3 font-medium w-32">ทุนต่อหน่วย</th>
              {editMode && canEditHeader && <th className="w-12"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {editMode ? (
              editLines.map((l, idx) => {
                const matched = io.lines.find((ol) => ol.id === l.id);
                const qtyReceived = matched ? matched.qty_received : 0;
                const qtyAvailable = matched ? matched.qty_available : 0;

                return (
                  <tr key={l.id ?? `new-line-${idx}`}>
                    <td className="p-3">
                      {canEditHeader ? (
                        <ProductSearch
                          value={l.sku ? `${l.sku} — ${l.name_th}` : ''}
                          onSelect={(product) => selectEditLineProduct(idx, product)}
                          onClear={() => clearEditLineProduct(idx)}
                          disabled={saving}
                        />
                      ) : (
                        <>
                          <div className="font-mono text-xs text-gray-400">{l.sku}</div>
                          <div className="font-medium">{l.name_th}</div>
                        </>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {canEditHeader ? (
                        <input
                          type="number"
                          min={1}
                          value={l.qty_ordered}
                          onChange={(e) => updateEditLineQty(idx, e.target.value)}
                          className="min-h-[44px] w-24 text-right border border-gray-300 rounded px-2 py-1"
                          disabled={saving}
                        />
                      ) : (
                        <>{formatQty(Number(l.qty_ordered))}</>
                      )}
                    </td>
                    <td className={`p-3 text-right font-mono ${qtyReceived >= Number(l.qty_ordered) ? 'text-green-600 font-bold' : 'text-gray-900'}`}>
                      {formatQty(qtyReceived)}
                    </td>
                    <td className="p-3 text-right font-mono text-gray-400">
                      {formatQty(qtyAvailable)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {canEditCosts ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.unit_cost}
                          onChange={(e) => updateEditLineCost(idx, e.target.value)}
                          className="min-h-[44px] w-28 text-right border border-gray-300 rounded px-2 py-1"
                          disabled={saving}
                        />
                      ) : (
                        <>{formatCurrency(Number(l.unit_cost))}</>
                      )}
                    </td>
                    {canEditHeader && (
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeEditLine(idx)}
                          className="text-red-500 hover:text-red-700 font-bold px-2 py-1"
                          disabled={saving}
                          aria-label="ลบรายการ"
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              io.lines.map((l) => (
                <tr key={l.id}>
                  <td className="p-3">
                    <div className="font-mono text-xs text-gray-400">{l.sku}</div>
                    <div className="font-medium">{l.name_th}</div>
                  </td>
                  <td className="p-3 text-right font-mono">
                    {formatQty(l.qty_ordered)}
                  </td>
                  <td className={`p-3 text-right font-mono ${Number(l.qty_received) >= Number(l.qty_ordered) ? 'text-green-600 font-bold' : 'text-gray-900'}`}>
                    {formatQty(l.qty_received)}
                  </td>
                  <td className="p-3 text-right font-mono text-gray-400">{formatQty(l.qty_available)}</td>
                  <td className="p-3 text-right font-mono">
                    {formatCurrency(l.unit_cost)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {editMode && (canEditHeader || canEditCosts) && (
          <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
            <div>
              {canEditHeader && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={addEditLine}
                  disabled={saving}
                  className="min-h-[44px]"
                >
                  + เพิ่มรายการ
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {canEditHeader && (
                <Button onClick={saveLines} disabled={saving} className="min-h-[44px]">
                  {saving ? 'กำลังบันทึก...' : 'บันทึกจำนวน'}
                </Button>
              )}
              {canEditCosts && (
                <Button onClick={saveCosts} disabled={saving} variant="outline" className="min-h-[44px]">
                  {saving ? 'กำลังบันทึก...' : 'บันทึกต้นทุน'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {io.grns.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700">ใบรับสินค้าที่เชื่อมโยง / Linked GRNs</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-3 font-medium">เลข GRN</th>
                <th className="text-left p-3 font-medium">วันที่รับ</th>
                <th className="text-left p-3 font-medium">ผู้รับ</th>
                <th className="text-center p-3 font-medium">สถานะ</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {io.grns.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50/50">
                  <td className="p-3 font-mono">{g.grn_number}</td>
                  <td className="p-3">
                    <div>{formatDate(g.received_date)}</div>
                    {g.received_by_names && <div className="text-xs text-gray-400 mt-0.5 font-medium">ผู้ลงสินค้า: {g.received_by_names}</div>}
                  </td>
                  <td className="p-3">{g.received_by_name}</td>
                  <td className="p-3 text-center">
                    <StatusBadge status={g.status} />
                    {g.status === 'rejected' && g.rejection_notes && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2 text-left max-w-xs mx-auto animate-fadeIn">
                        ⚠️ ตีกลับ: {g.rejection_notes}
                      </div>
                    )}
                    {g.status === 'received' && (
                      <div className="mt-2 space-y-2">
                        {actionError && <p className="text-xs text-red-600">{actionError}</p>}
                        {!rejecting ? (
                          <div className="flex justify-center gap-2">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleConfirmGRN(g.id)} loading={actionLoading}>
                              ✅ ยืนยันการรับสินค้า
                            </Button>
                            <Button size="sm" variant="outline" className="border-red-600 text-red-600 hover:bg-red-50" onClick={() => setRejecting(true)}>
                              ↩ ตีกลับ
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 p-2 bg-gray-50 border border-gray-100 rounded-lg max-w-sm mx-auto text-left animate-fadeIn">
                            <label className="text-xs font-semibold text-gray-600">ระบุเหตุผลการตีกลับ</label>
                            <Input
                              placeholder="ระบุเหตุผล..."
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <div className="flex gap-2 justify-end mt-1">
                              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleRejectGRN(g.id)} loading={actionLoading}>
                                ยืนยันการตีกลับ
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => { setRejecting(false); setRejectReason(''); }}>
                                ยกเลิก
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Link href={`/app/grn/${g.id}`} className="text-blue-600 hover:underline">ดู</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-end justify-end">
        {io.status === 'verified' && (
          <div className="w-full sm:w-80 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <label className="block text-xs font-medium text-gray-500 uppercase mb-2">บันทึกเลขอ้างอิงผู้จำหน่าย (เช่น เลขบิล)</label>
            <div className="flex gap-2">
              <Input placeholder="เลขที่บิล / Invoice..." value={vendorRef} onChange={(e) => setVendorRef(e.target.value)} className="bg-white" />
              <Button onClick={handleClose} loading={saving}>ปิด IO</Button>
            </div>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        )}

        {['open', 'receiving', 'pending_verification'].includes(io.status) && (
          <Link href={`/app/grn/new?io_id=${io.id}`}>
            <Button size="lg">สร้างใบรับสินค้า (GRN)</Button>
          </Link>
        )}
      </div>

      {io.status === 'closed' && (
        <div className="mt-6 rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
          <p className="text-gray-500 font-medium">รายการนี้ปิดแล้ว</p>
          <div className="mt-2 text-sm text-gray-400 space-y-1">
            <p>เลขอ้างอิงผู้จำหน่าย: <span className="font-mono text-gray-600">{io.vendor_ref}</span></p>
            <p>ตรวจสอบโดย: {io.verified_by_name} เมื่อ {io.verified_at ? formatDate(io.verified_at) : '—'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
