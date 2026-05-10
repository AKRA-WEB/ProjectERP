import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  providers: [], // Providers added in auth.ts (server-side only)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.assignedWarehouseIds = (user as any).assignedWarehouseIds;
        token.permissions = (user as any).permissions;
        token.employeeId = (user as any).employeeId;
        token.position = (user as any).position;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).assignedWarehouseIds = token.assignedWarehouseIds;
        (session.user as any).permissions = token.permissions;
        (session.user as any).employeeId = token.employeeId;
        (session.user as any).position = token.position;
      }
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
} satisfies NextAuthConfig;
