import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function googleImages(query: string): Promise<string[]> {
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return [];
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', key);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', query);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('num', '10');
    url.searchParams.set('imgSize', 'large');
    const r = await fetch(url.toString());
    const d = await r.json();
    return ((d.items ?? []) as { link: string }[]).map(i => i.link);
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  try {
    const { name, size } = await req.json();
    if (!name) return NextResponse.json({ frontImages: [], backImages: [] });

    const term = `${name}${size ? ' ' + size : ''}`;
    const [frontImages, backImages] = await Promise.all([
      googleImages(`${term} product`),
      googleImages(`${term} back label`),
    ]);

    return NextResponse.json({ frontImages, backImages });
  } catch {
    return NextResponse.json({ frontImages: [], backImages: [] });
  }
}
