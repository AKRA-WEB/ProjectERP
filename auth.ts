import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db/client';
import bcrypt from 'bcryptjs';
import type { User } from '@/types';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = z.object({
          email: z.string().email(),
          password: z.string().min(1),
        }).safeParse(credentials);

        if (!parsed.success) return null;

        const user = await queryOne<User & { password_hash: string, employee_id: string, position: string }>(
          `SELECT u.*, array_agg(uwa.warehouse_id) FILTER (WHERE uwa.warehouse_id IS NOT NULL) AS assigned_warehouse_ids
           FROM users u
           LEFT JOIN user_warehouse_assignments uwa ON uwa.user_id = u.id
           WHERE u.email = $1 AND u.is_active = TRUE
           GROUP BY u.id`,
          [parsed.data.email]
        );

        if (!user) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.password_hash);
        if (!valid) return null;

        const perms = await query<{ permission_id: string }>(
          `SELECT DISTINCT erp.permission_id
           FROM user_role_assignments ura
           JOIN employee_role_permissions erp ON erp.role_id = ura.role_id
           WHERE ura.user_id = $1`,
          [user.id]
        );

        return {
          id: user.id,
          email: user.email,
          name: user.name_en,
          role: user.role,
          assignedWarehouseIds: (user as any).assigned_warehouse_ids ?? [],
          permissions: perms.map((p) => p.permission_id),
          employeeId: user.employee_id ?? null,
          position: user.position ?? null,
        };
      },
    }),
  ],
});

