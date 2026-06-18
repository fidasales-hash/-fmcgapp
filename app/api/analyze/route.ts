import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const photo = formData.get('photo') as File;
    if (!photo) return NextResponse.json({ error: 'No photo' }, { status: 400 });

    const buffer = Buffer.from(await photo.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mediaType = (photo.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp';

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
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

    const text = (response.content[0] as { type: 'text'; text: string }).text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ name: '', size: '', bestBefore: '' });
    return NextResponse.json(JSON.parse(match[0]));
  } catch (e) {
    console.error('analyze error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
