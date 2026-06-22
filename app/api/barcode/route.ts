import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const CATEGORY_MAP: { terms: string[]; category: string }[] = [
  { terms: ['beverage', 'drink', 'juice', 'soda', 'water', 'coffee', 'tea', 'beer', 'wine', 'spirits', 'cola', 'energy drink'], category: 'Drinks' },
  { terms: ['canned', 'tinned', 'soup', 'beans', 'tuna', 'sardine', 'lentil', 'chickpea'], category: 'Tinned & Canned' },
  { terms: ['snack', 'candy', 'chocolate', 'confection', 'chip', 'crisp', 'sweet', 'biscuit', 'cookie', 'gum', 'popcorn', 'nut'], category: 'Snacks & Confectionery' },
  { terms: ['bread', 'cereal', 'bakery', 'grain', 'pasta', 'rice', 'flour', 'oat', 'muesli', 'porridge'], category: 'Bakery & Cereals' },
  { terms: ['clean', 'detergent', 'bleach', 'household', 'laundry', 'dishwash', 'fabric', 'polish', 'disinfect'], category: 'Home & Cleaning' },
  { terms: ['health', 'beauty', 'cosmetic', 'personal care', 'shampoo', 'soap', 'lotion', 'cream', 'hair', 'skin', 'dental', 'toothpaste', 'deodorant', 'perfume', 'makeup', 'moisturiser', 'sunscreen'], category: 'Health & Beauty' },
  { terms: ['baby', 'toddler', 'infant', 'nappy', 'diaper', 'formula', 'wipe'], category: 'Baby & Toddler' },
  { terms: ['pet', 'dog', 'cat', 'bird', 'fish food', 'animal feed', 'kibble', 'pedigree', 'whiskas'], category: 'Pet' },
  { terms: ['electronic', 'tech', 'battery', 'cable', 'charger', 'headphone', 'earphone'], category: 'Electronics' },
];

function toMetric(size: string): string {
  if (!size) return size;
  // fl oz → ml
  size = size.replace(/(\d+(?:\.\d+)?)\s*fl\.?\s*oz/gi, (_, n) => `${Math.round(parseFloat(n) * 29.574)}ml`);
  // oz → g (weight)
  size = size.replace(/(\d+(?:\.\d+)?)\s*oz/gi, (_, n) => `${Math.round(parseFloat(n) * 28.35)}g`);
  // lb / lbs → g or kg
  size = size.replace(/(\d+(?:\.\d+)?)\s*lbs?/gi, (_, n) => {
    const g = Math.round(parseFloat(n) * 453.592);
    return g >= 1000 ? `${(g / 1000).toFixed(2).replace(/\.?0+$/, '')}kg` : `${g}g`;
  });
  // qt → ml
  size = size.replace(/(\d+(?:\.\d+)?)\s*qt/gi, (_, n) => `${Math.round(parseFloat(n) * 946)}ml`);
  // gal → L
  size = size.replace(/(\d+(?:\.\d+)?)\s*gal/gi, (_, n) => `${parseFloat((parseFloat(n) * 3.785).toFixed(1))}L`);
  return size;
}

function extractSizeFromTitle(title: string): string {
  const m = title.match(/(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|oz|ml|cl|dl|l\b|g\b|kg|lb s?|lbs?|gal|qt|pint s?|pints?)/i);
  return m ? toMetric(m[0].trim()) : '';
}

function mapCategory(upcCategory: string): string {
  const c = upcCategory.toLowerCase();
  for (const { terms, category } of CATEGORY_MAP) {
    if (terms.some(t => c.includes(t))) return category;
  }
  return 'Other';
}

async function googleImages(query: string): Promise<string[]> {
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) { console.error('googleImages: missing GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX'); return []; }
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', key);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', query);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('num', '10');
    url.searchParams.set('imgSize', 'large');
    const r = await fetch(url.toString());
    const d = await r.json();
    if (d.error) console.error('googleImages error:', JSON.stringify(d.error));
    return ((d.items ?? []) as { link: string }[]).map(i => i.link);
  } catch (e) { console.error('googleImages fetch error:', e); return []; }
}

interface ProductInfo { name: string; size: string; category: string; }

async function lookupOpenFoodFacts(barcode: string): Promise<ProductInfo | null> {
  const hosts = [
    'world.openfoodfacts.org',
    'world.openbeautyfacts.org',
    'world.openpetfoodfacts.org',
    'world.openproductsfacts.org',
  ];
  const results = await Promise.all(
    hosts.map(h =>
      fetch(`https://${h}/api/v0/product/${encodeURIComponent(barcode)}.json`)
        .then(r => r.json())
        .catch(() => null)
    )
  );
  for (const d of results) {
    if (d?.status === 1 && d.product) {
      const p = d.product;
      const name = p.product_name_en || p.product_name || '';
      const size = toMetric(p.quantity || '');
      const catRaw = (p.categories_tags ?? []).join(' ');
      const category = mapCategory(catRaw);
      if (name) return { name, size, category };
    }
  }
  return null;
}

async function lookupUPC(barcode: string): Promise<{ name: string; size: string; category: string; marketPrice: number } | null> {
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`);
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;
    const name = item.title ?? '';
    const size = toMetric(item.size ?? '') || extractSizeFromTitle(name);
    const category = item.category ? mapCategory(item.category) : 'Other';
    let marketPrice = 0;
    const lowestPrice = typeof item.lowest_recorded_price === 'number' ? item.lowest_recorded_price : 0;
    if (lowestPrice > 0) {
      try {
        const fxRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=ZAR');
        if (fxRes.ok) {
          const fxData = await fxRes.json();
          const rate = fxData.rates?.ZAR;
          if (rate) marketPrice = Math.round(lowestPrice * rate);
        }
      } catch { /* price stays 0 */ }
    }
    return { name, size, category, marketPrice };
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const { barcode } = await req.json();
    if (!barcode) return NextResponse.json({ error: 'No barcode' }, { status: 400 });

    // Query UPC and Open Food Facts family in parallel
    const [upc, off] = await Promise.all([
      lookupUPC(String(barcode)),
      lookupOpenFoodFacts(String(barcode)),
    ]);

    const found = !!(upc || off);

    // Merge: OFF for name/size/category (better global coverage), UPC for price
    const name = off?.name || upc?.name || '';
    const size = off?.size || upc?.size || '';
    const category = (off?.category !== 'Other' ? off?.category : upc?.category) ?? 'Other';
    const marketPrice = upc?.marketPrice ?? 0;

    const searchTerm = `${name || `product ${barcode}`}${size ? ' ' + size : ''}`;
    const [frontImages, backImages] = await Promise.all([
      googleImages(`${searchTerm} product`),
      googleImages(`${searchTerm} back label`),
    ]);

    return NextResponse.json({ found, name, size, category, marketPrice, frontImages, backImages });
  } catch (e) {
    console.error('barcode error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
