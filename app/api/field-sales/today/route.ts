import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { SessionUser } from '@/types';
import { apiSuccess, apiError } from '@/lib/api-response';
import { query } from '@/lib/db/client';

interface JoinedCheckin {
  id: string;
  agent_user_id: string;
  agent_name_th?: string;
  agent_name_en?: string;
  customer_id: string;
  customer_code: string;
  customer_name_th: string;
  customer_name_en: string;
  gps_lat: number | string;
  gps_lng: number | string;
  accuracy_m: number;
  checked_in_at: string;
  ended_at: string | null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError('Unauthorized', 401);
  const u = session.user as unknown as SessionUser;

  // Assert admin or manager role
  if (u.role !== 'admin' && u.role !== 'manager') {
    return apiError('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

  try {
    const rows = await query<JoinedCheckin>(
      `SELECT c.*, 
              u.name_th AS agent_name_th, 
              u.name_en AS agent_name_en,
              cust.code AS customer_code, 
              cust.name_th AS customer_name_th, 
              cust.name_en AS customer_name_en
       FROM field_sales_checkins c
       JOIN users u ON c.agent_user_id = u.id
       JOIN customers cust ON c.customer_id = cust.id
       WHERE c.checked_in_at::date = $1::date
       ORDER BY c.checked_in_at DESC`,
      [dateStr]
    );

    return apiSuccess(rows);
  } catch (err) {
    console.error('Failed to fetch today check-ins:', err);
    return apiError('Failed to fetch check-ins', 500);
  }
}
