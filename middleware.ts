import { NextRequest, NextResponse } from 'next/server';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'DELETE', 'PUT']);

function enforceAdminAuth(req: NextRequest): NextResponse {
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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // Seller self-service routes (singular "seller") do their own per-request
  // token auth inside the handler — never via ADMIN_SECRET.
  if (pathname.startsWith('/api/seller/')) return NextResponse.next();

  // /api/sellers (plural — admin-facing collection) has inverted auth vs.
  // every other /api/* route: POST (public signup) must stay open, GET
  // (admin pending-queue, contains bearer tokens) must require admin auth.
  // Exact match only — /api/sellers/[id] (approve/reject) must fall through
  // to the normal WRITE_METHODS rule below, not this branch, or it would
  // accidentally become unauthenticated.
  if (pathname === '/api/sellers') {
    return method === 'GET' ? enforceAdminAuth(req) : NextResponse.next();
  }

  const needsAuth =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/upload') ||
    (pathname.startsWith('/api/') && WRITE_METHODS.has(method));

  if (!needsAuth) return NextResponse.next();

  return enforceAdminAuth(req);
}

export const config = {
  matcher: ['/admin/:path*', '/upload/:path*', '/api/:path*'],
};
