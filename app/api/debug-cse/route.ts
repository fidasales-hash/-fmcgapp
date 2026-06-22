import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  if (!key || !cx) {
    return NextResponse.json({ error: 'Missing env vars', hasKey: !!key, hasCx: !!cx });
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', key);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', 'Coca Cola 330ml product');
  url.searchParams.set('searchType', 'image');
  url.searchParams.set('num', '3');
  url.searchParams.set('imgSize', 'large');

  const r = await fetch(url.toString());
  const d = await r.json();

  return NextResponse.json({
    status: r.status,
    error: d.error ?? null,
    itemCount: d.items?.length ?? 0,
    firstImage: d.items?.[0]?.link ?? null,
  });
}
