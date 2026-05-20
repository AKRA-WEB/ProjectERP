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
  } catch {
    return apiError('Forbidden', 403);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return apiError('Invalid multipart body', 400);
  }

  const file = formData.get('file') as File | null;
  if (!file) return apiError('No file uploaded', 400);

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  
  if (rows.length <= 1) {
    return apiSuccess({ inserted: 0, updated: 0, failed: 0, errors: [] });
  }

  const dataRows = rows.slice(1) as unknown[][];
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

    // --- OPTIMIZATION 1: Batch Categories ---
    const uniqueCatsMap = new Map<string, string>();
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const sku = row[0] ? String(row[0]).trim() : null;
      const name_th = row[1] ? String(row[1]).trim() : null;
      if (!sku || !name_th) continue;
      
      const catName = row[3] ? String(row[3]).trim() : 'Uncategorized';
      const catSlug = slugify(catName);
      uniqueCatsMap.set(catSlug, catName);
    }

    const categoryCache = new Map<string, string>();
    if (uniqueCatsMap.size > 0) {
      const catArray = Array.from(uniqueCatsMap.entries());
      const catBatchSize = 50;
      for (let offset = 0; offset < catArray.length; offset += catBatchSize) {
        const chunk = catArray.slice(offset, offset + catBatchSize);
        const values: string[] = [];
        const params: unknown[] = [];
        for (let idx = 0; idx < chunk.length; idx++) {
          const [slug, name] = chunk[idx];
          params.push(slug, name);
          const p1 = idx * 2 + 1;
          const p2 = idx * 2 + 2;
          values.push(`($${p1}, $${p2}, $${p2})`);
        }
        const queryText = `
          INSERT INTO product_categories (code, name_th, name_en)
          VALUES ${values.join(', ')}
          ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th
          RETURNING code, id
        `;
        const res = await client.query<{ code: string; id: string }>(queryText, params);
        for (const r of res.rows) {
          categoryCache.set(r.code, r.id);
        }
      }
    }

    // --- OPTIMIZATION 2: Batch UOMs ---
    const uniqueUoms = new Set<string>();
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const sku = row[0] ? String(row[0]).trim() : null;
      const name_th = row[1] ? String(row[1]).trim() : null;
      if (!sku || !name_th) continue;
      
      const uomName = row[5] ? String(row[5]).trim() : 'ชิ้น';
      uniqueUoms.add(uomName);
    }

    const uomCache = new Map<string, string>();
    if (uniqueUoms.size > 0) {
      const uomArray = Array.from(uniqueUoms);
      const uomBatchSize = 50;
      for (let offset = 0; offset < uomArray.length; offset += uomBatchSize) {
        const chunk = uomArray.slice(offset, offset + uomBatchSize);
        const values: string[] = [];
        const params: unknown[] = [];
        for (let idx = 0; idx < chunk.length; idx++) {
          const name = chunk[idx];
          params.push(name);
          const p1 = idx + 1;
          values.push(`($${p1}, $${p1}, $${p1})`);
        }
        const queryText = `
          INSERT INTO units_of_measure (code, name_th, name_en)
          VALUES ${values.join(', ')}
          ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th
          RETURNING code, id
        `;
        const res = await client.query<{ code: string; id: string }>(queryText, params);
        for (const r of res.rows) {
          uomCache.set(r.code, r.id);
        }
      }
    }

    // --- OPTIMIZATION 3: Batch Products with Graceful Fallback ---
    interface ValidRowItem {
      row: unknown[];
      rowNum: number;
      sku: string;
      name_th: string;
    }

    const validRows: ValidRowItem[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;
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
      validRows.push({ row, rowNum, sku, name_th });
    }

    async function insertSingleRow(item: ValidRowItem) {
      const { row, rowNum, sku, name_th } = item;
      try {
        const catName = row[3] ? String(row[3]).trim() : 'Uncategorized';
        const catSlug = slugify(catName);
        const categoryId = categoryCache.get(catSlug) || null;

        const uomName = row[5] ? String(row[5]).trim() : 'ชิ้น';
        const uomId = uomCache.get(uomName) || null;

        const barcodeType = Number(row[12]);
        const customBarcode = row[13] ? String(row[13]).trim() : null;
        const barcode = (barcodeType === 2 && customBarcode) ? customBarcode : null;

        const productRes = await client.query<{ id: string; was_updated: boolean }>(
          `INSERT INTO products (
            sku, name_th, name_sub, name_en, description_th,
            category_id, uom_id,
            unit_cost, selling_price,
            reorder_point, discount_type, discount_value,
            is_non_vat, is_unlimited_stock,
            hide_in_ecommerce, hide_in_emenu,
            image_url, default_location, barcode,
            is_active, created_by
          ) VALUES (
            $1, $2, $3, $2, $4,
            $5, $6,
            $7, $8,
            $9, $10, $11,
            $12, $13,
            $14, $15,
            $16, $17, $18,
            true, $19
          )
          ON CONFLICT (sku) DO UPDATE SET
            name_th = EXCLUDED.name_th,
            name_sub = EXCLUDED.name_sub,
            name_en = EXCLUDED.name_en,
            description_th = EXCLUDED.description_th,
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
            row[6] ? String(row[6]).trim() : null,
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
          const initialQty = Number(row[4] || 0);
          if (initialQty > 0 && defaultWhId) {
            await client.query(
              `INSERT INTO stock_ledger (
                warehouse_id, product_id, entry_type, reference_type,
                qty_change, qty_after, unit_cost, notes, created_by
              ) VALUES ($1, $2, 'initial_import'::ledger_entry_type, 'product_import', $3, $3, $4, 'นำเข้าสต็อกเริ่มต้น', $5)`,
              [defaultWhId, pid, initialQty, Number(row[7] || 0), u.id]
            );
          }
        }
      } catch (err: unknown) {
        result.failed++;
        const message = err instanceof Error ? err.message : 'Database error';
        result.errors.push({
          row: rowNum,
          sku: sku,
          reason: message,
        });
      }
    }

    const batchSize = 100;
    for (let chunkIdx = 0; chunkIdx < validRows.length; chunkIdx += batchSize) {
      const chunk = validRows.slice(chunkIdx, chunkIdx + batchSize);
      
      const valuesSql: string[] = [];
      const params: unknown[] = [];
      
      for (let idx = 0; idx < chunk.length; idx++) {
        const { row, sku, name_th } = chunk[idx];
        
        const catName = row[3] ? String(row[3]).trim() : 'Uncategorized';
        const catSlug = slugify(catName);
        const categoryId = categoryCache.get(catSlug) || null;

        const uomName = row[5] ? String(row[5]).trim() : 'ชิ้น';
        const uomId = uomCache.get(uomName) || null;

        const barcodeType = Number(row[12]);
        const customBarcode = row[13] ? String(row[13]).trim() : null;
        const barcode = (barcodeType === 2 && customBarcode) ? customBarcode : null;

        const base = idx * 19;
        params.push(
          sku,                                      // $1
          name_th,                                  // $2
          row[2] ? String(row[2]).trim() : null,    // $3
          row[6] ? String(row[6]).trim() : null,    // $4 (description_th)
          categoryId,                               // $5
          uomId,                                    // $6
          Number(row[7] || 0),                      // $7
          Number(row[8] || 0),                      // $8
          Number(row[9] || 0),                      // $9
          Number(row[10] || 1),                     // $10
          Number(row[11] || 0),                     // $11
          Boolean(row[19]),                         // $12
          Boolean(row[20]),                         // $13
          Boolean(row[14]),                         // $14
          Boolean(row[21]),                         // $15
          row[15] ? String(row[15]).trim() : null,  // $16
          row[22] ? String(row[22]).trim() : null,  // $17
          barcode,                                  // $18
          u.id                                      // $19
        );

        valuesSql.push(`(
          $${base + 1}, $${base + 2}, $${base + 3}, $${base + 2}, $${base + 4},
          $${base + 5}, $${base + 6},
          $${base + 7}, $${base + 8},
          $${base + 9}, $${base + 10}, $${base + 11},
          $${base + 12}, $${base + 13},
          $${base + 14}, $${base + 15},
          $${base + 16}, $${base + 17}, $${base + 18},
          true, $${base + 19}
        )`);
      }

      const queryText = `
        INSERT INTO products (
          sku, name_th, name_sub, name_en, description_th,
          category_id, uom_id,
          unit_cost, selling_price,
          reorder_point, discount_type, discount_value,
          is_non_vat, is_unlimited_stock,
          hide_in_ecommerce, hide_in_emenu,
          image_url, default_location, barcode,
          is_active, created_by
        ) VALUES ${valuesSql.join(', ')}
        ON CONFLICT (sku) DO UPDATE SET
          name_th = EXCLUDED.name_th,
          name_sub = EXCLUDED.name_sub,
          name_en = EXCLUDED.name_en,
          description_th = EXCLUDED.description_th,
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
        RETURNING id, sku, (xmax::text::int > 0) AS was_updated
      `;

      try {
        const res = await client.query<{ id: string; sku: string; was_updated: boolean }>(queryText, params);
        
        const stockLedgerValues: string[] = [];
        const stockLedgerParams: unknown[] = [];
        let stockLedgerIdx = 0;

        for (const insertedRow of res.rows) {
          const matchedItem = chunk.find(c => c.sku === insertedRow.sku);
          if (!matchedItem) continue;

          if (insertedRow.was_updated) {
            result.updated++;
          } else {
            result.inserted++;
            
            const initialQty = Number(matchedItem.row[4] || 0);
            if (initialQty > 0 && defaultWhId) {
              const baseIdx = stockLedgerIdx * 5;
              stockLedgerParams.push(
                defaultWhId,
                insertedRow.id,
                initialQty,
                Number(matchedItem.row[7] || 0),
                u.id
              );
              stockLedgerValues.push(`($${baseIdx + 1}, $${baseIdx + 2}, 'initial_import'::ledger_entry_type, 'product_import', $${baseIdx + 3}, $${baseIdx + 3}, $${baseIdx + 4}, 'นำเข้าสต็อกเริ่มต้น', $${baseIdx + 5})`);
              stockLedgerIdx++;
            }
          }
        }

        if (stockLedgerValues.length > 0) {
          await client.query(`
            INSERT INTO stock_ledger (
              warehouse_id, product_id, entry_type, reference_type,
              qty_change, qty_after, unit_cost, notes, created_by
            ) VALUES ${stockLedgerValues.join(', ')}
          `, stockLedgerParams);
        }

      } catch {
        // Fallback to inserting single row by single row for this batch only
        for (const item of chunk) {
          await insertSingleRow(item);
        }
      }
    }

    await client.query('COMMIT');
    return apiSuccess(result);
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : 'Import failed';
    return apiError(message, 500);
  } finally {
    client.release();
  }
}
