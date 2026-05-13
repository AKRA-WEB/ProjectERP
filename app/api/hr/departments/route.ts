import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db/client';
import { apiSuccess, apiError } from '@/lib/api-response';
import { z } from 'zod';
import type { SessionUser } from '@/lib/authz';

const CreateSchema = z.object({
  code: z.string().min(1).max(50),
  name_th: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  parent_id: z.string().uuid().nullable().optional(),
  manager_id: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);

  const rows = await query<{
    id: string; code: string; name_th: string; name_en: string;
    parent_id: string | null; manager_id: string | null;
    manager_name_th: string | null; manager_name_en: string | null;
    is_active: boolean; created_at: string; updated_at: string;
  }>(`
    SELECT d.*, u.name_th AS manager_name_th, u.name_en AS manager_name_en
    FROM departments d
    LEFT JOIN users u ON u.id = d.manager_id
    WHERE d.is_active = TRUE
    ORDER BY d.name_th
  `, []);

  return apiSuccess(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;
  if (!['admin', 'manager'].includes(u.role)) return apiError('Forbidden', 403);

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);
  const d = parsed.data;

  const rows = await query<{ id: string }>(`
    INSERT INTO departments (code, name_th, name_en, parent_id, manager_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [d.code, d.name_th, d.name_en, d.parent_id ?? null, d.manager_id ?? null]);

  return apiSuccess({ id: rows[0].id }, 201);
}
