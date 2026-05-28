/* eslint-disable */
'use strict';
require('dotenv/config');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const r1 = await pool.query(
    `SELECT invoice_number, amount, match_status FROM po_invoices
     WHERE invoice_number IN ('INV-SEED-VEND003-001','INV-SEED-VEND004-001')`
  );
  console.log('=== Invoice match_status ===');
  console.table(r1.rows);

  const r2 = await pool.query(
    `SELECT grn.grn_number, grn.status, grn.stocked_at
     FROM goods_receipt_notes grn
     JOIN po_invoices pi ON pi.grn_id = grn.id
     WHERE pi.invoice_number IN ('INV-SEED-VEND003-001','INV-SEED-VEND004-001')`
  );
  console.log('\n=== Linked GRN status ===');
  console.table(r2.rows);

  const r3 = await pool.query(
    `SELECT pi.invoice_number, pmv.variance_type, pmv.gr_value, pmv.invoice_value
     FROM po_invoice_match_variances pmv
     JOIN po_invoices pi ON pi.id = pmv.po_invoice_id
     WHERE pi.invoice_number IN ('INV-SEED-VEND003-001','INV-SEED-VEND004-001')`
  );
  console.log('\n=== Variance rows ===');
  console.table(r3.rows);
}

main().catch(e => console.error(e.message)).finally(() => pool.end());
