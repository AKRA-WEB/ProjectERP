import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { CreateProductUomSchema } from '@/lib/validations/bom';
import { SessionUser } from '@/lib/authz';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const { id } = await params;

  const rows = await query(`
    SELECT 
      pu.*,
      uom.code AS uom_code,
      uom.name_th AS uom_name_th,
      uom.name_en AS uom_name_en
    FROM product_uom pu
    JOIN units_of_measure uom ON uom.id = pu.uom_id
    WHERE pu.product_id = $1
    ORDER BY pu.created_at ASC
  `, [id]);

  return apiSuccess(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const user = session.user as unknown as SessionUser;
  const { id } = await params;

  if (!['admin', 'manager'].includes(user.role)) {
    return apiError('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const result = CreateProductUomSchema.safeParse(body);
    if (!result.success) {
      return apiError(result.error.errors[0].message, 400);
    }
    const d = result.data;

    const { rows } = await query(`
      INSERT INTO product_uom (product_id, uom_id, conversion_factor, uom_type)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [id, d.uom_id, d.conversion_factor, d.uom_type]);

    return apiSuccess(rows[0], 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to add product UOM';
    if (msg.includes('unique constraint')) return apiError('This UOM is already defined for this product', 400);
    return apiError(msg, 500);
  }
}
