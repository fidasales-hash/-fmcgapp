import { NextRequest, NextResponse } from 'next/server';
import { setProductStock } from '@/lib/db';

// Staff-only: PATCH is covered by middleware's ADMIN_SECRET check for /api/* writes.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (typeof body?.inStock !== 'boolean') {
      return NextResponse.json({ error: 'inStock must be true or false' }, { status: 400 });
    }
    const ok = await setProductStock(id, body.inStock);
    if (!ok) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ success: true, inStock: body.inStock });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
