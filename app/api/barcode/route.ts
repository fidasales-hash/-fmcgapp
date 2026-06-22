import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const runtime = 'nodejs';

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function analyzeImageUrl(url: string): Promise<{ name: string; size: string; category: string }> {
  try {
    const response = await groqClient.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url } },
          { type: 'text', text: `Look at this product packaging. Extract:
1. Product name: brand name + product type (e.g. "Heinz Baked Beans")
2. Size/weight: quantity shown on pack (e.g. "400g", "330ml", "6 x 250ml")
3. Category: pick exactly one: Drinks, Tinned & Canned, Snacks & Confectionery, Bakery & Cereals, Home & Cleaning, Health & Beauty, Baby & Toddler, Pet, Electronics, Other

Return ONLY valid JSON: {"name":"...","size":"...","category":"..."}` },
        ],
      }],
    });
    const text = response.choices[0].message.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { name: '', size: '', category: '' };
    const { name = '', size = '', category = '' } = JSON.parse(match[0]);
    return { name, size: toMetric(size), category };
  } catch { return { name: '', size: '', category: '' }; }
}

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
  size = size.replace(/-/g, ' ');
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
  const m = title.match(/(\d+(?:\.\d+)?)[\s-]*(fl\.?\s*oz|oz|ml|cl|dl|l\b|g\b|kg|lbs?|gal|qt|pints?)/i);
  return m ? toMetric(m[0].trim()) : '';
}

function mapCategory(upcCategory: string): string {
  const c = upcCategory.toLowerCase();
  for (const { terms, category } of CATEGORY_MAP) {
    if (terms.some(t => c.includes(t))) return category;
  }
  return 'Other';
}

async function bingImages(query: string): Promise<string[]> {
  const key = process.env.BING_IMAGE_SEARCH_KEY;
  if (!key) return [];
  try {
    const url = new URL('https://api.bing.microsoft.com/v7.0/images/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', '10');
    url.searchParams.set('imageType', 'Photo');
    url.searchParams.set('size', 'Large');
    const r = await fetch(url.toString(), { headers: { 'Ocp-Apim-Subscription-Key': key } });
    const d = await r.json();
    return ((d.value ?? []) as { contentUrl: string }[]).map(i => i.contentUrl);
  } catch { return []; }
}

interface ProductInfo { name: string; size: string; category: string; frontImage?: string; backImage?: string; }

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
      const frontImage: string = p.image_front_url || p.image_url || '';
      const backImage: string = p.image_back_url || '';
      if (name) return { name, size, category, frontImage, backImage };
    }
  }
  return null;
}

async function lookupUPC(barcode: string): Promise<{ name: string; size: string; category: string; images: string[] } | null> {
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`);
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;
    const name = item.title ?? '';
    const size = toMetric(item.size ?? '') || extractSizeFromTitle(name);
    const category = item.category ? mapCategory(item.category) : 'Other';
    const images: string[] = Array.isArray(item.images) ? item.images : [];
    return { name, size, category, images };
  } catch { return null; }
}

const SA_RETAIL_DOMAINS = ['checkers.co.za', 'pnp.co.za', 'woolworths.co.za', 'shoprite.co.za', 'makro.co.za', 'spar.co.za', 'takealot.com', 'amazon.co.za'];

async function lookupTavilyPrice(query: string): Promise<number> {
  if (!process.env.TAVILY_API_KEY) return 0;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, search_depth: 'basic', max_results: 5, include_domains: SA_RETAIL_DOMAINS }),
    });
    const data = await res.json();
    const content = (data.results ?? []).map((r: { content: string }) => r.content).join(' ');
    const prices = [...content.matchAll(/R\s*(\d+(?:[.,]\d{1,2})?)/gi)]
      .map(m => parseFloat(m[1].replace(',', '.')))
      .filter(p => p >= 1 && p < 10000);
    if (!prices.length) return 0;
    prices.sort((a, b) => a - b);
    return prices[Math.floor(prices.length / 2)];
  } catch { return 0; }
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

    const name = off?.name || upc?.name || '';
    const size = off?.size || upc?.size || '';
    const category = (off?.category && off.category !== 'Other' ? off.category : upc?.category) ?? 'Other';

    const upcImages = upc?.images ?? [];
    const frontImages = off?.frontImage ? [off.frontImage] : upcImages.length ? upcImages : await bingImages(`${searchTerm} product`);
    const backImages = off?.backImage ? [off.backImage] : [];

    const imageUrl = frontImages[0] ?? '';
    const [marketPrice, groq] = await Promise.all([
      name ? lookupTavilyPrice(searchTerm) : Promise.resolve(0),
      imageUrl ? analyzeImageUrl(imageUrl) : Promise.resolve({ name: '', size: '', category: '' }),
    ]);

    const finalName = name || groq.name;
    const finalSize = size || groq.size;
    const finalCategory = category !== 'Other' ? category : (groq.category || 'Other');

    return NextResponse.json({ found, name: finalName, size: finalSize, category: finalCategory, marketPrice, frontImages, backImages });
  } catch (e) {
    console.error('barcode error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
