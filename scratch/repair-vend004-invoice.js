/* eslint-disable */
'use strict';
require('dotenv/config');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function q(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}

async function main() {
  // Check if already exists
  const exists = await q(`SELECT id FROM po_invoices WHERE invoice_number='INV-SEED-VEND004-001' LIMIT 1`);
  if (exists.length) {
    console.log('INV-SEED-VEND004-001 already exists:', exists[0].id);
    return;
  }

  // Fetch required IDs
  const vend4 = await q(`SELECT id FROM vendors WHERE code='VEND-004' LIMIT 1`);
  const grn4 = await q(`SELECT id, po_id FROM goods_receipt_notes WHERE notes LIKE 'SEED: stocked GRN for VAT/match-queue%' LIMIT 1`);

  if (!vend4.length || !grn4.length) {
    console.error('Could not find VEND-004 or GRN-SEED-004. Aborting.');
    return;
  }

  const vend4Id = vend4[0].id;
  const po5Id = grn4[0].po_id;
  const grn4Id = grn4[0].id;

  console.log(`Inserting INV-SEED-VEND004-001 (po=${po5Id}, vendor=${vend4Id}, grn=${grn4Id})`);

  // Step 1: Insert at matched amount (4750 = GRN total) to avoid BEFORE INSERT FK race
  const inv4Rows = await q(
    `INSERT INTO po_invoices (po_id, vendor_id, grn_id, invoice_number, invoice_date, due_date, amount, notes)
     VALUES ($1,$2,$3,'INV-SEED-VEND004-001',CURRENT_DATE - 5,CURRENT_DATE + 25,4750,
             'SEED: mismatched invoice — vendor overcharged (GRN=4750, inv=5200)')
     RETURNING id`,
    [po5Id, vend4Id, grn4Id]
  );
  const invId = inv4Rows[0].id;
  console.log(`Inserted at matched amount. id=${invId}`);

  // Step 2: Update to mismatch amount — parent row now exists, FK holds
  await q(`UPDATE po_invoices SET amount = 5200 WHERE id = $1`, [invId]);
  console.log('Updated to mismatch amount 5200. Trigger should have set match_status=mismatched.');

  // Verify
  const verify = await q(
    `SELECT invoice_number, amount, match_status FROM po_invoices WHERE id = $1`, [invId]
  );
  console.table(verify);

  const variances = await q(
    `SELECT variance_type, gr_value, invoice_value FROM po_invoice_match_variances WHERE po_invoice_id = $1`, [invId]
  );
  console.log('Variance rows:');
  console.table(variances);
}

main().catch(e => console.error(e.message)).finally(() => pool.end());
