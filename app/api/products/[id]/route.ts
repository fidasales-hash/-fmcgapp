import { NextRequest, NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { processProductImage } from '@/lib/imageProcess';
import { deleteProduct, updateProduct, getProductByBarcode, getProductPhotoUrls } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await req.formData();

    const name = (formData.get('name') as string)?.trim() ?? '';
    const size = (formData.get('size') as string)?.trim() ?? '';
    const bestBefore = (formData.get('bestBefore') as string) ?? '';
    const category = (formData.get('category') as string)?.trim() ?? 'Other';
    const notes = (formData.get('notes') as string)?.trim() ?? '';
    const price = parseFloat(formData.get('price') as string) || 0;
    const marketPrice = parseFloat(formData.get('marketPrice') as string) || 0;
    const barcode = (formData.get('barcode') as string)?.trim() ?? '';
    const kosher = formData.get('kosher') === 'true';
    const halal = formData.get('halal') === 'true';
    const vegan = formData.get('vegan') === 'true';
    const photo1 = formData.get('photo1') as File | null;
    const photo2 = formData.get('photo2') as File | null;
    const photo3 = formData.get('photo3') as File | null;
    const clear2 = formData.get('clear2') === 'true';
    const clear3 = formData.get('clear3') === 'true';

    if (barcode) {
      const existing = await getProductByBarcode(barcode);
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: `Barcode already used by "${existing.name}"` }, { status: 409 });
      }
    }

    const hasPhotoChanges =
      (photo1 && photo1.size > 0) ||
      (photo2 && photo2.size > 0) ||
      (photo3 && photo3.size > 0) ||
      clear2 || clear3;

    if (!hasPhotoChanges) {
      await updateProduct(id, { name, size, bestBefore, category, notes, price, marketPrice, barcode, kosher, halal, vegan });
      return NextResponse.json({ success: true });
    }

    const existing = await getProductPhotoUrls(id);
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    let photoUrl = existing.photoUrl;
    let photoUrl2 = existing.photoUrl2;
    let photoUrl3 = existing.photoUrl3;

    const ts = Date.now();

    if (photo1 && photo1.size > 0) {
      if (existing.photoUrl) await del(existing.photoUrl);
      const processed = await processProductImage(Buffer.from(await photo1.arrayBuffer()));
      const { url } = await put(`products/${id}_${ts}.jpg`, processed, {
        access: 'public', contentType: 'image/jpeg', addRandomSuffix: false,
      });
      photoUrl = url;
    }

    if (photo2 && photo2.size > 0) {
      if (existing.photoUrl2) await del(existing.photoUrl2);
      const processed = await processProductImage(Buffer.from(await photo2.arrayBuffer()));
      const { url } = await put(`products/${id}_2_${ts}.jpg`, processed, {
        access: 'public', contentType: 'image/jpeg', addRandomSuffix: false,
      });
      photoUrl2 = url;
    } else if (clear2 && existing.photoUrl2) {
      await del(existing.photoUrl2);
      photoUrl2 = '';
    }

    if (photo3 && photo3.size > 0) {
      if (existing.photoUrl3) await del(existing.photoUrl3);
      const processed = await processProductImage(Buffer.from(await photo3.arrayBuffer()));
      const { url } = await put(`products/${id}_3_${ts}.jpg`, processed, {
        access: 'public', contentType: 'image/jpeg', addRandomSuffix: false,
      });
      photoUrl3 = url;
    } else if (clear3 && existing.photoUrl3) {
      await del(existing.photoUrl3);
      photoUrl3 = '';
    }

    await updateProduct(id, { name, size, bestBefore, category, notes, price, marketPrice, barcode, kosher, halal, vegan, photoUrl, photoUrl2, photoUrl3 });
    return NextResponse.json({ success: true, photoUrl, photoUrl2, photoUrl3 });
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
      const urls = [result.photoUrl, result.photoUrl2, result.photoUrl3].filter(Boolean);
      if (urls.length) await del(urls);
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
