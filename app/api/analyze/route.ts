import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import sharp from 'sharp';

export const runtime = 'nodejs';

const GROQ_PROMPT = `Look at this product packaging image. Extract:
1. Product name: brand + product type + variant/flavour if shown, max 6 words. Examples: "Hershey's Kisses Candy Cane", "Coca-Cola Zero Sugar", "Heinz Baked Beans", "Sunlight Dish Liquid"
2. Size/weight: digits + unit only — ml, g, L, or kg (e.g. "400g", "330ml", "2L", "1.5kg", "6 x 250ml"). For count-only packs use e.g. "10's", "6's". Leave blank if not visible
3. Category: pick exactly one from this list:
   Drinks, Tinned & Canned, Snacks & Confectionery, Bakery & Cereals, Home & Cleaning, Health & Beauty, Baby & Toddler, Pet, Electronics, Other

Return ONLY valid JSON with no extra text:
{"name":"...","size":"...","category":"..."}`;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';

    let imageUrlForGroq = '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      const photoUrl: string = body.photoUrl ?? '';
      if (!photoUrl) return NextResponse.json({ error: 'No photoUrl' }, { status: 400 });
      const imgRes = await fetch(photoUrl);
      if (!imgRes.ok) return NextResponse.json({ error: 'Failed to fetch image' }, { status: 400 });
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      const resized = await sharp(imgBuffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      imageUrlForGroq = `data:image/jpeg;base64,${resized.toString('base64')}`;
    } else {
      const formData = await req.formData();
      const photo = formData.get('photo') as File;
      if (!photo) return NextResponse.json({ error: 'No photo' }, { status: 400 });

      const buffer = Buffer.from(await photo.arrayBuffer());
      const resized = await sharp(buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      imageUrlForGroq = `data:image/jpeg;base64,${resized.toString('base64')}`;
    }

    const response = await new Groq({ apiKey: process.env.GROQ_API_KEY }).chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrlForGroq } },
          { type: 'text', text: GROQ_PROMPT },
        ],
      }],
    });

    const text = response.choices[0].message.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ name: '', size: '' });
    const { name = '', size = '', category = '' } = JSON.parse(match[0]);

    let marketPrice = 0;
    if (name && process.env.TAVILY_API_KEY) {
      try {
        const query = `${name}${size ? ' ' + size : ''}`;
        const tvRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query,
            search_depth: 'basic',
            max_results: 5,
            include_domains: ['checkers.co.za', 'pnp.co.za', 'woolworths.co.za', 'shoprite.co.za', 'makro.co.za', 'spar.co.za', 'takealot.com', 'amazon.co.za'],
          }),
        });
        const tvData = await tvRes.json();
        const content = (tvData.results ?? []).map((r: { content: string }) => r.content).join(' ');
        const prices = [...content.matchAll(/R\s*(\d+(?:[.,]\d{1,2})?)/gi)]
          .map(m => parseFloat(m[1].replace(',', '.')))
          .filter(p => p >= 1 && p < 10000);
        if (prices.length) {
          prices.sort((a, b) => a - b);
          marketPrice = prices[Math.floor(prices.length / 2)];
        }
      } catch { /* price stays 0 */ }
    }

    return NextResponse.json({ name, size, category, marketPrice });
  } catch (e) {
    console.error('analyze error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
