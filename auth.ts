import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { queryOne } from '@/lib/db/client';
import bcrypt from 'bcryptjs';
import type { User } from '@/types';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = z.object({
          email: z.string().email(),
          password: z.string().min(1),
        }).safeParse(credentials);

        if (!parsed.success) return null;

        const user = await queryOne<User & { password_hash: string }>(
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

        return {
          id: user.id,
          email: user.email,
          name: user.name_en,
          role: user.role,
          assignedWarehouseIds: (user as any).assigned_warehouse_ids ?? [],
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.assignedWarehouseIds = (user as any).assignedWarehouseIds;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      (session.user as any).role = token.role;
      (session.user as any).assignedWarehouseIds = token.assignedWarehouseIds;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,
  },
});
