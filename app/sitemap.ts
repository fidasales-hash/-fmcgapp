import { MetadataRoute } from 'next';
import { getAllProducts } from '@/lib/db';

const SITE_URL = 'https://clearanceshop.co.za';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let categories: string[] = [];
  try {
    const products = await getAllProducts();
    categories = [...new Set(products.map(p => p.category))].sort();
  } catch {
    // fall back to homepage only if DB is unreachable
  }

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    ...categories.map(cat => ({
      url: `${SITE_URL}/?category=${encodeURIComponent(cat)}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
