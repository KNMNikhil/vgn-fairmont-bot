import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  // Only apply Basic Auth in production (optional) or if ADMIN_PASSWORD is set
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    // If no password is set, we bypass auth (for local development before setting it up)
    return NextResponse.next();
  }

  const basicAuth = req.headers.get('authorization');

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    // We accept any username as long as the password matches ADMIN_PASSWORD
    if (pwd === adminPassword) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Dashboard"',
    },
  });
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Protect the root dashboard: '/'
     * Protect the admin API endpoints: '/api/conversations/:path*'
     * Do NOT protect webhook: '/api/webhook'
     * Do NOT protect cron: '/api/cron/:path*'
     * Do NOT protect static files, Next.js internals, or public images
     */
    '/',
    '/api/conversations/:path*',
  ],
};
