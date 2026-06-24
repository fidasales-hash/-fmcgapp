import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { processProductImage } from '@/lib/imageProcess';
import { categorize } from '@/lib/categorize';
import { getAllProducts, insertProduct, getProductByBarcode } from '@/lib/db';
import sharp from 'sharp';

// Web images: centre on same 1200×1200 white canvas as staff photos, but never upscale
async function processWebImage(buf: Buffer): Promise<Buffer> {
  const layer = await sharp(buf)
    .resize(1100, 1100, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  return sharp({ create: { width: 1200, height: 1200, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: layer, gravity: 'centre' }])
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

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
    const photo3 = formData.get('photo3') as File | null;
    const name = (formData.get('name') as string | null)?.trim() ?? '';
    const size = (formData.get('size') as string | null)?.trim() ?? '';
    const bestBefore = (formData.get('bestBefore') as string | null) ?? '';
    const notes = (formData.get('notes') as string | null)?.trim() ?? '';
    const price = parseFloat((formData.get('price') as string | null) ?? '0') || 0;
    const marketPrice = parseFloat((formData.get('marketPrice') as string | null) ?? '0') || 0;
    const category = (formData.get('category') as string | null)?.trim() || categorize(name);
    const barcode = (formData.get('barcode') as string | null)?.trim() ?? '';
    const kosher = formData.get('kosher') === 'true';
    const halal = formData.get('halal') === 'true';
    const vegan = formData.get('vegan') === 'true';

    const photo1Url = (formData.get('photo1Url') as string | null) ?? '';
    const photo2Url = (formData.get('photo2Url') as string | null) ?? '';
    const photo3Url = (formData.get('photo3Url') as string | null) ?? '';

    if (!photo && !photo1Url) return NextResponse.json({ error: 'Photo required' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Product name required' }, { status: 400 });
    if (barcode) {
      const existing = await getProductByBarcode(barcode);
      if (existing) return NextResponse.json({ error: `Barcode already exists — "${existing.name}" is already in the store.` }, { status: 409 });
    }

    const id = Date.now().toString();

    // Process photo 1 — from URL or file upload
    let buf1: Buffer;
    if (photo1Url) {
      const r = await fetch(photo1Url);
      if (!r.ok) return NextResponse.json({ error: 'Failed to fetch selected image' }, { status: 400 });
      buf1 = Buffer.from(await r.arrayBuffer());
    } else {
      buf1 = Buffer.from(await photo!.arrayBuffer());
    }
    const processed1 = photo1Url ? await processWebImage(buf1) : await processProductImage(buf1);
    const { url: photoUrl } = await put(`products/${id}.jpg`, processed1, {
      access: 'public', contentType: 'image/jpeg', addRandomSuffix: false,
    });

    // Process photo 2 — from URL or file upload (optional)
    let photoUrl2 = '';
    if (photo2Url) {
      const r = await fetch(photo2Url);
      if (r.ok) {
        const processed2 = await processWebImage(Buffer.from(await r.arrayBuffer()));
        const { url } = await put(`products/${id}_2.jpg`, processed2, {
          access: 'public', contentType: 'image/jpeg', addRandomSuffix: false,
        });
        photoUrl2 = url;
      }
    } else if (photo2 && photo2.size > 0) {
      const processed2 = await processProductImage(Buffer.from(await photo2.arrayBuffer()));
      const { url } = await put(`products/${id}_2.jpg`, processed2, {
        access: 'public', contentType: 'image/jpeg', addRandomSuffix: false,
      });
      photoUrl2 = url;
    }

    // Process photo 3 (optional)
    let photoUrl3 = '';
    if (photo3Url) {
      const r = await fetch(photo3Url);
      if (r.ok) {
        const processed3 = await processWebImage(Buffer.from(await r.arrayBuffer()));
        const { url } = await put(`products/${id}_3.jpg`, processed3, {
          access: 'public', contentType: 'image/jpeg', addRandomSuffix: false,
        });
        photoUrl3 = url;
      }
    } else if (photo3 && photo3.size > 0) {
      const processed3 = await processProductImage(Buffer.from(await photo3.arrayBuffer()));
      const { url } = await put(`products/${id}_3.jpg`, processed3, {
        access: 'public', contentType: 'image/jpeg', addRandomSuffix: false,
      });
      photoUrl3 = url;
    }

    const product = {
      id, name, size, bestBefore,
      category,
      notes, price, marketPrice, photoUrl, photoUrl2, photoUrl3,
      barcode, kosher, halal, vegan,
      addedAt: new Date().toISOString(),
    };

    await insertProduct(product);
    return NextResponse.json({ success: true, product });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
