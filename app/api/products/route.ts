import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts, insertProduct } from '@/lib/db';
import { buildProductFromFormData } from '@/lib/productForm';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    const result = await buildProductFromFormData(formData);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    await insertProduct(result.product);
    return NextResponse.json({ success: true, product: result.product });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
