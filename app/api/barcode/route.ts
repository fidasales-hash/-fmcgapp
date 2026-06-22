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

function mapCategory(upcCategory: string): string {
  const c = upcCategory.toLowerCase();
  for (const { terms, category } of CATEGORY_MAP) {
    if (terms.some(t => c.includes(t))) return category;
  }
  return 'Other';
}

async function tavilyImages(query: string): Promise<string[]> {
  if (!process.env.TAVILY_API_KEY) return [];
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_images: true,
      }),
    });
    const d = await r.json();
    return ((d.images ?? []) as string[]).slice(0, 6);
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  try {
    const { barcode } = await req.json();
    if (!barcode) return NextResponse.json({ error: 'No barcode' }, { status: 400 });

    const upcRes = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(String(barcode))}`);
    const upcData = await upcRes.json();
    const item = upcData.items?.[0];

    let name = '';
    let size = '';
    let category = 'Other';
    let marketPrice = 0;

    if (item) {
      name = item.title ?? '';
      size = toMetric(item.size ?? '');
      category = item.category ? mapCategory(item.category) : 'Other';

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
    }

    const searchTerm = `${name || `product ${barcode}`}${size ? ' ' + size : ''}`;
    const [frontImages, backImages] = await Promise.all([
      tavilyImages(`${searchTerm} product`),
      tavilyImages(`${searchTerm} back label`),
    ]);

    return NextResponse.json({ found: !!item, name, size, category, marketPrice, frontImages, backImages });
  } catch (e) {
    console.error('barcode error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
