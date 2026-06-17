import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  const correct = process.env.UPLOAD_PIN ?? '';
  if (!correct || pin !== correct) {
    return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
