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
