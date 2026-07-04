import sharp from 'sharp';

const CARD = 1200;
const MAX = 1100;

export async function processProductImage(input: Buffer): Promise<Buffer> {
  // Background removal happens client-side (lib/clientBgRemoval.ts) before upload.
  // flatten() here is a safety net: turns any leftover transparency white and is a
  // no-op on photos that are already opaque.
  const layer = await sharp(input)
    .rotate()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true })
    .sharpen({ sigma: 1.2 })
    .toBuffer();

  // Centre the product layer on a white 1200×1200 card
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
