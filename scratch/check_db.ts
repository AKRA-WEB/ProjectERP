import { query } from '../lib/db/client';

async function main() {
  try {
    console.log("=== WAREHOUSES ===");
    const warehouses = await query("SELECT id, code, name_th, name_en, business_unit_id FROM warehouses ORDER BY code");
    console.log(JSON.stringify(warehouses, null, 2));

    console.log("\n=== WAREHOUSE ZONES ===");
    const zones = await query("SELECT id, warehouse_id, code, thermal_type FROM warehouse_zones ORDER BY warehouse_id, code");
    console.log(JSON.stringify(zones, null, 2));

    console.log("\n=== VIRTUAL LOCATIONS ===");
    const virtuals = await query("SELECT id, code, purpose, is_sellable, visible_channels FROM virtual_locations ORDER BY code");
    console.log(JSON.stringify(virtuals, null, 2));

    console.log("\n=== BUSINESS UNITS ===");
    const bus = await query("SELECT id, code, name_th, name_en FROM business_units ORDER BY code");
    console.log(JSON.stringify(bus, null, 2));

  } catch (error) {
    console.error("Error querying database:", error);
  }
}

main();
