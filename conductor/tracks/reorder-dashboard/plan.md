# Reorder Point Dashboard + Auto-PR

**Goal:** Show all products with `qty_available <= reorder_point` per warehouse, let users select items and create a PR in one click.

**No migrations required.** Data already exists: `stock_balances.qty_available`, `products.reorder_point`.

---

## Schema Reference

```
products: id, sku, name_th, name_en, reorder_point, unit_cost, uom_id, is_active
stock_balances: (warehouse_id, product_id) PK, qty_on_hand, qty_available (GENERATED)
warehouses: id, code, name_th
units_of_measure: id, code
```

---

## Tasks

### Task 1 — API: GET /api/inventory/reorder

- [x] Create `app/api/inventory/reorder/route.ts`:

```typescript
import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';
import { buildWarehouseScopeClause } from '@/lib/authz';
import type { SessionUser } from '@/lib/authz';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouse_id');

  const conditions: string[] = ['p.is_active = TRUE', 'sb.qty_available <= p.reorder_point'];
  const params: unknown[] = [];
  let idx = 1;

  const scope = buildWarehouseScopeClause(u, 'sb.warehouse_id', idx);
  if (scope) { conditions.push(scope.clause); params.push(...scope.params); idx += scope.params.length; }

  if (warehouseId) { conditions.push(`sb.warehouse_id = $${idx++}`); params.push(warehouseId); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = await query(
    `SELECT
       p.id            AS product_id,
       p.sku,
       p.name_th,
       p.name_en,
       p.unit_cost,
       p.reorder_point,
       u.code          AS uom_code,
       w.id            AS warehouse_id,
       w.code          AS warehouse_code,
       w.name_th       AS warehouse_name,
       sb.qty_on_hand,
       sb.qty_available,
       (p.reorder_point - sb.qty_available) AS qty_deficit
     FROM stock_balances sb
     JOIN products p         ON p.id = sb.product_id
     JOIN units_of_measure u ON u.id = p.uom_id
     JOIN warehouses w       ON w.id = sb.warehouse_id
     ${where}
     ORDER BY qty_deficit DESC, p.sku`,
    params
  );

  return apiSuccess(rows);
}
```

- [x] Run `npm run lint` → no errors
- [x] Commit: `feat(inventory): GET /api/inventory/reorder — products below reorder_point per warehouse`

---

### Task 2 — Reorder Dashboard Page

