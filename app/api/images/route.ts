import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Google Images via Serper. Returns [] when SERPER_API_KEY is unset, so the
// feature stays dormant (no errors) until a key is added in the environment.
async function serperImages(query: string): Promise<string[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];
  try {
    const r = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 }),
    });
    const d = await r.json();
    return ((d.images ?? []) as { imageUrl: string }[]).map(i => i.imageUrl).filter(Boolean);
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  try {
    const { name, size } = await req.json();
    if (!name) return NextResponse.json({ frontImages: [], backImages: [] });

    const term = `${name}${size ? ' ' + size : ''}`;
    const [frontImages, backImages] = await Promise.all([
      serperImages(`${term} product`),
      serperImages(`${term} back label`),
    ]);

    return NextResponse.json({ frontImages, backImages });
  } catch {
    return NextResponse.json({ frontImages: [], backImages: [] });
  }
}
