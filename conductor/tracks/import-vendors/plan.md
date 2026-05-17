---
track: import-vendors
status: Completed
aliases: ["Import Vendors from Excel"]
owner: paku, puka
module: Vendors
updated: 2026-05-13
---

# Import Vendors from Excel

**Source file:** `data/imports/Vendor.xlsx`  
**Sheet:** `Vendor`  
**Columns:** `Code` (col 0) · `Vendor Name` in Thai (col 1)  
**Row count:** 172 vendors (row 0 = header)

---

## Data Notes

- Only Thai names in the file — set `name_en = name_th` as placeholder (can be updated later)
- `code` column already formatted as `V000115` style — use as-is (max 50 chars, fits `VARCHAR(50)`)
- Import is **idempotent**: uses `ON CONFLICT (code) DO UPDATE` so safe to re-run
- All other vendor fields use DB defaults: `payment_terms_days=30`, `is_active=TRUE`

## Pattern Reference

Follow `scripts/import-products.ts` exactly — same Pool setup, same UPSERT pattern, same dotenv/ssl config.

---

## Tasks

### Task 1 — Create `scripts/import-vendors.ts`

- [x] Create `scripts/import-vendors.ts` with this exact content:

```typescript
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as dns from 'dns';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dns.setDefaultResultOrder('ipv4first');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface VendorRow {
  code: string;
  name_th: string;
}

function readExcel(filePath: string): VendorRow[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

  return raw
    .slice(1)
    .filter((r: any[]) => r[0] && r[1])
    .map((r: any[]) => ({
      code:    String(r[0]).trim(),
      name_th: String(r[1]).trim(),
    }));
}

async function main() {
  const filePath = path.resolve(__dirname, '../data/imports/Vendor.xlsx');
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  console.log('Reading Excel...');
  const rows = readExcel(filePath);
  console.log(`  ${rows.length} vendors found`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let inserted = 0;
    let updated = 0;

    for (const row of rows) {
      const res = await client.query<{ id: string; created_at: string; updated_at: string }>(
        `INSERT INTO vendors (code, name_th, name_en)
         VALUES ($1, $2, $2)
         ON CONFLICT (code) DO UPDATE SET
           name_th    = EXCLUDED.name_th,
           updated_at = NOW()
         RETURNING id, created_at, updated_at`,
        [row.code, row.name_th]
      );

      const r = res.rows[0];
      if (r.created_at === r.updated_at) inserted++; else updated++;
    }

    await client.query('COMMIT');
    console.log(`\nDone. Inserted: ${inserted} | Updated: ${updated} | Total: ${rows.length}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
```

- [x] Run `npm run lint` → no errors

### Task 2 — Run the Import

- [x] Run:

```bash
DATABASE_URL=<your-connection-string> npx ts-node scripts/import-vendors.ts
```

Expected output:
```
Reading Excel...
  172 vendors found

Done. Inserted: 172 | Updated: 0 | Total: 172
```

- [x] Verify in DB:

```sql
SELECT COUNT(*) FROM vendors;
-- expect: 172 (or more if vendors already existed)

SELECT code, name_th, name_en FROM vendors ORDER BY code LIMIT 5;
-- expect: V000115, โชคเทพบัญชา, โชคเทพบัญชา  (name_en = name_th placeholder)
```

### Task 3 — Commit

- [x] Commit:

```bash
git add scripts/import-vendors.ts
git commit -m "feat: import-vendors script — upserts 172 vendors from data/imports/Vendor.xlsx"
```
