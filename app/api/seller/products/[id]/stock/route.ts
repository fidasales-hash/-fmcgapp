import { NextRequest, NextResponse } from 'next/server';
import { setProductStock } from '@/lib/db';
import { requireApprovedSeller } from '@/lib/sellerAuth';

// Sellers can mark only their own products in stock / sold out.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const seller = await requireApprovedSeller(req);
  if (seller instanceof NextResponse) return seller;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (typeof body?.inStock !== 'boolean') {
      return NextResponse.json({ error: 'inStock must be true or false' }, { status: 400 });
    }
    const ok = await setProductStock(id, body.inStock, seller.id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, inStock: body.inStock });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
