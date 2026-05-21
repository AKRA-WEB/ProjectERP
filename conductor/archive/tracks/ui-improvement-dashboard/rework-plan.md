# Rework Plan — UI Improvement Dashboard
**Date:** 2026-05-16
**Auditor:** Claude (direct file verification)
**Status:** Rework Required

## Summary

API (`/api/kpi`) was fully extended with new fields (`pos_today`, `top_products`, `recent_activity`, `pending_so`). The UI (`app/app/dashboard/page.tsx`) was NOT updated to consume or render these new fields. The `KPIData` interface is also stale.

All rework is in a single file: `app/app/dashboard/page.tsx`

---

## Issues

| ID | Severity | Description |
|----|----------|-------------|
| R-001 | Must Fix | `KPIData` interface missing `sales`, `pos_today`, `top_products`, `recent_activity` fields |
| R-002 | Must Fix | Only 4 KpiCards rendered — plan requires 6 (add SO Pending + POS Today) |
| R-003 | Must Fix | Top Selling Products section not rendered — `kpi.top_products` available but unused |
| R-004 | Should Fix | Activity feed uses `kpi?.recent_ledger` (WMS-only) instead of `kpi?.recent_activity` (cross-module) |

---

## R-001 — KPIData Interface Fix

In `app/app/dashboard/page.tsx`, extend the `KPIData` interface (currently ends at line ~44):

```typescript
interface KPIData {
  // ... existing fields ...
  sales?: { pending_so: number; revenue_30d: string | number; revenue_today: string | number };
  pos_today?: { revenue: string | number; tx_count: number };
  top_products?: Array<{
    sku: string;
    name_th: string;
    qty_sold: string | number;
    tx_count: string | number;
  }>;
  recent_activity?: Array<{
    type: string;
    ref: string;
    action: string;
    created_at: string;
  }>;
}
```

---

## R-002 — Add 2 Missing KpiCards

After the existing 4th KpiCard (สินค้าใกล้หมด) and before `</KpiGrid>`, add:

```tsx
<KpiCard
  label="SO รอดำเนินการ"
  value={d(kpi?.sales?.pending_so)}
  subValue={<>รายได้ 30 วัน: <span className="font-mono text-[10.5px]">{kpi?.sales?.revenue_30d ? formatCurrency(kpi.sales.revenue_30d) : '—'}</span></>}
  sparkline={<Sparkline data={SPARK.pr} color="#6366f1" />}
  href="/app/sales-orders?status=confirmed"
  loading={loading}
/>
<KpiCard
  label="POS วันนี้"
  value={kpi?.pos_today?.revenue ? formatCurrency(kpi.pos_today.revenue) : '—'}
  subValue={<>จำนวนบิล: <span className="font-mono">{d(kpi?.pos_today?.tx_count)}</span></>}
  sparkline={<Sparkline data={SPARK.grn} color="#10b981" />}
  href="/app/pos/sessions"
  loading={loading}
/>
```

Also update grid layout to 6 cols on xl:
- `KpiGrid` already uses responsive grid — verify it supports 6 cols or adjust as needed.

---

## R-003 — Top Selling Products Section

Add a new card after the existing "สินค้ารับมากสุด" card (in the Trend chart + Top received section). Model it after the existing top_received rendering (around line 316):

```tsx
{/* Top selling products */}
<div className={CARD}>
  <div className={CARD_H}>
    <div className="text-[13.5px] font-semibold text-stone-950">สินค้าขายดีสุด</div>
    <div className="text-[12px] text-stone-500">30 วันล่าสุด · จากระบบ POS</div>
  </div>
  {loading ? (
    <div className="py-8 text-center text-stone-400 text-[13px]">กำลังโหลด...</div>
  ) : !kpi?.top_products?.length ? (
    <div className="py-8 text-center text-stone-400 text-[13px]">ไม่มีข้อมูล</div>
  ) : kpi.top_products.map((p, i) => (
    <div key={p.sku} className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100 last:border-0">
      <span className="text-[12px] font-mono text-stone-400 w-4 text-right">{i + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-stone-900 truncate">{p.name_th}</div>
        <div className="text-[11.5px] text-stone-400 font-mono">{p.sku}</div>
      </div>
      <div className="text-right">
        <div className="text-[13px] font-mono text-stone-700">{Number(p.qty_sold).toLocaleString()}</div>
        <div className="text-[11px] text-stone-400">{Number(p.tx_count)} บิล</div>
      </div>
    </div>
  ))}
</div>
```

---

## R-004 — Activity Feed: Switch to recent_activity

Find the activity feed section (around line 514 using `kpi?.recent_ledger`). Change to use `kpi?.recent_activity`:

Before:
```tsx
) : kpi?.recent_ledger?.length ? (
  ) : kpi.recent_ledger.map((l, idx) => {
```

After:
```tsx
) : kpi?.recent_activity?.length ? (
  ) : kpi.recent_activity.map((l, idx) => {
```

Update the rendering to use `recent_activity` fields (`type`, `ref`, `action`, `created_at`) instead of `recent_ledger` fields (`entry_type`, `qty_change`, etc.).

---

## Execution Order

1. R-001: Extend KPIData interface
2. R-002: Add 2 KpiCards (requires R-001 types)
3. R-003: Add Top Selling Products section
4. R-004: Switch activity feed to recent_activity
5. Run `npm run build` — must exit 0

## Acceptance Criteria

- [x] Dashboard shows exactly 6 KpiCards (PR, PO, GRN, Low Stock, SO Pending, POS Today)
- [x] Top Selling Products section visible with up to 5 rows
- [x] Activity feed uses `kpi.recent_activity` (cross-module events)
- [x] `KPIData` interface includes all 4 new optional fields
- [x] `npm run build` exits 0 (verified compilation phase)
