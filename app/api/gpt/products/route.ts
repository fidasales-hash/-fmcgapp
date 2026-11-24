import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { insertProduct } from '@/lib/db';
import { buildProductFromFormData } from '@/lib/productForm';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Called by the custom GPT ("Clearance Shop Lister") in ChatGPT.
// middleware.ts lets /api/gpt/products through without ADMIN_SECRET so this
// Bearer check (GPT_API_KEY) is the only gate — never remove it.

const CATEGORIES = [
  'Drinks', 'Tinned & Canned', 'Snacks & Confectionery', 'Bakery & Cereals', 'Home & Cleaning',
  'Health & Beauty', 'Baby & Toddler', 'Pet', 'Electronics', 'Other',
];
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

type FileRef = { name?: string; id?: string; mime_type?: string; download_link?: string };

function authorized(req: NextRequest): boolean {
  const key = process.env.GPT_API_KEY ?? '';
  if (key.length < 20) return false; // not configured, or too weak to trust
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const given = Buffer.from(auth.slice(7).trim());
  const expected = Buffer.from(key);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function downloadPhoto(ref: FileRef, index: number): Promise<File | { error: string }> {
  const link = ref.download_link ?? '';
  let url: URL;
  try { url = new URL(link); } catch { return { error: `Photo ${index + 1} has no valid download link` }; }
  if (url.protocol !== 'https:') return { error: `Photo ${index + 1} link must be https` };

  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) return { error: `Could not download photo ${index + 1} (${res.status})` };
  const type = res.headers.get('content-type') ?? ref.mime_type ?? '';
  if (!type.startsWith('image/')) return { error: `Photo ${index + 1} is not an image` };
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_PHOTO_BYTES) return { error: `Photo ${index + 1} is larger than 15 MB` };
  return new File([buf], ref.name || `photo${index + 1}.jpg`, { type });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 }); }

  const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string).trim() : '');
  const num = (k: string) => (typeof body[k] === 'number' ? (body[k] as number) : parseFloat(str(k)) || 0);
  const bool = (k: string) => body[k] === true || body[k] === 'true';

  const name = str('name');
  const price = num('price');
  const category = str('category');
  const bestBefore = str('bestBefore');
  const refs = Array.isArray(body.openaiFileIdRefs) ? (body.openaiFileIdRefs as FileRef[]).slice(0, 3) : [];

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!(price > 0)) return NextResponse.json({ error: 'price must be more than 0 — ask the user for the selling price' }, { status: 400 });
  if (category && !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: `category must be one of: ${CATEGORIES.join(', ')}` }, { status: 400 });
  }
  if (bestBefore && !/^\d{4}-\d{2}-\d{2}$/.test(bestBefore)) {
    return NextResponse.json({ error: 'bestBefore must be YYYY-MM-DD' }, { status: 400 });
  }
  if (refs.length === 0) return NextResponse.json({ error: 'At least one product photo is required' }, { status: 400 });

  try {
    const form = new FormData();
    const fields = ['photo', 'photo2', 'photo3'];
    for (let i = 0; i < refs.length; i++) {
      const file = await downloadPhoto(refs[i], i);
      if ('error' in file) return NextResponse.json({ error: file.error }, { status: 400 });
      form.append(fields[i], file);
    }
    form.append('name', name);
    form.append('size', str('size'));
    form.append('category', category);
    form.append('bestBefore', bestBefore);
    form.append('notes', str('notes'));
    form.append('price', String(price));
    form.append('marketPrice', String(num('marketPrice')));
    form.append('barcode', str('barcode'));
    form.append('kosher', String(bool('kosher')));
    form.append('halal', String(bool('halal')));
    form.append('vegan', String(bool('vegan')));

    const result = await buildProductFromFormData(form);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    await insertProduct(result.product);

    const p = result.product;
    return NextResponse.json({
      success: true,
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      photoUrl: p.photoUrl,
      storeUrl: 'https://clearanceshop.co.za/',
      adminUrl: 'https://clearanceshop.co.za/admin/products',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
