import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { deleteProduct, updateProduct, getProductByBarcode, getProductById } from '@/lib/db';
import { processProductImage } from '@/lib/imageProcess';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const name        = (formData.get('name') as string | null) ?? '';
      const size        = (formData.get('size') as string | null) ?? '';
      const bestBefore  = (formData.get('bestBefore') as string | null) ?? '';
      const category    = (formData.get('category') as string | null) ?? 'Other';
      const notes       = (formData.get('notes') as string | null) ?? '';
      const price       = parseFloat((formData.get('price') as string | null) ?? '0') || 0;
      const marketPrice = parseFloat((formData.get('marketPrice') as string | null) ?? '0') || 0;
      const barcode     = ((formData.get('barcode') as string | null) ?? '').trim();

      if (barcode) {
        const dup = await getProductByBarcode(barcode);
        if (dup && dup.id !== id) {
          return NextResponse.json({ error: `Barcode already used by "${dup.name}"` }, { status: 409 });
        }
      }

      const current = await getProductById(id);
      const photo1 = formData.get('photo1') as File | null;
      const photo2 = formData.get('photo2') as File | null;
      const photo3 = formData.get('photo3') as File | null;

      async function replacePhoto(file: File, slot: string, oldUrl: string): Promise<string> {
        const buf = Buffer.from(await file.arrayBuffer());
        const processed = await processProductImage(buf);
        const { url } = await put(`products/${id}${slot}.jpg`, processed, {
          access: 'public', contentType: 'image/jpeg', addRandomSuffix: false,
        });
        if (oldUrl && oldUrl !== url) { try { await del(oldUrl); } catch { /* ignore */ } }
        return url;
      }

      const photoUrl  = photo1 ? await replacePhoto(photo1, '',   current?.photoUrl  ?? '') : undefined;
      const photoUrl2 = photo2 ? await replacePhoto(photo2, '_2', current?.photoUrl2 ?? '') : undefined;
      const photoUrl3 = photo3 ? await replacePhoto(photo3, '_3', current?.photoUrl3 ?? '') : undefined;

      await updateProduct(id, { name, size, bestBefore, category, notes, price, marketPrice, barcode, photoUrl, photoUrl2, photoUrl3 });
      return NextResponse.json({ success: true });
    }

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
