import { NextRequest, NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { processProductImage } from '@/lib/imageProcess';
import { getProductOwnership, updateProduct, deleteProduct } from '@/lib/db';
import { requireApprovedSeller } from '@/lib/sellerAuth';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Seller v1 edit form is intentionally lighter than the staff admin form:
// name/size/category/notes/price/marketPrice + a single optional photo replace.
// No barcode/multi-photo/dietary-flags/bestBefore — those stay staff-only for now.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const seller = await requireApprovedSeller(req);
  if (seller instanceof NextResponse) return seller;

  try {
    const { id } = await params;

    // Ownership must be verified before any Blob mutation — deleting/replacing
    // a photo can't be allowed to run before we know this seller owns the row,
    // since updateProduct's ownership-scoped WHERE clause only protects the
    // database row, not a blob delete that would happen as a separate step.
    const owned = await getProductOwnership(id);
    if (!owned || owned.sellerId !== seller.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const name = (formData.get('name') as string | null)?.trim() ?? '';
    const size = (formData.get('size') as string | null)?.trim() ?? '';
    const category = (formData.get('category') as string | null)?.trim() ?? 'Other';
    const notes = (formData.get('notes') as string | null)?.trim() ?? '';
    const price = parseFloat(formData.get('price') as string) || 0;
    const marketPrice = parseFloat(formData.get('marketPrice') as string) || 0;
    const photo = formData.get('photo') as File | null;

    if (!name) return NextResponse.json({ error: 'Product name required' }, { status: 400 });

    let photoUrl: string | undefined;
    if (photo && photo.size > 0) {
      if (owned.photoUrl) await del(owned.photoUrl);
      const processed = await processProductImage(Buffer.from(await photo.arrayBuffer()));
      const { url } = await put(`products/${id}_${Date.now()}.jpg`, processed, {
        access: 'public', contentType: 'image/jpeg', addRandomSuffix: false,
      });
      photoUrl = url;
    }

    const ok = await updateProduct(id, {
      name, size, category, notes, price, marketPrice,
      ...(photoUrl !== undefined ? { photoUrl, photoUrl2: owned.photoUrl2, photoUrl3: owned.photoUrl3 } : {}),
    }, seller.id);

    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, photoUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const seller = await requireApprovedSeller(req);
  if (seller instanceof NextResponse) return seller;

  try {
    const { id } = await params;
    // deleteProduct's DELETE...WHERE seller_id=...RETURNING is atomic: blob
    // cleanup below only runs if a row (owned by this seller) actually matched.
    const result = await deleteProduct(id, seller.id);
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const urls = [result.photoUrl, result.photoUrl2, result.photoUrl3].filter(Boolean);
    if (urls.length) await del(urls);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
