import { NextRequest, NextResponse } from 'next/server';
import { setProductQuantity } from '@/lib/db';

// Staff-only: PATCH is covered by middleware's ADMIN_SECRET check for /api/* writes.
// Body: { quantity: number | null } — null clears it ("not entered").
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const q = body?.quantity;
    if (q !== null && !(Number.isInteger(q) && q >= 0)) {
      return NextResponse.json({ error: 'quantity must be a whole number 0 or more, or null' }, { status: 400 });
    }
    const ok = await setProductQuantity(id, q);
    if (!ok) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ success: true, quantity: q });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
