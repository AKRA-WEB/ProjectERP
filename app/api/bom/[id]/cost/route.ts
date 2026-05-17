import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { queryOne } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { id } = await params;

  // Single-level cost rollup (for current BOM only)
  // Logic: SUM(qty * unit_cost)
  // We use products table for unit_cost
  const result = await queryOne<{ total_cost: string | number }>(`
    SELECT SUM(bl.qty_required * p.unit_cost) AS total_cost
    FROM bom_lines bl
    JOIN products p ON p.id = bl.component_id
    WHERE bl.bom_id = $1
  `, [id]);

  return apiSuccess({ total_cost: Number(result?.total_cost ?? 0) });
}
