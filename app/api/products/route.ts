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
    const name = (formData.get('name') as string | null)?.trim() ?? '';
    const size = (formData.get('size') as string | null)?.trim() ?? '';
    const bestBefore = (formData.get('bestBefore') as string | null) ?? '';
    const notes = (formData.get('notes') as string | null)?.trim() ?? '';

    if (!photo) return NextResponse.json({ error: 'Photo required' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Product name required' }, { status: 400 });
    if (!bestBefore) return NextResponse.json({ error: 'Best before date required' }, { status: 400 });

    const raw = Buffer.from(await photo.arrayBuffer());
    const processed = await processProductImage(raw);

    const id = Date.now().toString();
    const { url } = await put(`products/${id}.jpg`, processed, {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: false,
    });

    const product = {
      id,
      name,
      size,
      bestBefore,
      category: categorize(name),
      notes,
      photoUrl: url,
      addedAt: new Date().toISOString(),
    };

    await insertProduct(product);
    return NextResponse.json({ success: true, product });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
