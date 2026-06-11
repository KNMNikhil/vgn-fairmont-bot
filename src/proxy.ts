import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  // Only apply Basic Auth in production (optional) or if ADMIN_PASSWORD is set
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'; // default to admin if they only set password
  
  if (!adminPassword) {
    // If no password is set, we bypass auth (for local development before setting it up)
    return NextResponse.next();
  }

  const basicAuth = req.headers.get('authorization');

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    // We accept the configured username and password
    if (user === adminUsername && pwd === adminPassword) {
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
     * Protect the admin API endpoints: '/api/conversations/:path*', '/api/analytics', '/api/whitelist'
     * Do NOT protect webhook: '/api/webhook'
     * Do NOT protect cron: '/api/cron/:path*'
     * Do NOT protect static files, Next.js internals, or public images
     */
    '/',
    '/api/conversations/:path*',
    '/api/analytics/:path*',
    '/api/whitelist/:path*',
  ],
};
