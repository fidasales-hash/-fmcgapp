import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function bingImages(query: string): Promise<string[]> {
  const key = process.env.BING_IMAGE_SEARCH_KEY;
  if (!key) return [];
  try {
    const url = new URL('https://api.bing.microsoft.com/v7.0/images/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', '10');
    url.searchParams.set('imageType', 'Photo');
    url.searchParams.set('size', 'Large');
    const r = await fetch(url.toString(), { headers: { 'Ocp-Apim-Subscription-Key': key } });
    const d = await r.json();
    return ((d.value ?? []) as { contentUrl: string }[]).map(i => i.contentUrl);
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  try {
    const { name, size } = await req.json();
    if (!name) return NextResponse.json({ frontImages: [], backImages: [] });

    const term = `${name}${size ? ' ' + size : ''}`;
    const [frontImages, backImages] = await Promise.all([
      bingImages(`${term} product`),
      bingImages(`${term} back label`),
    ]);

    return NextResponse.json({ frontImages, backImages });
  } catch {
    return NextResponse.json({ frontImages: [], backImages: [] });
  }
}
