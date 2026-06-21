import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import sharp from 'sharp';

export const runtime = 'nodejs';

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const photo = formData.get('photo') as File;
    if (!photo) return NextResponse.json({ error: 'No photo' }, { status: 400 });

    const buffer = Buffer.from(await photo.arrayBuffer());

    // Resize to max 800px — Groq rejects large images
    const resized = await sharp(buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const base64 = resized.toString('base64');

    const response = await client.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}` },
          },
          {
            type: 'text',
            text: `Look at this product packaging. Extract:
1. Product name: brand name + product type (e.g. "Heinz Baked Beans")
2. Size/weight: quantity shown on pack (e.g. "400g", "330ml", "6 x 250ml")
3. Category: pick exactly one from this list:
   Drinks, Tinned & Canned, Snacks & Confectionery, Bakery & Cereals, Home & Cleaning, Health & Beauty, Baby & Toddler, Pet, Electronics, Other

Return ONLY valid JSON with no extra text:
{"name":"...","size":"...","category":"..."}`,
          },
        ],
      }],
    });

    const text = response.choices[0].message.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ name: '', size: '' });
    const { name = '', size = '', category = '' } = JSON.parse(match[0]);

    // Search Tavily for retail market price
    let marketPrice = 0;
    if (name && process.env.TAVILY_API_KEY) {
      try {
        const query = `${name}${size ? ' ' + size : ''} price South Africa`;
        const tvRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, search_depth: 'basic', max_results: 5 }),
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
      } catch { /* Tavily unavailable — marketPrice stays 0 */ }
    }

    return NextResponse.json({ name, size, category, marketPrice });
  } catch (e) {
    console.error('analyze error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
