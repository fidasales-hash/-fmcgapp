import { NextRequest, NextResponse } from 'next/server';
import { createSeller, getAllSellers } from '@/lib/db';

export const runtime = 'nodejs';

// Public signup — gated open by middleware.ts (POST /api/sellers is the one
// exception to the admin-write-methods rule). Never return the seller's
// token here: it only ever reaches them via the admin manually sharing the
// /seller/<token> link after approval.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const businessName = String(body.businessName ?? '').trim();
    const contactName = String(body.contactName ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const email = String(body.email ?? '').trim();

    if (!businessName) return NextResponse.json({ error: 'Business name required' }, { status: 400 });
    if (!phone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

    await createSeller({ businessName, contactName, phone, email });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Admin-only — gated by middleware.ts (GET /api/sellers requires ADMIN_SECRET,
// the one inversion from this app's normal public-GET pattern). No in-handler
// auth check: this codebase's existing routes are middleware-only for auth.
export async function GET() {
  try {
    const sellers = await getAllSellers();
    return NextResponse.json(sellers);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load sellers' }, { status: 500 });
  }
}
