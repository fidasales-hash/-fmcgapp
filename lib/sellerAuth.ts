import { NextRequest, NextResponse } from 'next/server';
import { getSellerByToken } from '@/lib/db';
import type { Seller } from '@/lib/types';

// Single source of truth for "what counts as an active seller" so the two
// seller-scoped route files can't drift from each other (e.g. one checking
// status and the other forgetting). middleware.ts does not gate /api/seller/*
// at all — every handler under that prefix must call this first.
export async function requireApprovedSeller(req: NextRequest): Promise<Seller | NextResponse> {
  const token = req.headers.get('x-seller-token') ?? '';
  if (!token) {
    return NextResponse.json({ error: 'Missing seller token', status: 'invalid' }, { status: 401 });
  }

  const seller = await getSellerByToken(token);
  if (!seller) {
    return NextResponse.json({ error: 'Invalid seller link', status: 'invalid' }, { status: 401 });
  }

  if (seller.status !== 'approved') {
    return NextResponse.json({ error: `Seller application is ${seller.status}`, status: seller.status }, { status: 403 });
  }

  return seller;
}

// For endpoints shared between the staff and seller upload forms (AI label
// reading, barcode lookup, web image search) — accepts EITHER admin Basic
// Auth OR an approved seller token. These routes are exempted from
// middleware.ts's blanket admin gate specifically so this can run instead;
// they must never be reachable without passing one of these two checks.
export async function requireStaffOrSeller(
  req: NextRequest
): Promise<{ role: 'staff' } | { role: 'seller'; seller: Seller } | NextResponse> {
  const secret = process.env.ADMIN_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  if (secret && auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const password = decoded.slice(decoded.indexOf(':') + 1);
      if (password === secret) return { role: 'staff' };
    } catch {}
  }

  const result = await requireApprovedSeller(req);
  if (result instanceof NextResponse) return result;
  return { role: 'seller', seller: result };
}
