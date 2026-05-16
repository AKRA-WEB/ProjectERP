import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isAuthenticated = !!req.auth;
  const isAuthPage = pathname.startsWith('/login');
  const isAppPage = pathname.startsWith('/app');
  const isApiPage = pathname.startsWith('/api') && !pathname.startsWith('/api/auth');

  // Redirect unauthenticated users to login
  if (!isAuthenticated && (isAppPage || isApiPage)) {
    if (isApiPage) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL('/app/menu', req.url));
  }

  // Basic RBAC for admin pages
  if (isAppPage && pathname.startsWith('/app/admin')) {
    const userRole = (req.auth?.user as any)?.role;
    if (userRole !== 'admin') {
      return NextResponse.redirect(new URL('/app/menu', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
