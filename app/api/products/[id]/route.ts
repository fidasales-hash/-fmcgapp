import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { deleteProduct, updateProduct, getProductByBarcode } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.barcode) {
      const existing = await getProductByBarcode(body.barcode);
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: `Barcode already used by "${existing.name}"` }, { status: 409 });
      }
    }
    await updateProduct(id, body);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await deleteProduct(id);
    if (result) {
      const urls = [result.photoUrl, result.photoUrl2].filter(Boolean);
      if (urls.length) await del(urls);
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
