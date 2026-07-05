import { NextRequest, NextResponse } from 'next/server';
import { updateSellerStatus } from '@/lib/db';

export const runtime = 'nodejs';

// Admin-only — already covered by middleware.ts's unchanged WRITE_METHODS
// branch (PATCH under /api/, and this path doesn't match the /api/sellers
// exact-match carve-in since it has a sub-path).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const status = body.status;
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'status must be "approved" or "rejected"' }, { status: 400 });
    }
    await updateSellerStatus(id, status);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
