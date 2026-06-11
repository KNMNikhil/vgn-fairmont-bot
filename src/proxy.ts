import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const url = req.nextUrl;

  // 1. Always allow public/bot routes
  if (
    url.pathname.startsWith('/api/webhook') ||
    url.pathname.startsWith('/api/cron') ||
    url.pathname.startsWith('/api/media') ||
    url.pathname.startsWith('/api/auth') || // Allow the login API itself
    url.pathname.startsWith('/login')        // Allow the login page itself
  ) {
    return NextResponse.next();
  }

  // 2. Check for session cookie
  const session = req.cookies.get('admin_session');
  
  if (session?.value === 'authenticated') {
    return NextResponse.next();
  }

  // 3. Not authenticated — redirect to the custom login page
  const loginUrl = new URL('/login', req.url);
  return NextResponse.redirect(loginUrl);
}

// Match all paths
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
