/* eslint-disable */
'use strict';
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function q(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}

function log(module, count) {
  console.log(`  ✓ ${module}: ${count} row(s)`);
}

async function ensureUsers() {
  const hash = '$2b$12$TVtSNrgCSXesw9Hlm0apZOW3/PaZUgwwxhwcLWWarnQ8Mh6fT8Lru'; // Reuse existing valid hash
  
  await q(
    `INSERT INTO users (email, password_hash, name_th, name_en, role, is_active)
     VALUES ('admin@wms.local', $1, 'ผู้ดูแลระบบ', 'System Admin', 'admin', TRUE)
     ON CONFLICT (email) DO NOTHING`,
    [hash]
  );

  await q(
    `INSERT INTO users (email, password_hash, name_th, name_en, role, is_active)
     VALUES ('manager@wms.local', $1, 'ผู้จัดการ', 'Manager', 'manager', TRUE)
     ON CONFLICT (email) DO NOTHING`,
    [hash]
  );

  await q(
    `INSERT INTO users (email, password_hash, name_th, name_en, role, is_active)
     VALUES ('staff@wms.local', $1, 'พนักงาน', 'Staff', 'staff', TRUE)
     ON CONFLICT (email) DO NOTHING`,
    [hash]
  );
  
  const users = await q(`SELECT id, role, email FROM users WHERE is_active = TRUE`);
  const whs = await q(`SELECT id, code FROM warehouses`);
  for (const user of users) {
    for (const wh of whs) {
      await q(
        `INSERT INTO user_warehouse_assignments (user_id, warehouse_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [user.id, wh.id]
      );
    }
  }
  console.log('  ✓ users & warehouse assignments ensured');
}

async function getUsers() {
  const rows = await q(`SELECT id, role, email FROM users WHERE is_active = TRUE ORDER BY role, email`);
  const admin = rows.find(r => r.role === 'admin');
  const manager = rows.find(r => r.role === 'manager');
  const staffAll = rows.filter(r => r.role === 'staff');
  if (!admin) throw new Error('No admin user found — run migrations first');
  if (!manager) throw new Error('No manager user found');
  if (staffAll.length === 0) throw new Error('No staff users found');
  return { admin, manager, staff: staffAll[0], staffAll };
}

async function getWarehouses() {
  const rows = await q(`SELECT id, code FROM warehouses`);
  const byCode = Object.fromEntries(rows.map(r => [r.code, r.id]));
  for (const code of ['W1', 'W2', 'W3']) {
    if (!byCode[code]) throw new Error(`Warehouse ${code} not found — run migrations first`);
  }
  return byCode;
}

async function getUoms() {
  const rows = await q(`SELECT id, code FROM units_of_measure`);
  return Object.fromEntries(rows.map(r => [r.code, r.id]));
}

async function getAccounts() {
  const rows = await q(`SELECT id, account_code FROM accounts`);
  return Object.fromEntries(rows.map(r => [r.account_code, r.id]));
}

async function seedStockedGrnsAndInvoices(users, wh, uoms) {
  const guard = await q(
    `SELECT id FROM po_invoices WHERE invoice_number='INV-SEED-VEND003-001' LIMIT 1`
  );
  if (guard.length) { log('stocked GRNs + AP invoices (skipped — already seeded)', 0); return; }

  const vRows = await q(`SELECT id, code FROM vendors WHERE code IN ('VEND-003','VEND-004')`);
  const vByCode = Object.fromEntries(vRows.map(v => [v.code, v.id]));
  const pRows = await q(`SELECT id, sku FROM products WHERE sku IN ('PKG-002','BEV-001')`);
  const pBySku = Object.fromEntries(pRows.map(p => [p.sku, p.id]));

  // ── PO-SEED-004: VEND-003, PKG-002 ×100 @12, W2, fully_received ──
  const po4Sub = 100 * 12;
  const po4Vat = Math.round(po4Sub * 0.07 * 100) / 100;
  const po4Rows = await q(
    `INSERT INTO purchase_orders (vendor_id, warehouse_id, status, expected_date, payment_terms_days, subtotal, vat_amount, total_amount, created_by)
     VALUES ($1,$2,'fully_received'::po_status, CURRENT_DATE - 4, 45, $3,$4,$5,$6)
     RETURNING id`,
    [vByCode['VEND-003'], wh['W2'], po4Sub, po4Vat, po4Sub + po4Vat, users.manager.id]
  );
  const po4Id = po4Rows[0].id;

  const po4L1Rows = await q(
    `INSERT INTO po_line_items (po_id, product_id, qty_ordered, qty_received, unit_price, line_number)
     VALUES ($1,$2,100,100,12,1) RETURNING id`,
    [po4Id, pBySku['PKG-002']]
  );
  const po4L1Id = po4L1Rows[0].id;

  // ── GRN-SEED-003: stocked, W2 ──
  const grn3Rows = await q(
    `INSERT INTO goods_receipt_notes (po_id, warehouse_id, status, received_by, received_date,
       qc_reviewed_by, qc_reviewed_at, qc_notes,
       stocked_by, stocked_at, notes, source_type)
     VALUES ($1,$2,'stocked'::grn_status,$3,CURRENT_DATE - 3,
       $4, NOW() - interval '2 days','สินค้าผ่าน QC ทั้งหมด',
       $4, NOW() - interval '1 day','SEED: stocked GRN for reversal exercise','po'::grn_source_type)
     RETURNING id`,
    [po4Id, wh['W2'], users.staff.id, users.manager.id]
  );
  const grn3Id = grn3Rows[0].id;

  await q(
    `INSERT INTO grn_line_items (grn_id, po_line_item_id, product_id, qty_received, qty_accepted, line_number, source_type)
     VALUES ($1,$2,$3,100,100,1,'po'::grn_source_type)`,
    [grn3Id, po4L1Id, pBySku['PKG-002']]
  );

  // Compute precise qty_after dynamically from current stock balance
  const p1Balance = await q(`SELECT qty_on_hand FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2`, [pBySku['PKG-002'], wh['W2']]);
  const p1Current = p1Balance.length ? parseFloat(p1Balance[0].qty_on_hand) : 0;
  const p1After = p1Current + 100;

  await q(
    `INSERT INTO stock_ledger (product_id, warehouse_id, entry_type, qty_change, qty_after, unit_cost, reference_id, created_by)
     VALUES ($1,$2,'grn_receipt',100,$5,$6,$3,$4)`,
    [pBySku['PKG-002'], wh['W2'], grn3Id, users.manager.id, p1After, 12]
  );

  // ── PO-SEED-005: VEND-004, BEV-001 ×50 @95, W2, fully_received ──
  const po5Sub = 50 * 95;
  const po5Vat = Math.round(po5Sub * 0.07 * 100) / 100;
  const po5Rows = await q(
    `INSERT INTO purchase_orders (vendor_id, warehouse_id, status, expected_date, payment_terms_days, subtotal, vat_amount, total_amount, created_by)
     VALUES ($1,$2,'fully_received'::po_status, CURRENT_DATE - 6, 30, $3,$4,$5,$6)
     RETURNING id`,
    [vByCode['VEND-004'], wh['W2'], po5Sub, po5Vat, po5Sub + po5Vat, users.manager.id]
  );
  const po5Id = po5Rows[0].id;

  const po5L1Rows = await q(
    `INSERT INTO po_line_items (po_id, product_id, qty_ordered, qty_received, unit_price, line_number)
     VALUES ($1,$2,50,50,95,1) RETURNING id`,
    [po5Id, pBySku['BEV-001']]
  );
  const po5L1Id = po5L1Rows[0].id;

  // ── GRN-SEED-004: stocked, W2 ──
  const grn4Rows = await q(
    `INSERT INTO goods_receipt_notes (po_id, warehouse_id, status, received_by, received_date,
       qc_reviewed_by, qc_reviewed_at, qc_notes,
       stocked_by, stocked_at, notes, source_type)
     VALUES ($1,$2,'stocked'::grn_status,$3,CURRENT_DATE - 5,
       $4, NOW() - interval '4 days','สินค้าผ่าน QC ทั้งหมด',
       $4, NOW() - interval '3 days','SEED: stocked GRN for VAT/match-queue exercise','po'::grn_source_type)
     RETURNING id`,
    [po5Id, wh['W2'], users.staff.id, users.manager.id]
  );
  const grn4Id = grn4Rows[0].id;

  await q(
    `INSERT INTO grn_line_items (grn_id, po_line_item_id, product_id, qty_received, qty_accepted, line_number, source_type)
     VALUES ($1,$2,$3,50,50,1,'po'::grn_source_type)`,
    [grn4Id, po5L1Id, pBySku['BEV-001']]
  );

  // Compute precise qty_after dynamically from current stock balance
  const p2Balance = await q(`SELECT qty_on_hand FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2`, [pBySku['BEV-001'], wh['W2']]);
  const p2Current = p2Balance.length ? parseFloat(p2Balance[0].qty_on_hand) : 0;
  const p2After = p2Current + 50;

  await q(
    `INSERT INTO stock_ledger (product_id, warehouse_id, entry_type, qty_change, qty_after, unit_cost, reference_id, created_by)
     VALUES ($1,$2,'grn_receipt',50,$5,$6,$3,$4)`,
    [pBySku['BEV-001'], wh['W2'], grn4Id, users.manager.id, p2After, 95]
  );

  // ── po_invoices ──
  // INV-SEED-VEND003-001: amount=1200 = 100×12 → trigger: matched
  await q(
    `INSERT INTO po_invoices (po_id, vendor_id, grn_id, invoice_number, invoice_date, due_date, amount, notes)
     VALUES ($1,$2,$3,'INV-SEED-VEND003-001',CURRENT_DATE - 2,CURRENT_DATE + 43,1200,
             'SEED: matched invoice — GRN-SEED-003 PKG-002 100×12')`,
    [po4Id, vByCode['VEND-003'], grn3Id]
  );
  // INV-SEED-VEND004-001: insert at matched amount (4750 = GRN total) first to avoid BEFORE INSERT
  // trigger FK race on po_invoice_match_variances. Then UPDATE to the real mismatch amount (5200)
  // so the BEFORE UPDATE trigger fires after the parent row exists — FK holds.
  const inv4Rows = await q(
    `INSERT INTO po_invoices (po_id, vendor_id, grn_id, invoice_number, invoice_date, due_date, amount, notes)
     VALUES ($1,$2,$3,'INV-SEED-VEND004-001',CURRENT_DATE - 5,CURRENT_DATE + 25,4750,
             'SEED: mismatched invoice — vendor overcharged (GRN=4750, inv=5200)')
     RETURNING id`,
    [po5Id, vByCode['VEND-004'], grn4Id]
  );
  // Now update to the intentional mismatch — BEFORE UPDATE trigger fires with row already committed
  await q(
    `UPDATE po_invoices SET amount = 5200 WHERE id = $1`,
    [inv4Rows[0].id]
  );

  log('purchase_orders (fully_received)', 2);
  log('goods_receipt_notes (stocked)', 2);
  log('stock_ledger (grn_receipt, stocked GRNs)', 2);
  log('po_invoices (1 matched + 1 mismatched)', 2);
}


async function seedCategories(users, wh, uoms) {
  const cats = [
    ['CAT-BREAD',  'ขนมปัง',          'Bread'],
    ['CAT-PASTRY', 'ขนมอบ',           'Pastry'],
    ['CAT-ING',    'วัตถุดิบ',         'Ingredients'],
    ['CAT-BEV',    'เครื่องดื่ม',      'Beverages'],
    ['CAT-PKG',    'บรรจุภัณฑ์',       'Packaging'],
    ['CAT-EQP',    'อุปกรณ์',          'Equipment'],
  ];
  let count = 0;
  for (const [code, name_th, name_en] of cats) {
    const r = await q(
      `INSERT INTO product_categories (code, name_th, name_en)
       VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING RETURNING id`,
      [code, name_th, name_en]
    );
    if (r.length) count++;
  }
  log('product_categories', count);
}

async function seedProducts(users, wh, uoms) {
  const cats = await q(`SELECT id, code FROM product_categories`);
  const catByCode = Object.fromEntries(cats.map(c => [c.code, c.id]));

  // [sku, name_th, name_en, catCode, uomCode, unit_cost, selling_price, min_price, reorder_point]
  const products = [
    ['BRD-001', 'ขนมปังแซนด์วิช',        'Sandwich Bread',        'CAT-BREAD',  'BOX', 45,  65,  55,  20],
    ['BRD-002', 'ครัวซองต์',              'Croissant',             'CAT-BREAD',  'PCS', 18,  35,  28,  20],
    ['BRD-003', 'ขนมปังโฮลวีท',           'Whole Wheat Bread',     'CAT-BREAD',  'BOX', 50,  75,  60,  20],
    ['PST-001', 'เค้กช็อกโกแลต',          'Chocolate Cake',        'CAT-PASTRY', 'PCS', 120, 220, 180, 10],
    ['PST-002', 'มัฟฟิน บลูเบอร์รี่',    'Blueberry Muffin',      'CAT-PASTRY', 'BOX', 80,  150, 120, 15],
    ['ING-001', 'แป้งสาลีอเนกประสงค์',   'All-Purpose Flour',     'CAT-ING',    'KG',  22,  35,  28,  100],
    ['ING-002', 'เนยสด',                  'Unsalted Butter',       'CAT-ING',    'KG',  180, 250, 200, 30],
    ['ING-003', 'น้ำตาลทราย',             'White Sugar',           'CAT-ING',    'KG',  28,  45,  36,  50],
    ['ING-004', 'ยีสต์แห้ง',              'Dry Yeast',             'CAT-ING',    'KG',  350, 520, 420, 10],
    ['BEV-001', 'กาแฟดริป',              'Drip Coffee Bag',       'CAT-BEV',    'BOX', 95,  160, 130, 20],
    ['BEV-002', 'ชาไทย',                 'Thai Tea Mix',          'CAT-BEV',    'KG',  120, 195, 155, 15],
    ['PKG-001', 'กล่องบรรจุภัณฑ์ S',     'Packaging Box S',       'CAT-PKG',    'BOX', 8,   15,  12,  50],
    ['PKG-002', 'กล่องบรรจุภัณฑ์ L',     'Packaging Box L',       'CAT-PKG',    'BOX', 12,  22,  17,  50],
    ['PKG-003', 'ถุงซิปล็อค',            'Zip-lock Bag',          'CAT-PKG',    'BOX', 15,  28,  22,  50],
    ['EQP-001', 'ถุงมือยางอาหาร',         'Food-grade Gloves',     'CAT-EQP',    'BOX', 55,  90,  72,  20],
  ];

  let count = 0;
  for (const [sku, name_th, name_en, catCode, uomCode, unit_cost, selling_price, min_price, reorder_point] of products) {
    const r = await q(
      `INSERT INTO products (sku, name_th, name_en, category_id, uom_id, unit_cost, selling_price, min_price, reorder_point, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (sku) DO NOTHING RETURNING id`,
      [sku, name_th, name_en, catByCode[catCode], uoms[uomCode], unit_cost, selling_price, min_price, reorder_point, users.admin.id]
    );
    if (r.length) count++;
  }
  log('products', count);
}

async function seedVendors(users, wh, uoms) {
  const vendors = [
    ['VEND-001', 'บริษัท ยูไนเต็ด ฟลาวร์ จำกัด', 'United Flour Co., Ltd.',   'คุณสมชาย', '02-111-1111', 30],
    ['VEND-002', 'บริษัท โกลเด้น แดรี่ จำกัด',    'Golden Dairy Co., Ltd.',    'คุณมาลี',   '02-222-2222', 30],
    ['VEND-003', 'บริษัท ซีเนียร์ แพ็คเกจ จำกัด', 'Senior Package Co., Ltd.', 'คุณวิชัย',  '02-333-3333', 45],
    ['VEND-004', 'บริษัท เอ็กซ์เพรส ฟู้ด จำกัด',  'Express Food Co., Ltd.',   'คุณนิดา',   '02-444-4444', 30],
    ['VEND-005', 'บริษัท ออลล์ เซฟ จำกัด',        'All Safe Co., Ltd.',        'คุณประยูร', '02-555-5555', 60],
  ];

  let vCount = 0;
  for (const [code, name_th, name_en, contact_name, phone, payment_terms_days] of vendors) {
    const r = await q(
      `INSERT INTO vendors (code, name_th, name_en, contact_name, phone, payment_terms_days)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING RETURNING id`,
      [code, name_th, name_en, contact_name, phone, payment_terms_days]
    );
    if (r.length) vCount++;
  }
  log('vendors', vCount);

  // vendor_products
  const vendorRows = await q(`SELECT id, code FROM vendors WHERE code LIKE 'VEND-%'`);
  const vByCode = Object.fromEntries(vendorRows.map(v => [v.code, v.id]));
  const prodRows = await q(`SELECT id, sku FROM products WHERE sku IN ('ING-001','ING-002','ING-003','ING-004','BEV-001','BEV-002','PKG-001','PKG-002','PKG-003','EQP-001')`);
  const pBySku = Object.fromEntries(prodRows.map(p => [p.sku, p.id]));

  // [vendorCode, sku, unit_price, is_preferred]
  const links = [
    ['VEND-001', 'ING-001', 22, true],
    ['VEND-001', 'ING-003', 28, true],
    ['VEND-001', 'ING-004', 350, true],
    ['VEND-002', 'ING-002', 180, true],
    ['VEND-003', 'PKG-001', 8, true],
    ['VEND-003', 'PKG-002', 12, true],
    ['VEND-003', 'PKG-003', 15, true],
    ['VEND-004', 'BEV-001', 95, true],
    ['VEND-004', 'BEV-002', 120, true],
    ['VEND-005', 'EQP-001', 55, true],
  ];

  let vpCount = 0;
  for (const [vc, sku, unit_price, is_preferred] of links) {
    const r = await q(
      `INSERT INTO vendor_products (vendor_id, product_id, unit_price, is_preferred)
       VALUES ($1,$2,$3,$4) ON CONFLICT (vendor_id, product_id) DO NOTHING RETURNING id`,
      [vByCode[vc], pBySku[sku], unit_price, is_preferred]
    );
    if (r.length) vpCount++;
  }
  log('vendor_products', vpCount);
}
async function seedCustomers(users, wh, uoms) {
  // [code, name_th, name_en, contact_name, phone, tax_id, payment_terms_days, credit_limit]
  const customers = [
    ['CUST-001', 'ร้านกาแฟอรุณ',           'Arun Café',             'คุณอรุณ',   '081-111-1111', '0123456780001', 30,  50000],
    ['CUST-002', 'ร้านเบเกอรี่มิตร',        'Mitr Bakery',           'คุณมิตร',   '081-222-2222', '0123456780002', 30,  100000],
    ['CUST-003', 'โรงแรมทองคำ',             'Golden Hotel',          'คุณทองคำ',  '081-333-3333', '0123456780003', 30,  200000],
    ['CUST-004', 'ร้านสะดวกซื้อดาว',        'Star Convenience',      'คุณดาว',    '081-444-4444', '0123456780004', 30,  80000],
    ['CUST-005', 'บริษัท ฟู้ดซัพพลาย จำกัด','Food Supply Co., Ltd.', 'คุณสุรศักดิ์','082-111-1111','0987654320001', 45, 500000],
    ['CUST-006', 'ห้างมาร์เก็ตกรุ๊ป',       'Market Group',          'คุณกรุ๊ป',  '082-222-2222', '0987654320002', 45, 1000000],
    ['CUST-007', 'บริษัท ฟาสต์ฟู้ด เชน จำกัด','Fast Food Chain Co.','คุณเชน',    '082-333-3333', '0987654320003', 45, 2000000],
    ['CUST-008', 'โรงเรียนโภชนาการ',         'Nutrition Academy',     'คุณโภชน์',  '082-444-4444', '0987654320004', 30, 300000],
  ];

  let count = 0;
  for (const [code, name_th, name_en, contact_name, phone, tax_id, payment_terms_days, credit_limit] of customers) {
    const r = await q(
      `INSERT INTO customers (code, name_th, name_en, contact_name, phone, tax_id, payment_terms_days, credit_limit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (code) DO NOTHING RETURNING id`,
      [code, name_th, name_en, contact_name, phone, tax_id, payment_terms_days, credit_limit]
    );
    if (r.length) count++;
  }
  log('customers', count);
}
async function seedPricingAndMembers(users, wh, uoms) {
  const prods = await q(`SELECT id, sku, selling_price FROM products WHERE sku LIKE ANY(ARRAY['BRD-%','PST-%','ING-%','BEV-%','PKG-%','EQP-%'])`);

  const tiers = ['T0', 'T1', 'T2', 'T3'];
  const tierMult = { T0: 1.0, T1: 0.95, T2: 0.90, T3: 0.85 };
  const channels = ['TRD', 'AKRA'];
  const akraMult = 0.80;

  let priceCount = 0;
  for (const prod of prods) {
    for (const channel of channels) {
      for (const tier of tiers) {
        const base = channel === 'TRD'
          ? parseFloat(prod.selling_price) * tierMult[tier]
          : parseFloat(prod.selling_price) * akraMult * tierMult[tier];
        const price = Math.round(base * 100) / 100;
        const r = await q(
          `INSERT INTO product_prices (product_id, channel, tier, price, valid_from)
           VALUES ($1, $2::price_channel, $3::price_tier, $4, '2025-01-01')
           ON CONFLICT (product_id, channel, tier, valid_from) DO NOTHING RETURNING id`,
          [prod.id, channel, tier, price]
        );
        if (r.length) priceCount++;
      }
    }
  }
  log('product_prices', priceCount);

  // POS members
  const members = [
    ['สมชาย ใจดี',   '099-001-0001', 'somchai@example.com',  'standard', 0,    100],
    ['สมหญิง รักดี', '099-002-0002', 'somying@example.com',  'silver',   0.05, 350],
    ['วิชัย มั่งมี',  '099-003-0003', 'wichai@example.com',   'gold',     0.10, 1200],
  ];
  let mCount = 0;
  for (const [name_th, phone, email, tier, discount_rate, point_balance] of members) {
    const r = await q(
      `INSERT INTO pos_members (name_th, phone, email, tier, discount_rate, point_balance)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (phone) DO NOTHING RETURNING id`,
      [name_th, phone, email, tier, discount_rate, point_balance]
    );
    if (r.length) mCount++;
  }
  log('pos_members', mCount);
}
async function seedStock(users, wh, uoms) {
  const prods = await q(`SELECT id, sku, unit_cost FROM products WHERE sku LIKE ANY(ARRAY['BRD-%','PST-%','ING-%','BEV-%','PKG-%','EQP-%'])`);
  const pBySku = Object.fromEntries(prods.map(p => [p.sku, { id: p.id, cost: parseFloat(p.unit_cost) }]));

  // [sku, W1_qty, W2_qty, W3_qty]
  const stock = [
    ['BRD-001', 100, 200, 150],
    ['BRD-002', 80,  160, 120],
    ['BRD-003', 60,  120, 90],
    ['PST-001', 50,  100, 75],
    ['PST-002', 40,  80,  60],
    ['ING-001', 200, 500, 300],
    ['ING-002', 50,  150, 80],
    ['ING-003', 150, 400, 200],
    ['ING-004', 20,  60,  30],
    ['BEV-001', 30,  80,  40],
    ['BEV-002', 25,  70,  35],
    ['PKG-001', 100, 300, 150],
    ['PKG-002', 80,  250, 120],
    ['PKG-003', 60,  200, 100],
    ['EQP-001', 20,  50,  25],
  ];

  // Check if any stock_ledger entry already exists for these products (skip if already seeded)
  const existingCheck = await q(
    `SELECT COUNT(*) AS cnt FROM stock_ledger WHERE created_by = $1 AND entry_type = 'grn_receipt'`,
    [users.admin.id]
  );
  if (parseInt(existingCheck[0].cnt) > 0) {
    log('stock_ledger (skipped — already exists)', 0);
    return;
  }

  const warehousePairs = [['W1', 0], ['W2', 1], ['W3', 2]];
  let count = 0;
  for (const [sku, ...qtys] of stock) {
    for (const [whCode, qtyIdx] of warehousePairs) {
      await q(
        `INSERT INTO stock_ledger (product_id, warehouse_id, entry_type, qty_change, qty_after, unit_cost, reference_id, created_by)
         VALUES ($1, $2, 'grn_receipt', $3, $3, $4, NULL, $5)`,
        [pBySku[sku].id, wh[whCode], qtys[qtyIdx], pBySku[sku].cost, users.admin.id]
      );
      count++;
    }
  }
  log('stock_ledger', count);
}
async function seedPurchaseFlow(users, wh, uoms) {
  const guard = await q(
    `SELECT id FROM purchase_requisitions WHERE notes='ต้องการวัตถุดิบด่วน' AND requested_by=$1 LIMIT 1`,
    [users.staff.id]
  );
  if (guard.length) { log('purchase flow (skipped — already seeded)', 0); return; }

  const prods = await q(`SELECT id, sku FROM products WHERE sku IN ('ING-001','ING-002','ING-003','ING-004','BEV-001','BEV-002')`);
  const pBySku = Object.fromEntries(prods.map(p => [p.sku, p.id]));
  const vendors = await q(`SELECT id, code FROM vendors WHERE code IN ('VEND-001','VEND-002','VEND-004')`);
  const vByCode = Object.fromEntries(vendors.map(v => [v.code, v.id]));

  // ── PR-MOCK-001: submitted, waiting manager approval ──
  let prRows = await q(
    `INSERT INTO purchase_requisitions (warehouse_id, requested_by, status, notes)
     VALUES ($1, $2, 'submitted'::pr_status, 'ต้องการวัตถุดิบด่วน')
     ON CONFLICT DO NOTHING RETURNING id`,
    [wh['W2'], users.staff.id]
  );
  if (!prRows.length) prRows = await q(`SELECT id FROM purchase_requisitions WHERE requested_by=$1 AND status='submitted' LIMIT 1`,[users.staff.id]);
  const pr1Id = prRows[0].id;

  const pr1Lines = [
    [pBySku['ING-001'], 500, 22, 1],
    [pBySku['ING-003'], 200, 28, 2],
    [pBySku['ING-004'], 50,  350, 3],
  ];
  for (const [product_id, qty, unit_cost, ln] of pr1Lines) {
    await q(
      `INSERT INTO pr_line_items (pr_id, product_id, qty_requested, unit_cost, line_number)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (pr_id, line_number) DO NOTHING`,
      [pr1Id, product_id, qty, unit_cost, ln]
    );
  }
  log('purchase_requisitions (submitted)', 1);

  // ── PR-MOCK-002: converted_to_po ──
  let pr2Rows = await q(
    `INSERT INTO purchase_requisitions (warehouse_id, requested_by, status, manager_approved_by, manager_approved_at, notes)
     VALUES ($1,$2,'converted_to_po'::pr_status,$3,NOW(),'ต้องการเครื่องดื่ม')
     ON CONFLICT DO NOTHING RETURNING id`,
    [wh['W2'], users.staff.id, users.manager.id]
  );
  if (!pr2Rows.length) pr2Rows = await q(`SELECT id FROM purchase_requisitions WHERE status='converted_to_po' LIMIT 1`);
  const pr2Id = pr2Rows[0].id;

  const pr2Lines = [
    [pBySku['BEV-001'], 50, 95, 1],
    [pBySku['BEV-002'], 30, 120, 2],
  ];
  for (const [product_id, qty, unit_cost, ln] of pr2Lines) {
    await q(
      `INSERT INTO pr_line_items (pr_id, product_id, qty_requested, unit_cost, line_number)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (pr_id, line_number) DO NOTHING`,
      [pr2Id, product_id, qty, unit_cost, ln]
    );
  }
  log('purchase_requisitions (converted)', 1);

  // ── PO-MOCK-001: sent — VEND-004, beverages, from PR-002 ──
  const po1Sub = 50 * 95 + 30 * 120;  // 4750 + 3600 = 8350
  const po1Vat = Math.round(po1Sub * 0.07 * 100) / 100;
  let po1Rows = await q(
    `INSERT INTO purchase_orders (vendor_id, warehouse_id, status, expected_date, payment_terms_days, subtotal, vat_amount, total_amount, created_by)
     VALUES ($1,$2,'sent'::po_status, CURRENT_DATE + 7, 30, $3,$4,$5,$6)
     ON CONFLICT DO NOTHING RETURNING id`,
    [vByCode['VEND-004'], wh['W2'], po1Sub, po1Vat, po1Sub + po1Vat, users.manager.id]
  );
  if (!po1Rows.length) po1Rows = await q(`SELECT id FROM purchase_orders WHERE vendor_id=$1 AND status='sent' LIMIT 1`,[vByCode['VEND-004']]);
  const po1Id = po1Rows[0].id;

  await q(`INSERT INTO pr_po_links (pr_id, po_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [pr2Id, po1Id]);

  const po1Lines = [
    [pBySku['BEV-001'], 50, 95, 1],
    [pBySku['BEV-002'], 30, 120, 2],
  ];
  const po1LineIds = [];
  for (const [product_id, qty, unit_price, ln] of po1Lines) {
    const r = await q(
      `INSERT INTO po_line_items (po_id, product_id, qty_ordered, qty_received, unit_price, line_number)
       VALUES ($1,$2,$3,0,$4,$5) ON CONFLICT (po_id, line_number) DO NOTHING RETURNING id`,
      [po1Id, product_id, qty, unit_price, ln]
    );
    if (r.length) po1LineIds.push({ id: r[0].id, product_id, qty });
  }
  log('purchase_orders (sent)', 1);

  // ── PO-MOCK-002: partially_received — VEND-001, ING-001 ──
  const po2Sub = 500 * 22;  // 11000
  const po2Vat = Math.round(po2Sub * 0.07 * 100) / 100;
  let po2Rows = await q(
    `INSERT INTO purchase_orders (vendor_id, warehouse_id, status, expected_date, payment_terms_days, subtotal, vat_amount, total_amount, created_by)
     VALUES ($1,$2,'partially_received'::po_status, CURRENT_DATE - 5, 30, $3,$4,$5,$6)
     ON CONFLICT DO NOTHING RETURNING id`,
    [vByCode['VEND-001'], wh['W2'], po2Sub, po2Vat, po2Sub + po2Vat, users.manager.id]
  );
  if (!po2Rows.length) po2Rows = await q(`SELECT id FROM purchase_orders WHERE vendor_id=$1 AND status='partially_received' LIMIT 1`,[vByCode['VEND-001']]);
  const po2Id = po2Rows[0].id;

  let po2Line1Rows = await q(
    `INSERT INTO po_line_items (po_id, product_id, qty_ordered, qty_received, unit_price, line_number)
     VALUES ($1,$2,500,250,22,1) ON CONFLICT (po_id, line_number) DO NOTHING RETURNING id`,
    [po2Id, pBySku['ING-001']]
  );
  if (!po2Line1Rows.length) po2Line1Rows = await q(`SELECT id FROM po_line_items WHERE po_id=$1 AND line_number=1`,[po2Id]);
  const po2Line1Id = po2Line1Rows[0].id;
  log('purchase_orders (partially_received)', 1);

  // ── PO-MOCK-003: partially_received — VEND-002, ING-002 ──
  const po3Sub = 100 * 180; // 18000
  const po3Vat = Math.round(po3Sub * 0.07 * 100) / 100;
  let po3Rows = await q(
    `INSERT INTO purchase_orders (vendor_id, warehouse_id, status, expected_date, payment_terms_days, subtotal, vat_amount, total_amount, created_by)
     VALUES ($1,$2,'partially_received'::po_status, CURRENT_DATE - 3, 30, $3,$4,$5,$6)
     ON CONFLICT DO NOTHING RETURNING id`,
    [vByCode['VEND-002'], wh['W2'], po3Sub, po3Vat, po3Sub + po3Vat, users.manager.id]
  );
  if (!po3Rows.length) po3Rows = await q(`SELECT id FROM purchase_orders WHERE vendor_id=$1 AND status='partially_received' LIMIT 1`,[vByCode['VEND-002']]);
  const po3Id = po3Rows[0].id;

  let po3Line1Rows = await q(
    `INSERT INTO po_line_items (po_id, product_id, qty_ordered, qty_received, unit_price, line_number)
     VALUES ($1,$2,100,50,180,1) ON CONFLICT (po_id, line_number) DO NOTHING RETURNING id`,
    [po3Id, pBySku['ING-002']]
  );
  if (!po3Line1Rows.length) po3Line1Rows = await q(`SELECT id FROM po_line_items WHERE po_id=$1 AND line_number=1`,[po3Id]);
  const po3Line1Id = po3Line1Rows[0].id;
  log('purchase_orders (partially_received #2)', 1);

  // ── GRN-MOCK-001: received (awaiting QC), linked to PO-MOCK-002 ──
  let grn1Rows = await q(
    `INSERT INTO goods_receipt_notes (po_id, warehouse_id, status, received_by, received_date, source_type)
     VALUES ($1,$2,'received'::grn_status,$3,CURRENT_DATE - 4, 'po'::grn_source_type)
     ON CONFLICT DO NOTHING RETURNING id`,
    [po2Id, wh['W2'], users.staff.id]
  );
  if (!grn1Rows.length) grn1Rows = await q(`SELECT id FROM goods_receipt_notes WHERE po_id=$1 AND status='received' LIMIT 1`,[po2Id]);
  const grn1Id = grn1Rows[0].id;

  await q(
    `INSERT INTO grn_line_items (grn_id, po_line_item_id, product_id, qty_received, qty_accepted, line_number, source_type)
     VALUES ($1,$2,$3,250,250,1, 'po'::grn_source_type) ON CONFLICT (grn_id, line_number) DO NOTHING`,
    [grn1Id, po2Line1Id, pBySku['ING-001']]
  );
  log('grn (received — QC pending)', 1);

  // ── GRN-MOCK-002: qc_passed (awaiting stock), linked to PO-MOCK-003 ──
  let grn2Rows = await q(
    `INSERT INTO goods_receipt_notes (po_id, warehouse_id, status, received_by, received_date, qc_reviewed_by, qc_reviewed_at, qc_notes, source_type)
     VALUES ($1,$2,'qc_passed'::grn_status,$3,CURRENT_DATE - 2,$4,NOW(),'สินค้าผ่าน QC ทั้งหมด', 'po'::grn_source_type)
     ON CONFLICT DO NOTHING RETURNING id`,
    [po3Id, wh['W2'], users.staff.id, users.manager.id]
  );
  if (!grn2Rows.length) grn2Rows = await q(`SELECT id FROM goods_receipt_notes WHERE po_id=$1 AND status='qc_passed' LIMIT 1`,[po3Id]);
  const grn2Id = grn2Rows[0].id;

  await q(
    `INSERT INTO grn_line_items (grn_id, po_line_item_id, product_id, qty_received, qty_accepted, line_number, source_type)
     VALUES ($1,$2,$3,50,50,1, 'po'::grn_source_type) ON CONFLICT (grn_id, line_number) DO NOTHING`,
    [grn2Id, po3Line1Id, pBySku['ING-002']]
  );
  log('grn (qc_passed — ready to stock)', 1);
}
async function seedSalesFlow(users, wh, uoms) {
  const guard = await q(
    `SELECT id FROM sales_quotations WHERE created_by=$1 AND status='sent' LIMIT 1`,
    [users.manager.id]
  );
  if (guard.length) { log('sales flow (skipped — already seeded)', 0); return; }

  const prods = await q(`SELECT id, sku, selling_price FROM products WHERE sku IN ('BRD-001','BRD-002','PST-001','PST-002','BEV-001','ING-001')`);
  const pBySku = Object.fromEntries(prods.map(p => [p.sku, { id: p.id, price: parseFloat(p.selling_price) }]));
  const custs = await q(`SELECT id, code FROM customers WHERE code IN ('CUST-001','CUST-002','CUST-003','CUST-005')`);
  const cByCode = Object.fromEntries(custs.map(c => [c.code, c.id]));

  // ── SQ-MOCK-001: sent, CUST-003, 3 items ──
  const sqSub = 10 * pBySku['BRD-001'].price + 5 * pBySku['PST-001'].price + 5 * pBySku['BEV-001'].price;
  const sqVat = Math.round(sqSub * 0.07 * 100) / 100;
  let sqRows = await q(
    `INSERT INTO sales_quotations (customer_id, warehouse_id, status, valid_until, subtotal, vat_amount, total_amount, created_by, sent_at, channel)
     VALUES ($1,$2,'sent'::sq_status, CURRENT_DATE + 30, $3,$4,$5,$6, NOW(), 'TRD'::price_channel)
     ON CONFLICT DO NOTHING RETURNING id`,
    [cByCode['CUST-003'], wh['W1'], sqSub, sqVat, sqSub + sqVat, users.manager.id]
  );
  if (!sqRows.length) sqRows = await q(`SELECT id FROM sales_quotations WHERE customer_id=$1 AND status='sent' LIMIT 1`,[cByCode['CUST-003']]);
  const sqId = sqRows[0].id;

  const sqLines = [
    [pBySku['BRD-001'], 10, 1],
    [pBySku['PST-001'], 5,  2],
    [pBySku['BEV-001'], 5,  3],
  ];
  for (const [prod, qty, ln] of sqLines) {
    await q(
      `INSERT INTO sq_line_items (sq_id, product_id, qty, unit_price, discount_amount, line_number)
       VALUES ($1,$2,$3,$4,0,$5) ON CONFLICT (sq_id, line_number) DO NOTHING`,
      [sqId, prod.id, qty, prod.price, ln]
    );
  }
  log('sales_quotations (sent)', 1);

  // ── SO-MOCK-001: confirmed, CUST-001, 2 items ──
  const so1Sub = 20 * pBySku['BRD-002'].price + 10 * pBySku['PST-002'].price;
  const so1Vat = Math.round(so1Sub * 0.07 * 100) / 100;
  let so1Rows = await q(
    `INSERT INTO sales_orders (customer_id, warehouse_id, status, expected_delivery, payment_terms_days, subtotal, vat_amount, total_amount, confirmed_by, confirmed_at, created_by, channel)
     VALUES ($1,$2,'confirmed'::so_status, CURRENT_DATE + 3, 30, $3,$4,$5,$6,NOW(),$6, 'TRD'::price_channel)
     ON CONFLICT DO NOTHING RETURNING id`,
    [cByCode['CUST-001'], wh['W1'], so1Sub, so1Vat, so1Sub + so1Vat, users.manager.id]
  );
  if (!so1Rows.length) so1Rows = await q(`SELECT id FROM sales_orders WHERE customer_id=$1 AND status='confirmed' LIMIT 1`,[cByCode['CUST-001']]);
  const so1Id = so1Rows[0].id;

  let so1L1 = await q(
    `INSERT INTO so_line_items (so_id, product_id, qty_ordered, qty_delivered, unit_price, discount_amount, line_number)
     VALUES ($1,$2,20,0,$3,0,1) ON CONFLICT (so_id, line_number) DO NOTHING RETURNING id`,
    [so1Id, pBySku['BRD-002'].id, pBySku['BRD-002'].price]
  );
  if (!so1L1.length) so1L1 = await q(`SELECT id FROM so_line_items WHERE so_id=$1 AND line_number=1`,[so1Id]);

  let so1L2 = await q(
    `INSERT INTO so_line_items (so_id, product_id, qty_ordered, qty_delivered, unit_price, discount_amount, line_number)
     VALUES ($1,$2,10,0,$3,0,2) ON CONFLICT (so_id, line_number) DO NOTHING RETURNING id`,
    [so1Id, pBySku['PST-002'].id, pBySku['PST-002'].price]
  );
  if (!so1L2.length) so1L2 = await q(`SELECT id FROM so_line_items WHERE so_id=$1 AND line_number=2`,[so1Id]);
  log('sales_orders (confirmed)', 1);

  // ── DO-MOCK-001: ready, linked to SO-MOCK-001 ──
  let do1Rows = await q(
    `INSERT INTO delivery_orders (so_id, warehouse_id, status, shipping_address, created_by)
     VALUES ($1,$2,'ready'::do_status,'ส่งที่ร้านกาแฟอรุณ 123/45 ถ.สุขุมวิท',$3)
     ON CONFLICT DO NOTHING RETURNING id`,
    [so1Id, wh['W1'], users.manager.id]
  );
  if (!do1Rows.length) do1Rows = await q(`SELECT id FROM delivery_orders WHERE so_id=$1 AND status='ready' LIMIT 1`,[so1Id]);
  const do1Id = do1Rows[0].id;

  await q(
    `INSERT INTO do_line_items (do_id, so_line_item_id, product_id, qty_to_deliver, unit_price, line_number)
     VALUES ($1,$2,$3,20,$4,1) ON CONFLICT (do_id, line_number) DO NOTHING`,
    [do1Id, so1L1[0].id, pBySku['BRD-002'].id, pBySku['BRD-002'].price]
  );
  await q(
    `INSERT INTO do_line_items (do_id, so_line_item_id, product_id, qty_to_deliver, unit_price, line_number)
     VALUES ($1,$2,$3,10,$4,2) ON CONFLICT (do_id, line_number) DO NOTHING`,
    [do1Id, so1L2[0].id, pBySku['PST-002'].id, pBySku['PST-002'].price]
  );
  log('delivery_orders (ready)', 1);

  // ── SO-MOCK-002: partially_delivered, CUST-005, 2 items ──
  const so2Sub = 100 * pBySku['BRD-001'].price + 50 * pBySku['ING-001'].price;
  const so2Vat = Math.round(so2Sub * 0.07 * 100) / 100;
  let so2Rows = await q(
    `INSERT INTO sales_orders (customer_id, warehouse_id, status, expected_delivery, payment_terms_days, subtotal, vat_amount, total_amount, confirmed_by, confirmed_at, created_by, channel)
     VALUES ($1,$2,'partially_delivered'::so_status, CURRENT_DATE + 5, 45, $3,$4,$5,$6,NOW(),$6, 'TRD'::price_channel)
     ON CONFLICT DO NOTHING RETURNING id`,
    [cByCode['CUST-005'], wh['W1'], so2Sub, so2Vat, so2Sub + so2Vat, users.manager.id]
  );
  if (!so2Rows.length) so2Rows = await q(`SELECT id FROM sales_orders WHERE customer_id=$1 AND status='partially_delivered' LIMIT 1`,[cByCode['CUST-005']]);
  const so2Id = so2Rows[0].id;

  await q(
    `INSERT INTO so_line_items (so_id, product_id, qty_ordered, qty_delivered, unit_price, discount_amount, line_number)
     VALUES ($1,$2,100,60,$3,0,1) ON CONFLICT (so_id, line_number) DO NOTHING`,
    [so2Id, pBySku['BRD-001'].id, pBySku['BRD-001'].price]
  );
  await q(
    `INSERT INTO so_line_items (so_id, product_id, qty_ordered, qty_delivered, unit_price, discount_amount, line_number)
     VALUES ($1,$2,50,0,$3,0,2) ON CONFLICT (so_id, line_number) DO NOTHING`,
    [so2Id, pBySku['ING-001'].id, pBySku['ING-001'].price]
  );
  log('sales_orders (partially_delivered)', 1);
}
async function seedPosSession(users, wh, uoms) {
  const existing = await q(
    `SELECT id FROM pos_sessions WHERE warehouse_id=$1 AND status='open' LIMIT 1`,
    [wh['W1']]
  );
  if (existing.length) {
    log('pos_sessions (skipped — already open)', 0);
    return;
  }
  await q(
    `INSERT INTO pos_sessions (warehouse_id, opened_by, status, opening_float)
     VALUES ($1,$2,'open'::pos_session_status,5000)`,
    [wh['W1'], users.staff.id]
  );
  log('pos_sessions (open)', 1);
}
async function seedHR(users, wh, uoms) {
  // Leave types
  const leaveTypes = [
    ['LT-ANN',  'ลาพักร้อน', 'Annual Leave',   10, true,  false],
    ['LT-SICK', 'ลาป่วย',    'Sick Leave',     30, true,  false],
    ['LT-PER',  'ลากิจ',     'Personal Leave',  3, true,  false],
  ];
  let ltCount = 0;
  for (const [code, name_th, name_en, days_per_year, is_paid, carry_over] of leaveTypes) {
    const r = await q(
      `INSERT INTO leave_types (code, name_th, name_en, days_per_year, is_paid, carry_over)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING RETURNING id`,
      [code, name_th, name_en, days_per_year, is_paid, carry_over]
    );
    if (r.length) ltCount++;
  }
  log('leave_types', ltCount);

  const ltRows = await q(`SELECT id, code FROM leave_types WHERE code IN ('LT-ANN','LT-SICK','LT-PER')`);
  const ltByCode = Object.fromEntries(ltRows.map(l => [l.code, l.id]));

  // Leave balances for all users
  const allUsers = [users.admin, users.manager, ...users.staffAll];
  let lbCount = 0;
  for (const user of allUsers) {
    for (const [code, , , days_per_year] of leaveTypes) {
      const r = await q(
        `INSERT INTO leave_balances (employee_id, leave_type_id, year, days_entitled, days_used)
         VALUES ($1,$2,2026,$3,0) ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING RETURNING id`,
        [user.id, ltByCode[code], days_per_year]
      );
      if (r.length) lbCount++;
    }
  }
  log('leave_balances', lbCount);

  // Leave request 1: pending — staff[0], annual leave
  const lr1Guard = await q(
    `SELECT id FROM leave_requests WHERE employee_id=$1 AND notes='ขอลาพักร้อนประจำปี' LIMIT 1`,
    [users.staff.id]
  );
  if (!lr1Guard.length) {
    await q(
      `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days_requested, status, notes)
       VALUES ($1,$2,'2026-06-02','2026-06-03',2,'submitted','ขอลาพักร้อนประจำปี')
       ON CONFLICT DO NOTHING`,
      [users.staff.id, ltByCode['LT-ANN']]
    );
  }
  log('leave_requests (pending)', lr1Guard.length ? 0 : 1);

  // Leave request 2: approved — staff[1] or manager if only 1 staff
  const staff2 = users.staffAll[1] || users.manager;
  const lr2Guard = await q(
    `SELECT id FROM leave_requests WHERE employee_id=$1 AND notes='ลาป่วย ไข้หวัดใหญ่' LIMIT 1`,
    [staff2.id]
  );
  if (!lr2Guard.length) {
    await q(
      `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days_requested, status, approved_by, approved_at, notes)
       VALUES ($1,$2,'2026-05-20','2026-05-21',2,'approved',$3,NOW(),'ลาป่วย ไข้หวัดใหญ่')
       ON CONFLICT DO NOTHING`,
      [staff2.id, ltByCode['LT-SICK'], users.manager.id]
    );
  }
  log('leave_requests (approved)', lr2Guard.length ? 0 : 1);

  // Attendance: last 10 working days for all non-admin users
  const workUsers = [users.manager, ...users.staffAll];
  let attCount = 0;
  for (let dayOffset = 9; dayOffset >= 0; dayOffset--) {
    const dateQ = await q(`SELECT (CURRENT_DATE - $1::int)::date AS d`,[dayOffset]);
    const work_date = dateQ[0].d;
    // Skip weekends
    const dow = await q(`SELECT EXTRACT(DOW FROM $1::date) AS dow`,[work_date]);
    if ([0, 6].includes(parseInt(dow[0].dow))) continue;

    for (const user of workUsers) {
      const r = await q(
        `INSERT INTO attendance_records (employee_id, work_date, clock_in, clock_out, status)
         VALUES ($1, $2::date, $3::timestamp + interval '8 hours', $4::timestamp + interval '17 hours', 'present')
         ON CONFLICT (employee_id, work_date) DO NOTHING RETURNING id`,
        [user.id, work_date, work_date, work_date]
      );
      if (r.length) attCount++;
    }
  }
  log('attendance_records', attCount);
}
async function seedAccounting(users, wh, uoms, accounts) {
  // Fiscal periods: 2025-01 through 2026-12
  let fpCount = 0;
  for (let year = 2025; year <= 2026; year++) {
    for (let month = 1; month <= 12; month++) {
      const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
      const endDateQ = await q(
        `SELECT (DATE_TRUNC('month', $1::date) + interval '1 month' - interval '1 day')::date AS d`,
        [startDate]
      );
      const endDate = endDateQ[0].d;
      const name = `${year}-${String(month).padStart(2,'0')}`;
      const r = await q(
        `INSERT INTO fiscal_periods (name_th, name_en, year, month, start_date, end_date, status)
         VALUES ($1,$1,$2,$3,$4,$5,'open'::fiscal_period_status)
         ON CONFLICT (year, month) DO NOTHING RETURNING id`,
        [name, year, month, startDate, endDate]
      );
      if (r.length) fpCount++;
    }
  }
  log('fiscal_periods', fpCount);

  // Get current fiscal period
  const fpRows = await q(
    `SELECT id FROM fiscal_periods WHERE year=EXTRACT(YEAR FROM NOW()) AND month=EXTRACT(MONTH FROM NOW()) LIMIT 1`
  );
  if (!fpRows.length) { log('journal_entries (skipped — no period)', 0); return; }
  const fpId = fpRows[0].id;

  const jeGuard = await q(
    `SELECT id FROM journal_entries WHERE fiscal_period_id=$1 AND created_by=$2 LIMIT 1`,
    [fpId, users.admin.id]
  );
  if (jeGuard.length) { log('journal_entries (skipped — already seeded)', 0); return; }

  // JE-MOCK-001: draft manual adjustment
  let je1Rows = await q(
    `INSERT INTO journal_entries (fiscal_period_id, entry_date, entry_type, description, status, created_by)
     VALUES ($1,CURRENT_DATE,'manual','ปรับยอดสินค้าเริ่มต้น / Opening inventory adjustment','draft'::journal_entry_status,$2)
     ON CONFLICT DO NOTHING RETURNING id`,
    [fpId, users.admin.id]
  );
  if (!je1Rows.length) je1Rows = await q(`SELECT id FROM journal_entries WHERE status='draft' AND created_by=$1 LIMIT 1`,[users.admin.id]);
  const je1Id = je1Rows[0].id;

  const acc1300 = accounts['1300'] || accounts['1300-TRD'];
  const acc3000 = accounts['3000'];
  if (acc1300 && acc3000) {
    await q(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount, line_number)
       VALUES ($1,$2,'สินค้าคงเหลือเริ่มต้น',500000,0,1) ON CONFLICT (journal_entry_id, line_number) DO NOTHING`,
      [je1Id, acc1300]
    );
    await q(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount, line_number)
       VALUES ($1,$2,'ส่วนของผู้ถือหุ้นเริ่มต้น',0,500000,2) ON CONFLICT (journal_entry_id, line_number) DO NOTHING`,
      [je1Id, acc3000]
    );
  }
  log('journal_entries (draft)', 1);

  // JE-MOCK-002: posted AP payment
  let je2Rows = await q(
    `INSERT INTO journal_entries (fiscal_period_id, entry_date, entry_type, description, status, posted_by, posted_at, created_by)
     VALUES ($1,CURRENT_DATE - 3,'ap_payment','ชำระค่าสินค้า VEND-001 / AP payment United Flour','posted'::journal_entry_status,$2,NOW(),$2)
     ON CONFLICT DO NOTHING RETURNING id`,
    [fpId, users.admin.id]
  );
  if (!je2Rows.length) je2Rows = await q(`SELECT id FROM journal_entries WHERE status='posted' AND entry_type='ap_payment' AND created_by=$1 LIMIT 1`,[users.admin.id]);
  const je2Id = je2Rows[0].id;

  const acc2100 = accounts['2100'];
  const acc1100 = accounts['1100'];
  if (acc2100 && acc1100) {
    await q(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount, line_number)
       VALUES ($1,$2,'เจ้าหนี้ VEND-001',50000,0,1) ON CONFLICT (journal_entry_id, line_number) DO NOTHING`,
      [je2Id, acc2100]
    );
    await q(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount, line_number)
       VALUES ($1,$2,'จ่ายเงินสด',0,50000,2) ON CONFLICT (journal_entry_id, line_number) DO NOTHING`,
      [je2Id, acc1100]
    );
  }
  log('journal_entries (posted)', 1);
}
async function seedMisc(users, wh, uoms) {
  const guard = await q(
    `SELECT id FROM warehouse_transfers WHERE notes='โอนย้ายสินค้าเติมหน้าร้าน TRD' LIMIT 1`
  );
  if (guard.length) { log('misc (skipped — already seeded)', 0); return; }

  const prods = await q(`SELECT id, sku FROM products WHERE sku IN ('BRD-001','BRD-002','ING-001','ING-002')`);
  const pBySku = Object.fromEntries(prods.map(p => [p.sku, p.id]));
  const vendors = await q(`SELECT id, code FROM vendors WHERE code IN ('VEND-001','VEND-002')`);
  const vByCode = Object.fromEntries(vendors.map(v => [v.code, v.id]));

  // ── Transfer: pending W2→W1 ──
  let trfRows = await q(
    `INSERT INTO warehouse_transfers (source_warehouse_id, dest_warehouse_id, initiated_by, status, notes)
     VALUES ($1,$2,$3,'pending'::transfer_status,'โอนย้ายสินค้าเติมหน้าร้าน TRD')
     ON CONFLICT DO NOTHING RETURNING id`,
    [wh['W2'], wh['W1'], users.manager.id]
  );
  if (!trfRows.length) trfRows = await q(`SELECT id FROM warehouse_transfers WHERE source_warehouse_id=$1 AND dest_warehouse_id=$2 AND status='pending' LIMIT 1`,[wh['W2'],wh['W1']]);
  const trfId = trfRows[0].id;

  const trfLines = [
    [pBySku['BRD-001'], 50, 1],
    [pBySku['BRD-002'], 40, 2],
    [pBySku['ING-001'], 100, 3],
  ];
  for (const [product_id, qty, ln] of trfLines) {
    await q(
      `INSERT INTO warehouse_transfer_lines (transfer_id, product_id, qty, line_number)
       VALUES ($1,$2,$3,$4) ON CONFLICT (transfer_id, line_number) DO NOTHING`,
      [trfId, product_id, qty, ln]
    );
  }
  log('warehouse_transfers (pending)', 1);

  // ── RMA: open, W2, VEND-001 ──
  let rmaRows = await q(
    `INSERT INTO rma_requests (warehouse_id, vendor_id, initiated_by, status, notes)
     VALUES ($1,$2,$3,'open'::rma_status,'สินค้าแป้งสาลีชำรุด บรรจุภัณฑ์แตก')
     ON CONFLICT DO NOTHING RETURNING id`,
    [wh['W2'], vByCode['VEND-001'], users.manager.id]
  );
  if (!rmaRows.length) rmaRows = await q(`SELECT id FROM rma_requests WHERE vendor_id=$1 AND status='open' LIMIT 1`,[vByCode['VEND-001']]);
  const rmaId = rmaRows[0].id;

  await q(
    `INSERT INTO rma_line_items (rma_id, product_id, qty_returned, condition, line_number)
     VALUES ($1,$2,25,'damaged_return_vendor'::rma_condition,1) ON CONFLICT (rma_id, line_number) DO NOTHING`,
    [rmaId, pBySku['ING-001']]
  );
  log('rma_requests (open)', 1);

  // ── Vendor Claim: open, W2, VEND-001 ──
  await q(
    `INSERT INTO vendor_claims (vendor_id, warehouse_id, status, claim_amount, resolution_type, description, created_by)
     VALUES ($1,$2,'open'::claim_status,5500,'credit_note'::claim_resolution_type,'แป้งสาลี 25kg บรรจุภัณฑ์ชำรุด ขอ credit note',$3)
     ON CONFLICT DO NOTHING`,
    [vByCode['VEND-001'], wh['W2'], users.manager.id]
  );
  log('vendor_claims (open)', 1);

  // ── Cycle Count: counting, W2, 4 products ──
  let ccRows = await q(
    `INSERT INTO cycle_counts (warehouse_id, status, initiated_by, notes)
     VALUES ($1,'counting'::cycle_count_status,$2,'นับสต็อกประจำเดือน พ.ค. 2569')
     ON CONFLICT DO NOTHING RETURNING id`,
    [wh['W2'], users.manager.id]
  );
  if (!ccRows.length) ccRows = await q(`SELECT id FROM cycle_counts WHERE warehouse_id=$1 AND status='counting' LIMIT 1`,[wh['W2']]);
  const ccId = ccRows[0].id;

  const ccLines = [
    [pBySku['ING-001'], 500, 495, 1],
    [pBySku['ING-002'], 150, 152, 2],
    [pBySku['BRD-001'], 200, 198, 3],
    [pBySku['BRD-002'], 160, 160, 4],
  ];
  for (const [product_id, qty_system, qty_counted, ln] of ccLines) {
    await q(
      `INSERT INTO cycle_count_lines (cycle_count_id, product_id, qty_system, qty_counted, counted_by, counted_at, line_number)
       VALUES ($1,$2,$3,$4,$5,NOW(),$6) ON CONFLICT (cycle_count_id, line_number) DO NOTHING`,
      [ccId, product_id, qty_system, qty_counted, users.staff.id, ln]
    );
  }
  log('cycle_counts (counting)', 1);
}
async function seedBomAndRebate(users, wh, uoms) {
  const prods = await q(`SELECT id, sku FROM products WHERE sku IN ('BRD-001','ING-001','ING-002','ING-003','ING-004','PKG-001')`);
  const pBySku = Object.fromEntries(prods.map(p => [p.sku, p.id]));
  const vendors = await q(`SELECT id, code FROM vendors WHERE code='VEND-001'`);
  const vend1Id = vendors[0].id;

  // ── BOM: Sandwich Bread, batch 10 BOX ──
  let bomRows = await q(
    `INSERT INTO bom_headers (product_id, uom_id, output_qty, bom_type, version, created_by, notes)
     VALUES ($1,$2,10,'manufacturing'::bom_type,1,$3,'สูตรขนมปังแซนด์วิช 10 กล่อง')
     ON CONFLICT (product_id, version) DO NOTHING RETURNING id`,
    [pBySku['BRD-001'], uoms['BOX'], users.admin.id]
  );
  if (!bomRows.length) bomRows = await q(`SELECT id FROM bom_headers WHERE product_id=$1 AND version=1`,[pBySku['BRD-001']]);
  const bomId = bomRows[0].id;

  const bomLines = [
    [pBySku['ING-001'], 'KG',  5,    1],
    [pBySku['ING-002'], 'KG',  1,    2],
    [pBySku['ING-003'], 'KG',  0.5,  3],
    [pBySku['ING-004'], 'KG',  0.05, 4],
    [pBySku['PKG-001'], 'BOX', 10,   5],
  ];
  for (const [component_id, uomCode, qty_required, ln] of bomLines) {
    await q(
      `INSERT INTO bom_lines (bom_id, line_number, component_id, uom_id, qty_required, scrap_pct)
       VALUES ($1,$2,$3,$4,$5,2) ON CONFLICT (bom_id, line_number) DO NOTHING`,
      [bomId, ln, component_id, uoms[uomCode], qty_required]
    );
  }
  log('bom_headers + bom_lines', 1);

  // ── Rebate contract: VEND-001, monthly, 2 tiers ──
  const rcGuard = await q(
    `SELECT id FROM vendor_rebate_contracts WHERE vendor_id=$1 AND threshold_amount=50000 LIMIT 1`,
    [vend1Id]
  );
  if (!rcGuard.length) {
    // Tier 1: ≥50,000 → 2%
    await q(
      `INSERT INTO vendor_rebate_contracts (vendor_id, threshold_amount, rebate_rate, period, valid_from, valid_to)
       VALUES ($1,50000,2.00,'monthly'::rebate_period_type,'2026-01-01','2026-12-31')
       ON CONFLICT DO NOTHING`,
      [vend1Id]
    );
    // Tier 2: ≥100,000 → 3.5%
    await q(
      `INSERT INTO vendor_rebate_contracts (vendor_id, threshold_amount, rebate_rate, period, valid_from, valid_to)
       VALUES ($1,100000,3.50,'monthly'::rebate_period_type,'2026-01-01','2026-12-31')
       ON CONFLICT DO NOTHING`,
      [vend1Id]
    );
  }
  log('vendor_rebate_contracts', rcGuard.length ? 0 : 2);

  // Seed a pending accrual for current month
  const contractRows = await q(`SELECT id FROM vendor_rebate_contracts WHERE vendor_id=$1 AND threshold_amount=50000 LIMIT 1`,[vend1Id]);
  if (contractRows.length) {
    const periodLabel = `2026-M${String(new Date().getMonth() + 1).padStart(2,'0')}`;
    await q(
      `INSERT INTO vendor_rebate_accruals (vendor_id, contract_id, period_label, eligible_purchases, accrued_rebate, status)
       VALUES ($1,$2,$3,75000,1500,'pending'::rebate_accrual_status)
       ON CONFLICT (vendor_id, contract_id, period_label) DO NOTHING`,
      [vend1Id, contractRows[0].id, periodLabel]
    );
    log('vendor_rebate_accruals (pending)', 1);
  }
}

async function main() {
  console.log('🌱 Starting mock data seed...\n');
  try {
    await ensureUsers();
    const users = await getUsers();
    const wh = await getWarehouses();
    const uoms = await getUoms();
    const accounts = await getAccounts();
    await seedCategories(users, wh, uoms);
    await seedProducts(users, wh, uoms);
    await seedVendors(users, wh, uoms);
    await seedCustomers(users, wh, uoms);
    await seedPricingAndMembers(users, wh, uoms);
    await seedStock(users, wh, uoms);
    await seedPurchaseFlow(users, wh, uoms);
    await seedStockedGrnsAndInvoices(users, wh, uoms);
    await seedSalesFlow(users, wh, uoms);
    await seedPosSession(users, wh, uoms);
    await seedHR(users, wh, uoms);
    await seedAccounting(users, wh, uoms, accounts);
    await seedMisc(users, wh, uoms);
    await seedBomAndRebate(users, wh, uoms);
    console.log('\n✅ Seed complete.');
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
