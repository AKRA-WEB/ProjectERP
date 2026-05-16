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

  if (!isAuthenticated && (isAppPage || isApiPage)) {
    if (isApiPage) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL('/app/menu', req.url));
  }

  if (isAppPage && pathname.startsWith('/app/admin')) {
    const u = req.auth?.user as unknown as { role?: string };
    if (u?.role !== 'admin') {
      return NextResponse.redirect(new URL('/app/menu', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
