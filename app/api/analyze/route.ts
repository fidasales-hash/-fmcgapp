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
3. Best before date: convert to YYYY-MM-DD. If only month/year shown (e.g. "09/2025"), use last day of that month ("2025-09-30"). Leave empty string if not visible.

Return ONLY valid JSON with no extra text:
{"name":"...","size":"...","bestBefore":""}`,
          },
        ],
      }],
    });

    const text = response.choices[0].message.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ name: '', size: '', bestBefore: '' });
    return NextResponse.json(JSON.parse(match[0]));
  } catch (e) {
    console.error('analyze error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
