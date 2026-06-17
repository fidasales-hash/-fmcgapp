import sharp from 'sharp';

const CARD = 900;
const MAX = 700;

export async function processProductImage(input: Buffer): Promise<Buffer> {
  // Auto-rotate from EXIF, flatten transparency, resize to fit
  const { data, info } = await sharp(input)
    .rotate()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const left = Math.floor((CARD - info.width) / 2);
  const top = Math.floor((CARD - info.height) / 2);

  // Composite centred onto white 900×900 card
  return sharp({
    create: {
      width: CARD,
      height: CARD,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{
      input: data,
      raw: { width: info.width, height: info.height, channels: info.channels as 1 | 2 | 3 | 4 },
      left,
      top,
    }])
    .jpeg({ quality: 82 })
    .toBuffer();
}
