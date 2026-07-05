import sharp from 'sharp';

const CARD = 1200;
const MAX = 1100;

async function removeBackground(input: Buffer): Promise<Buffer> {
  const url = process.env.BG_REMOVAL_URL ?? '';
  if (!url) throw new Error('BG_REMOVAL_URL not set');

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(input)], { type: 'image/jpeg' }), 'photo.jpg');

  const res = await fetch(`${url}/remove`, {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.BG_REMOVAL_API_KEY ?? '' },
    body: form,
    signal: AbortSignal.timeout(45_000), // fall back to white-flatten instead of hard-timing out the whole function on a cold start
  });

  if (!res.ok) throw new Error(`bg-removal ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function processProductImage(input: Buffer): Promise<Buffer> {
  let layer: Buffer;

  try {
    // Background removed → transparent PNG of just the product
    const noBg = await removeBackground(input);
    layer = await sharp(noBg)
      .rotate()
      .resize(MAX, MAX, { fit: 'inside' })
      .sharpen({ sigma: 1.2 })
      .toBuffer();
  } catch {
    // Fallback if Remove.bg fails: use original photo flattened to white
    layer = await sharp(input)
      .rotate()
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true })
      .sharpen({ sigma: 1.2 })
      .toBuffer();
  }

  // Centre the product layer on a white 900×900 card
  return sharp({
    create: {
      width: CARD,
      height: CARD,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: layer, gravity: 'centre' }])
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}
