import { query } from '@/lib/db/client';

export interface WarehouseRow {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  address_th: string | null;
  address_en: string | null;
  is_active: boolean;
  user_count: number;
}

export async function getWarehouses(): Promise<WarehouseRow[]> {
  return query<WarehouseRow>(
    `SELECT w.*, COUNT(uwa.user_id)::int AS user_count
     FROM warehouses w
     LEFT JOIN user_warehouse_assignments uwa ON uwa.warehouse_id = w.id
     WHERE w.code NOT LIKE 'V-%'
     GROUP BY w.id
     ORDER BY w.code`
  );
}
