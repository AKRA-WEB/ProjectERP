---
track: operation-core-sync-orion-2026-05-24
phase: V2.0-P1
sequence: 15
status: Verified
owner: Chen
created: 2026-05-24
updated: 2026-05-24
depends_on: [adjust-warehouses-and-thermal-zones]
estimate: M
assigned_to: [Paku, Puka]
tags: [v2-orion, wms, dispatch, transfer, alignment]
---

# Operation Core Sync & Orion Alignment

## Goal
Implement the core operational adjustments mandated by the `BMTH ERP Phase 1 Flow Blueprint`:
- Register `V-BUF-AKRA` and `W1-DSP-STG` into both physical `warehouses` and metadata `virtual_locations`.
- Add `transfer_qty_mode` enum for stock replenishments from Akra to TRD.
- Enforce the new **Dispatch Check Exception Policy** at the gate (auto-DO adjustment for 1-unit shortage, supervisor PIN override for >=2 shortage, wrong item buffer redirection, upsell and substitute tracking).
- Implement a buffer clearing action mechanism.

---

## Tasks

### T1 — Migration `055_operation_core_sync.sql`
**File:** `migrations/055_operation_core_sync.sql` (new)
- Wrap in transaction block `BEGIN; ... COMMIT;`
- **Register new virtual locations/warehouses:**
  ```sql
  INSERT INTO warehouses (code, name_th, name_en, business_unit_id, is_active) VALUES
    ('V-BUF-AKRA', 'คลังพักสินค้า AKRA (Virtual Buffer)', 'AKRA Buffer (Virtual)', (SELECT id FROM business_units WHERE code = 'AKRA'), true),
    ('W1-DSP-STG', 'คลังพักเตรียมจัดส่ง TRD W1 (Virtual Staging)', 'W1 Dispatch Staging (Virtual)', (SELECT id FROM business_units WHERE code = 'TRD'), true)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO virtual_locations (code, purpose, is_sellable, visible_channels) VALUES
    ('V-BUF-AKRA', 'buffer', false, ARRAY[]::TEXT[]),
    ('W1-DSP-STG', 'buffer', false, ARRAY['TRD']::TEXT[])
  ON CONFLICT (code) DO NOTHING;
  ```
- **Introduce Transfer Qty Modes:**
  ```sql
  DO $$ BEGIN
    CREATE TYPE transfer_qty_mode AS ENUM ('SHORTAGE_ONLY', 'FULL_ORDER_LINE', 'MANUAL_QTY');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  ```
- **Introduce Dispatch Exception Event Logs:**
  ```sql
  CREATE TABLE IF NOT EXISTS dispatch_exception_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID NOT NULL, -- references delivery_orders or dispatch checks
    event_name VARCHAR(50) NOT NULL, -- e.g. 'SHORTAGE_AUTO_ADJUST', 'SHORTAGE_PIN_REQUIRED', 'OVER_PICK_TO_UPSELL'
    sku VARCHAR(100) NOT NULL,
    original_qty NUMERIC(15,4) NOT NULL,
    picked_qty NUMERIC(15,4) NOT NULL,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

- [x] T1 complete

### T2 — Back-End API Realignment
**Files:** `app/api/dispatch-check/route.ts` (or relevant gate verification API)
- Implement gate scan-out exceptions:
  - If a scan-out has a shortage of **exactly 1 unit**: auto-adjust the delivery order and invoice quantities downwards, and log `SHORTAGE_AUTO_ADJUST`.
  - If a scan-out has a shortage of **>= 2 units**: block completion unless a valid supervisor PIN override is provided, and log `SHORTAGE_PIN_REQUIRED`.
  - If a scanned item is a mismatched SKU (wrong item): return a validation response directing the user to redirect the wrong item to `V-BUF-TRD` or `V-BUF-AKRA` depending on the transaction BU.
  - If picked quantity is greater than ordered quantity: log `OVER_PICK_TO_UPSELL` and support generating linked add-on billing.

- [x] T2 complete

### T3 — Buffer Zone Clearing & Admin Updates
**Files:** `app/api/admin/virtual-locations/route.ts` & `app/api/admin/buffer-clear/route.ts` (new)
- Update `/api/admin/virtual-locations` to fetch all newly registered locations.
- Create `/api/admin/buffer-clear` to execute putback, scrap, or clearance markdown actions on items in the buffer zone.

- [x] T3 complete

### T4 — Update Memory
**File:** `_notes/02_Agent_Memory/current-state.md`
- Update latest migration to `055`.
- Record new transfer modes and dispatch exception policies.

- [x] T4 complete
