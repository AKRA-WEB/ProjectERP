import { auth } from '@/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { assertRole } from '@/lib/authz';
import pool from '@/lib/db/client';
import * as XLSX from 'xlsx';
import type { SessionUser } from '@/lib/authz';

export const dynamic = 'force-dynamic';

function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') 
    .replace(/[^\wก-๙-]+/g, '') 
    .replace(/--+/g, '-') 
    .replace(/^-+/, '') 
    .replace(/-+$/, ''); 
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  try {
    assertRole(u, ['manager', 'admin']);
  } catch (err) {
    return apiError('Forbidden', 403);
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return apiError('No file uploaded', 400);

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  
  if (rows.length <= 1) {
    return apiSuccess({ inserted: 0, updated: 0, failed: 0, errors: [] });
  }

  const dataRows = rows.slice(1);
  const result = {
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: [] as Array<{ row: number; sku: string; reason: string }>,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get default warehouse for stock seeding
    const whResult = await client.query<{ id: string }>(
      'SELECT id FROM warehouses WHERE is_active = true ORDER BY created_at ASC LIMIT 1'
    );
    const defaultWhId = whResult.rows[0]?.id;

    const categoryCache = new Map<string, string>();
    const uomCache = new Map<string, string>();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as any[];
      const rowNum = i + 2; // 1-based + skip header

      const sku = row[0] ? String(row[0]).trim() : null;
      const name_th = row[1] ? String(row[1]).trim() : null;

      if (!sku || !name_th) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          sku: sku || 'N/A',
          reason: !sku ? 'Missing SKU (Product code)' : 'Missing Product name',
        });
        continue;
      }

      try {
        // 1. Category
        const catName = row[3] ? String(row[3]).trim() : 'Uncategorized';
        const catSlug = slugify(catName);
        let categoryId = categoryCache.get(catSlug);
        if (!categoryId) {
          const catRes = await client.query<{ id: string }>(
            `INSERT INTO product_categories (code, name_th, name_en)
             VALUES ($1, $2, $2)
             ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th
             RETURNING id`,
            [catSlug, catName]
          );
          categoryId = catRes.rows[0].id;
          categoryCache.set(catSlug, categoryId);
        }

        // 2. UOM
        const uomName = row[5] ? String(row[5]).trim() : 'ชิ้น';
        let uomId = uomCache.get(uomName);
        if (!uomId) {
          const uomRes = await client.query<{ id: string }>(
            `INSERT INTO units_of_measure (code, name_th, name_en)
             VALUES ($1, $1, $1)
             ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th
             RETURNING id`,
            [uomName]
          );
          uomId = uomRes.rows[0].id;
          uomCache.set(uomName, uomId);
        }

        // 3. Barcode logic
        const barcodeType = Number(row[12]);
        const customBarcode = row[13] ? String(row[13]).trim() : null;
        const barcode = (barcodeType === 2 && customBarcode) ? customBarcode : null;

        // 4. Product Upsert
        const productRes = await client.query<{ id: string; was_updated: boolean }>(
          `INSERT INTO products (
            sku, name_th, name_sub, name_en,
            category_id, uom_id,
            unit_cost, selling_price,
            reorder_point, discount_type, discount_value,
            is_non_vat, is_unlimited_stock,
            hide_in_ecommerce, hide_in_emenu,
            image_url, default_location, barcode,
            is_active, created_by
          ) VALUES (
            $1, $2, $3, $2,
            $4, $5,
            $6, $7,
            $8, $9, $10,
            $11, $12,
            $13, $14,
            $15, $16, $17,
            true, $18
          )
          ON CONFLICT (sku) DO UPDATE SET
            name_th = EXCLUDED.name_th,
            name_sub = EXCLUDED.name_sub,
            name_en = EXCLUDED.name_en,
            category_id = EXCLUDED.category_id,
            uom_id = EXCLUDED.uom_id,
            unit_cost = EXCLUDED.unit_cost,
            selling_price = EXCLUDED.selling_price,
            reorder_point = EXCLUDED.reorder_point,
            discount_type = EXCLUDED.discount_type,
            discount_value = EXCLUDED.discount_value,
            is_non_vat = EXCLUDED.is_non_vat,
            is_unlimited_stock = EXCLUDED.is_unlimited_stock,
            hide_in_ecommerce = EXCLUDED.hide_in_ecommerce,
            hide_in_emenu = EXCLUDED.hide_in_emenu,
            image_url = EXCLUDED.image_url,
            default_location = EXCLUDED.default_location,
            barcode = EXCLUDED.barcode,
            updated_at = NOW()
          RETURNING id, (xmax::text::int > 0) AS was_updated`,
          [
            sku,
            name_th,
            row[2] ? String(row[2]).trim() : null,
            categoryId,
            uomId,
            Number(row[7] || 0),
            Number(row[8] || 0),
            Number(row[9] || 0),
            Number(row[10] || 1),
            Number(row[11] || 0),
            Boolean(row[19]),
            Boolean(row[20]),
            Boolean(row[14]),
            Boolean(row[21]),
            row[15] ? String(row[15]).trim() : null,
            row[22] ? String(row[22]).trim() : null,
            barcode,
            u.id
          ]
        );

        const pid = productRes.rows[0].id;
        const wasUpdated = productRes.rows[0].was_updated;

        if (wasUpdated) {
          result.updated++;
        } else {
          result.inserted++;
          // Seeding stock for new products
          const initialQty = Number(row[4] || 0);
          if (initialQty > 0 && defaultWhId) {
            await client.query(
              `INSERT INTO stock_ledger (
                warehouse_id, product_id, entry_type, reference_type,
                qty_change, qty_after, unit_cost, notes, created_by
              ) VALUES ($1, $2, 'initial_import', 'product_import', $3, $3, $4, 'นำเข้าสต็อกเริ่มต้น', $5)`,
              [defaultWhId, pid, initialQty, Number(row[7] || 0), u.id]
            );
          }
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          sku: sku,
          reason: err.message || 'Database error',
        });
      }
    }

    await client.query('COMMIT');
    return apiSuccess(result);
  } catch (err: any) {
    await client.query('ROLLBACK');
    return apiError(err.message || 'Import failed', 500);
  } finally {
    client.release();
  }
}
