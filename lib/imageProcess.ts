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

// Background removal is switched off for now: photos are edited in a photo
// app before upload, and the Cloud Run service's cold start made every save
// slow. To turn it back on, set BG_REMOVAL=on in Vercel's environment variables.
const BG_REMOVAL_ON = process.env.BG_REMOVAL === 'on';

export async function processProductImage(input: Buffer): Promise<Buffer> {
  let layer: Buffer;

  try {
    if (!BG_REMOVAL_ON) throw new Error('skip');
    // Background removed → transparent PNG of just the product
    const noBg = await removeBackground(input);
    layer = await sharp(noBg)
      .rotate()
      .resize(MAX, MAX, { fit: 'inside' })
      .sharpen({ sigma: 1.2 })
      .toBuffer();
  } catch (e) {
    if (BG_REMOVAL_ON) console.error('removeBackground failed, falling back to white-flatten:', e);
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
