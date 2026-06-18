import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { deleteProduct } from '@/lib/db';

export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const photoUrl = await deleteProduct(id);
    if (photoUrl) await del(photoUrl);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
