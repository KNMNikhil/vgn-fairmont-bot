import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  
  // 1. Exclude public and backend-to-backend API routes
  if (
    url.pathname.startsWith('/api/webhook') || 
    url.pathname.startsWith('/api/cron') ||
    url.pathname.startsWith('/api/media') // Safe to allow public access to proxy media
  ) {
    return NextResponse.next();
  }

  // 2. Fetch configured credentials
  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  // If no credentials configured, bypass (fail-open for ease of setup, though fail-closed is safer. 
  // Let's fail-closed so they MUST configure it to see the dashboard.)
  if (!validUsername || !validPassword) {
    return new NextResponse('Configuration Error: Admin credentials are not set in environment variables.', { status: 500 });
  }

  // 3. Extract and verify Basic Auth
  const basicAuth = req.headers.get('authorization');
  
  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    if (user === validUsername && pwd === validPassword) {
      return NextResponse.next();
    }
  }

  // 4. Request Authentication
  url.pathname = '/api/auth';
  
  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}
