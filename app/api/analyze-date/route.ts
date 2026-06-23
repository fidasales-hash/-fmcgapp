import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import sharp from 'sharp';

export const runtime = 'nodejs';

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DATE_PROMPT = `Look at this product packaging image. Find the best before, use by, or expiry date.

The date will be in MM/YYYY format (e.g. "06/2026", "12/2025").

Return ONLY valid JSON with no extra text:
{"month":"MM","year":"YYYY"}

If no date is visible, return: {"month":"","year":""}`;

function lastDayOfMonth(month: number, year: number): string {
  const d = new Date(year, month, 0); // day 0 of next month = last day of this month
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const photo = formData.get('photo') as File;
    if (!photo) return NextResponse.json({ bestBefore: '' });

    const buffer = Buffer.from(await photo.arrayBuffer());
    const resized = await sharp(buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const imageUrl = `data:image/jpeg;base64,${resized.toString('base64')}`;

    const response = await client.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 32,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: DATE_PROMPT },
        ],
      }],
    });

    const text = response.choices[0].message.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ bestBefore: '' });

    const { month, year } = JSON.parse(match[0]);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (!m || !y || m < 1 || m > 12 || y < 2020 || y > 2040) {
      return NextResponse.json({ bestBefore: '' });
    }

    return NextResponse.json({ bestBefore: lastDayOfMonth(m, y) });
  } catch (e) {
    console.error('analyze-date error:', e);
    return NextResponse.json({ bestBefore: '' });
  }
}
