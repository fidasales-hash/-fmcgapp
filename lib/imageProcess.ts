import sharp from 'sharp';

const CARD = 1200;
const MAX = 1100;

async function removeBackground(input: Buffer): Promise<Buffer> {
  const apiKey = process.env.REMOVE_BG_API_KEY ?? '';
  if (!apiKey) throw new Error('REMOVE_BG_API_KEY not set');

  const form = new FormData();
  form.append('image_file', new Blob([new Uint8Array(input)], { type: 'image/jpeg' }), 'photo.jpg');
  form.append('size', 'auto');

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: form,
  });

  if (!res.ok) throw new Error(`Remove.bg ${res.status}`);
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
