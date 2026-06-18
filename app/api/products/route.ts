import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { processProductImage } from '@/lib/imageProcess';
import { categorize } from '@/lib/categorize';
import { getAllProducts, insertProduct } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const products = await getAllProducts();
    return NextResponse.json(products);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const photo = formData.get('photo') as File | null;
    const photo2 = formData.get('photo2') as File | null;
    const name = (formData.get('name') as string | null)?.trim() ?? '';
    const size = (formData.get('size') as string | null)?.trim() ?? '';
    const bestBefore = (formData.get('bestBefore') as string | null) ?? '';
    const notes = (formData.get('notes') as string | null)?.trim() ?? '';
    const price = parseFloat((formData.get('price') as string | null) ?? '0') || 0;
    const category = (formData.get('category') as string | null)?.trim() || categorize(name);

    if (!photo) return NextResponse.json({ error: 'Photo required' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Product name required' }, { status: 400 });
    if (!bestBefore) return NextResponse.json({ error: 'Best before date required' }, { status: 400 });

    const id = Date.now().toString();

    // Process photo 1 (required)
    const processed1 = await processProductImage(Buffer.from(await photo.arrayBuffer()));
    const { url: photoUrl } = await put(`products/${id}.jpg`, processed1, {
      access: 'public', contentType: 'image/jpeg', addRandomSuffix: false,
    });

    // Process photo 2 (optional)
    let photoUrl2 = '';
    if (photo2 && photo2.size > 0) {
      const processed2 = await processProductImage(Buffer.from(await photo2.arrayBuffer()));
      const { url } = await put(`products/${id}_2.jpg`, processed2, {
        access: 'public', contentType: 'image/jpeg', addRandomSuffix: false,
      });
      photoUrl2 = url;
    }

    const product = {
      id, name, size, bestBefore,
      category,
      notes, price, photoUrl, photoUrl2,
      addedAt: new Date().toISOString(),
    };

    await insertProduct(product);
    return NextResponse.json({ success: true, product });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