- [x] Create `app/app/inventory/reorder/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import type { Warehouse } from '@/types';

interface ReorderItem {
  product_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  unit_cost: number;
  reorder_point: number;
  uom_code: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  qty_on_hand: number;
  qty_available: number;
  qty_deficit: number;
}

const CARD = 'bg-white border border-stone-200 rounded-[10px] shadow-[0_1px_0_rgba(15,23,42,.03),0_1px_2px_rgba(15,23,42,.04)]';
const BTN_PRIMARY = 'h-9 px-4 rounded-[8px] text-[13px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors';
const BTN_OUTLINE = 'h-9 px-4 rounded-[8px] text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 shadow-[0_1px_0_rgba(15,23,42,.03)] inline-flex items-center gap-1.5';

function SeverityBadge({ qty, reorderPoint }: { qty: number; reorderPoint: number }) {
  if (qty <= 0) return (
    <span className="px-2 py-[2px] rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">หมดสต็อก</span>
  );
  return (
    <span className="px-2 py-[2px] rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">ใกล้หมด</span>
  );
}

export default function ReorderDashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<ReorderItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    const url = warehouseId ? `/api/inventory/reorder?warehouse_id=${warehouseId}` : '/api/inventory/reorder';
    const rows = await get<ReorderItem[]>(url).catch(() => []);
    setItems(rows);
    setLoading(false);
  }, [warehouseId]);

  useEffect(() => {
    get<Warehouse[]>('/api/admin/warehouses').then((data) => {
      setWarehouses(data.filter((w) => w.is_active));
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleItem(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => `${i.warehouse_id}:${i.product_id}`)));
    }
  }

  async function createPR() {
    const selectedItems = items.filter((i) => selected.has(`${i.warehouse_id}:${i.product_id}`));
    if (selectedItems.length === 0) return;

    // Group by warehouse — one PR per warehouse
    const byWarehouse = new Map<string, ReorderItem[]>();
    for (const item of selectedItems) {
      const group = byWarehouse.get(item.warehouse_id) ?? [];
      group.push(item);
      byWarehouse.set(item.warehouse_id, group);
    }

    setCreating(true);
    setError('');
    try {
      const prs: string[] = [];
      for (const [wid, wItems] of byWarehouse.entries()) {
        const pr = await post<{ id: string }>('/api/purchase-requests', {
          warehouse_id: wid,
          notes: 'สร้างจาก Reorder Dashboard อัตโนมัติ',
          lines: wItems.map((item) => ({
            product_id: item.product_id,
            qty_requested: Math.ceil(item.qty_deficit),
            unit_cost: item.unit_cost,
            notes: `Reorder point: ${item.reorder_point} ${item.uom_code}`,
          })),
        });
        prs.push(pr.id);
      }

      if (prs.length === 1) {
        router.push(`/app/purchase-requests/${prs[0]}`);
      } else {
        router.push('/app/purchase-requests');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
      setCreating(false);
    }
  }

  const outOfStock = items.filter((i) => i.qty_available <= 0).length;
  const lowStock = items.filter((i) => i.qty_available > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Reorder Dashboard</h1>
          <p className="text-sm text-stone-500 mt-0.5">สินค้าที่ถึงจุด Reorder — เลือกแล้วสร้าง PR</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={createPR}
              disabled={creating}
              className={BTN_PRIMARY}
            >
              {creating ? 'กำลังสร้าง…' : `สร้าง PR (${selected.size} รายการ)`}
            </button>
          )}
          <button onClick={load} className={BTN_OUTLINE}>รีเฟรช</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'หมดสต็อก', value: outOfStock, color: 'text-red-600' },
          { label: 'ใกล้หมด', value: lowStock, color: 'text-amber-600' },
          { label: 'รวม', value: items.length, color: 'text-stone-700' },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-4`}>
            <p className="text-[12px] text-stone-500">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className={`${CARD} p-4 flex items-center gap-4`}>
        <label className="text-[12px] font-medium text-stone-600">คลังสินค้า</label>
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          className="bg-white border border-stone-200 rounded-[7px] px-3 py-[7px] text-[13px] text-stone-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 min-w-[220px]"
        >
          <option value="">ทุกคลัง</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.code} — {w.name_th}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3 rounded-[8px] bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className={CARD}>
        {loading ? (
          <div className="p-8 text-center text-sm text-stone-400">กำลังโหลด…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-400">ไม่มีสินค้าที่ต้องสั่งซื้อ</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={toggleAll} />
                </th>
                <th className="px-4 py-3 text-left font-medium text-stone-600">สินค้า</th>
                <th className="px-4 py-3 text-left font-medium text-stone-600">คลัง</th>
                <th className="px-4 py-3 text-right font-medium text-stone-600">Reorder Point</th>
                <th className="px-4 py-3 text-right font-medium text-stone-600">พร้อมขาย</th>
                <th className="px-4 py-3 text-right font-medium text-stone-600">ขาด</th>
                <th className="px-4 py-3 text-right font-medium text-stone-600">ต้นทุน/หน่วย</th>
                <th className="px-4 py-3 text-center font-medium text-stone-600">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const key = `${item.warehouse_id}:${item.product_id}`;
                return (
                  <tr key={key} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(key)} onChange={() => toggleItem(key)} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-stone-900 font-mono text-[12px]">{item.sku}</span>
                      <p className="text-stone-500 text-[12px]">{item.name_th}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{item.warehouse_code}</td>
                    <td className="px-4 py-3 text-right text-stone-700 tabular-nums">{item.reorder_point} {item.uom_code}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{Number(item.qty_available).toFixed(0)} {item.uom_code}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600 font-medium">{Number(item.qty_deficit).toFixed(0)} {item.uom_code}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.unit_cost)}</td>
                    <td className="px-4 py-3 text-center">
                      <SeverityBadge qty={Number(item.qty_available)} reorderPoint={item.reorder_point} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [x] Run `npm run lint` → no errors
- [x] Start `npm run dev`, open `/app/inventory/reorder`
- [x] Verify table loads, summary cards show counts, warehouse filter works
- [x] Verify: select items → "สร้าง PR (N รายการ)" button appears → click → redirects to new PR
- [x] Commit: `feat(inventory): reorder dashboard page with auto-PR creation`

---

### Task 3 — Add Sidebar Link

- [x] In `components/layout/Sidebar.tsx`, inside the `คลังสินค้า / Inventory` group add after `cycle-counts`:

```typescript
{ href: '/app/inventory/reorder', label: 'Reorder Dashboard', icon: AlertTriangle, permission: 'inventory:view' },
```

Note: `AlertTriangle` is already imported in the file (used in Claims nav item). Verify with `grep "AlertTriangle" components/layout/Sidebar.tsx` before adding.

- [x] Start `npm run dev`, verify sidebar shows new link under Inventory group
- [x] Commit: `feat(inventory): add Reorder Dashboard to sidebar`
