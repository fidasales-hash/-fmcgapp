import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { deleteProduct } from '@/lib/db';

export const runtime = 'nodejs';

const PIN = process.env.UPLOAD_PIN ?? '';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get('authorization');
  if (!PIN || auth !== `Bearer ${PIN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
