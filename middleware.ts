import { NextRequest, NextResponse } from 'next/server';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'DELETE', 'PUT']);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  const needsAuth =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/upload') ||
    (pathname.startsWith('/api/') && WRITE_METHODS.has(method));

  if (!needsAuth) return NextResponse.next();

  const secret = process.env.ADMIN_SECRET;

  // No secret configured — block in production, allow in dev
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('ADMIN_SECRET not configured', { status: 503 });
    }
    return NextResponse.next();
  }

  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const password = decoded.slice(decoded.indexOf(':') + 1);
      if (password === secret) return NextResponse.next();
    } catch {}
  }

  return new NextResponse('Staff only', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Clearance Shop Staff"' },
  });
}

export const config = {
  matcher: ['/admin/:path*', '/upload/:path*', '/api/:path*'],
};
