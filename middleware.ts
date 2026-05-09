import { auth } from '@/auth';
import { NextResponse } from 'next/server';

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
    return NextResponse.redirect(new URL('/app/dashboard', req.url));
  }

  const role = (req.auth?.user as any)?.role;

  if (isAppPage && pathname.startsWith('/app/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/app/dashboard', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
