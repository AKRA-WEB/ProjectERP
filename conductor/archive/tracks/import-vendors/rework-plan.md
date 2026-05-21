---
track: import-vendors
status: Rework Required
owner: gemini
module: WMS
updated: 2026-05-17
---

# Rework Plan — import-vendors

## Validation Notes
- MF-1+MF-2: Batch6 confirmed — `app/api/vendors/import/route.ts` and `app/(wms)/vendors/import/page.tsx` both DO NOT EXIST. Primary deliverables absent.
- Chen agent found existing import route.ts (different location?) with no row limit, no ON CONFLICT, no transaction. Gemini must first locate files.

## Pre-Fix Action Required
Run `Get-ChildItem -Path . -Recurse -Filter '*import*' | Where Path -like '*vendor*'` to find actual file locations before editing.

## Must Fix

### MF-1: Import API route does not exist (or has no row limit)
**File:** `app/api/vendors/import/route.ts` (create if absent)
**Problem:** Either file missing entirely OR present but inserts without row limit, transaction, or duplicate detection.
**Fix — Complete import route:**
```typescript
import { auth } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api';
import { assertRole } from '@/lib/authz';
import { pool } from '@/lib/db';
import type { SessionUser } from '@/types';

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  try { assertRole(u, ['manager', 'admin']); } catch { return apiError('Forbidden', 403); }

  const text = await req.text();
  const rows = text.split('\n').slice(1).filter(r => r.trim());

  if (rows.length > 5000) {
    return apiError('Import limit is 5,000 rows per batch', 422);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let imported = 0;
    for (const row of rows) {
      const [name, contact, email] = row.split(',');
      if (!name?.trim()) continue;
      await client.query(
        `INSERT INTO vendors (vendor_name, contact, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (vendor_name) DO NOTHING`,
        [name.trim(), contact?.trim() ?? null, email?.trim() ?? null]
      );
      imported++;
    }
    await client.query('COMMIT');
    return apiSuccess({ imported });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : 'Import failed';
    return apiError(message, 500);
  } finally {
    client.release();
  }
}
```

### MF-2: Import UI page does not exist (or missing features)
**File:** `app/(wms)/vendors/import/page.tsx` (create if absent)
**Fix — Minimal import page:**
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VendorImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    const text = await file.text();
    const res = await fetch('/api/vendors/import', {
      method: 'POST',
      body: text,
      headers: { 'Content-Type': 'text/plain' },
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setResult(data);
    router.refresh();
  };

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-semibold mb-4">นำเข้าข้อมูลผู้จัดจำหน่าย</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          accept=".csv,.txt"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={!file || loading} className="btn-primary">
          {loading ? 'กำลังนำเข้า...' : 'นำเข้า'}
        </button>
      </form>
      {result && <p className="text-green-600 mt-2">นำเข้าสำเร็จ {result.imported} รายการ</p>}
      {error && <p className="text-red-600 mt-2">{error}</p>}
    </div>
  );
}
```

## Re-QA Checklist
- [ ] Upload 5,001-row CSV → 422 with limit message
- [ ] Upload 100-row CSV → `{ imported: 100 }` response
- [ ] Upload same CSV twice → second import: no duplicate vendors created
- [ ] Simulate DB error mid-import → zero rows committed (rollback)
- [ ] `staff` role → POST /api/vendors/import → 403
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero errors
