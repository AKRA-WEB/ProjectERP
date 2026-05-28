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

async function seedVendors(users, wh, uoms) { log('vendors (stub)', 0); }
async function seedCustomers(users, wh, uoms) { log('customers (stub)', 0); }
async function seedPricingAndMembers(users, wh, uoms) { log('pricing (stub)', 0); }
async function seedStock(users, wh, uoms) { log('stock (stub)', 0); }
async function seedPurchaseFlow(users, wh, uoms) { log('purchase_flow (stub)', 0); }
async function seedSalesFlow(users, wh, uoms) { log('sales_flow (stub)', 0); }
async function seedPosSession(users, wh, uoms) { log('pos_session (stub)', 0); }
async function seedHR(users, wh, uoms) { log('hr (stub)', 0); }
async function seedAccounting(users, wh, uoms, accounts) { log('accounting (stub)', 0); }
async function seedMisc(users, wh, uoms) { log('misc (stub)', 0); }
async function seedBomAndRebate(users, wh, uoms) { log('bom_and_rebate (stub)', 0); }

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
