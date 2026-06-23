import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const runtime = 'nodejs';

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const REWORD_PROMPT = (name: string, size: string) =>
  `Clean up this product name and size for a retail listing.

Name: "${name}"
Size: "${size}"

Rules:
- Name: brand + product type + variant/flavour if present, max 6 words, title case. E.g. "Hershey's Kisses Candy Cane", "Coca-Cola Zero Sugar", "Heinz Baked Beans"
- Size: digits + unit only (ml, g, L, kg). E.g. "330ml", "500g", "2L". Multiple packs like "6 x 330ml". Count-only packs like "10's", "6's". If size is missing or unknown, write "N/A"

Return ONLY valid JSON:
{"name":"...","size":"..."}`;

export async function POST(req: NextRequest) {
  try {
    const { name, size } = await req.json();
    if (!name) return NextResponse.json({ name: '', size: size || '' });

    const response = await client.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 64,
      messages: [{ role: 'user', content: REWORD_PROMPT(name, size ?? '') }],
    });

    const text = response.choices[0].message.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ name, size: size || '' });
    const result = JSON.parse(match[0]);
    return NextResponse.json({ name: result.name || name, size: result.size || size || '' });
  } catch (e) {
    console.error('reword error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
