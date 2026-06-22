import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function tavilyImages(query: string): Promise<string[]> {
  if (!process.env.TAVILY_API_KEY) return [];
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_images: true,
      }),
    });
    const d = await r.json();
    return ((d.images ?? []) as string[]).slice(0, 6);
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  try {
    const { name, size } = await req.json();
    if (!name) return NextResponse.json({ frontImages: [], backImages: [] });

    const term = `${name}${size ? ' ' + size : ''}`;
    const [frontImages, backImages] = await Promise.all([
      tavilyImages(`${term} product`),
      tavilyImages(`${term} back label`),
    ]);

    return NextResponse.json({ frontImages, backImages });
  } catch {
    return NextResponse.json({ frontImages: [], backImages: [] });
  }
}
