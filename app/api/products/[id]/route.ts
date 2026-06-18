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
